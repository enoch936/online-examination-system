import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ExamPermissionLevel, RoleName } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ProctoringAudioDto } from './dto/proctoring-audio.dto';
import { InstructorActionDto } from './dto/instructor-action.dto';
import { RecordEventDto } from './dto/record-event.dto';
import { UpdateMonitoringConfigDto } from './dto/update-monitoring-config.dto';
import { MonitoringService } from './monitoring.service';

@ApiBearerAuth()
@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly access: ExamAccessService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'online-examination-system-api',
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe: verifies the process can reach its database.
   * Kept separate from /health so Render liveness never depends on
   * external services (a DB blip restarts nothing; it just fails ready).
   */
  @Public()
  @Get('health/ready')
  async readiness() {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 2000)),
      ]);
      return { status: 'ok', database: 'up', checkedAt: new Date().toISOString() };
    } catch {
      return { status: 'degraded', database: 'down', checkedAt: new Date().toISOString() };
    }
  }

  @Get('exams/:examId/requirements')
  @Roles(RoleName.STUDENT)
  requirements(@Param('examId') examId: string) {
    return this.monitoring.getStudentRequirements(examId);
  }

  @Get('exams/:examId/stats')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async stats(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitor(examId, user);
    return this.monitoring.getLiveStats(examId);
  }

  @Post('exams/:examId/monitor/open')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async openMonitor(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitor(examId, user);
    await this.audit.log(user.sub, 'EXAM', examId, 'MONITOR_OPENED');
    return { ok: true };
  }

  @Get('exams/:examId/sessions')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async sessions(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanAct(examId, user, ExamPermissionLevel.MONITOR);
    return this.monitoring.listSessions(examId);
  }

  @Get('exams/:examId/config')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async config(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitor(examId, user);
    return this.monitoring.getConfig(examId);
  }

  @Put('exams/:examId/config')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async updateConfig(
    @Param('examId') examId: string,
    @Body() dto: UpdateMonitoringConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanAct(examId, user, ExamPermissionLevel.PROCTOR);
    return this.monitoring.saveConfig(examId, dto as unknown as Record<string, unknown>);
  }

  @Get('exams/:examId/questions/:questionId/activity')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async questionActivity(
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanMonitor(examId, user);
    return this.monitoring.getQuestionActivity(examId, questionId);
  }

  @Get('sessions/:sessionId/events')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async timeline(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitorSession(sessionId, user);
    return this.monitoring.getTimeline(sessionId);
  }

  @Post('sessions/:sessionId/events/:eventId/ack')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async acknowledge(
    @Param('sessionId') sessionId: string,
    @Param('eventId') eventId: string,
    @Body() body: { note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanMonitorSession(sessionId, user);
    return this.monitoring.acknowledgeEvent(eventId, user.sub, body.note);
  }

  @Post('sessions/:sessionId/events')
  @Roles(RoleName.STUDENT)
  recordEvent(@Param('sessionId') sessionId: string, @Body() dto: RecordEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.monitoring.recordEvent({
      sessionId,
      studentId: user.sub,
      type: dto.type,
      metadata: dto.metadata,
      riskScore: dto.riskScore,
      asStudent: true,
    });
  }

  @Post('analyze')
  @Roles(RoleName.STUDENT)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512 * 1024 } }))
  async analyze(
    @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
    @Body() body: { sessionId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new HttpException('frame file is required', HttpStatus.BAD_REQUEST);
    if (typeof body.sessionId !== 'string' || body.sessionId.length === 0 || body.sessionId.length > 64) {
      throw new HttpException('invalid sessionId', HttpStatus.BAD_REQUEST);
    }
    const access = await this.monitoring.assertSessionAccess(body.sessionId, user.sub, user.roles);
    // A student analyzes only their OWN session's frames; ownership is checked
    // server-side so no client can pollute another student's motion state.
    if (!access || access.studentId !== user.sub) {
      throw new HttpException('Session does not belong to this user', HttpStatus.FORBIDDEN);
    }
    const form = new FormData();
    form.append('file', new Blob([file.buffer as unknown as ArrayBuffer]), file.originalname || 'frame.jpg');
    return this.forwardToProctoring<Record<string, unknown>>('/analyze', {
      form,
      query: { session_id: body.sessionId },
    });
  }

  @Post('audio')
  @Roles(RoleName.STUDENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async audio(@Body() dto: ProctoringAudioDto, @CurrentUser() user: AuthenticatedUser) {
    const access = await this.monitoring.assertSessionAccess(dto.sessionId, user.sub, user.roles);
    if (!access || access.studentId !== user.sub) {
      throw new HttpException('Session does not belong to this user', HttpStatus.FORBIDDEN);
    }
    return this.forwardToProctoring<Record<string, unknown>>('/audio', {
      json: {
        sessionId: dto.sessionId,
        rms: dto.rms,
        zeroCrossings: dto.zeroCrossings ?? 0,
        samples: dto.samples ?? 1024,
      },
    });
  }

  private async forwardToProctoring<T>(
    path: '/analyze' | '/audio',
    options: { form?: FormData; json?: unknown; query?: Record<string, string> },
  ): Promise<T> {
    const base = (this.configService.get<string>('PROCTORING_URL', 'http://127.0.0.1:8000') ?? '').replace(/\/$/, '');
    const apiKey = this.configService.get<string>('PROCTORING_API_KEY', '') ?? '';
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);

    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    let body: BodyInit | undefined;
    if (options.form) {
      body = options.form;
    } else if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    }

    const res = await fetch(url.toString(), { method: 'POST', headers, body });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const status = res.status >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST;
      throw new HttpException(detail || `Proctoring service returned ${res.status}`, status);
    }
    return (await res.json()) as T;
  }

  @Post('sessions/:sessionId/actions')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async actions(
    @Param('sessionId') sessionId: string,
    @Body() dto: InstructorActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanMonitorSession(sessionId, user);
    const session = await this.monitoring.getSessionExamId(sessionId);
    await this.access.assertCanPerformAction(session, user, dto.action);
    return this.monitoring.instructorAction(user.sub, sessionId, dto);
  }
}
