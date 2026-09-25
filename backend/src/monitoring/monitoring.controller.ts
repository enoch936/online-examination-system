import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExamPermissionLevel, RoleName } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
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
