import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExamPermissionLevel, RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { LogViolationDto } from './dto/log-violation.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { ExamSessionsService } from './exam-sessions.service';

@ApiBearerAuth()
@ApiTags('Exam Sessions')
@Controller('exam-sessions')
export class ExamSessionsController {
  constructor(
    private readonly sessions: ExamSessionsService,
    private readonly access: ExamAccessService,
  ) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async findByExam(@Query('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitor(examId, user);
    return this.sessions.findByExam(examId);
  }

  @Post(':examId/start')
  @Roles(RoleName.STUDENT)
  start(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.startExam(examId, user.sub);
  }

  @Get(':sessionId/resume')
  @Roles(RoleName.STUDENT)
  resume(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.resumeSession(sessionId, user.sub);
  }

  @Patch(':sessionId/answers')
  @Roles(RoleName.STUDENT)
  saveAnswer(@Param('sessionId') sessionId: string, @Body() dto: SaveAnswerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.saveAnswer(sessionId, user.sub, dto);
  }

  @Post(':sessionId/violations')
  @Roles(RoleName.STUDENT)
  logViolation(
    @Param('sessionId') sessionId: string,
    @Body() dto: LogViolationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.logViolation(sessionId, user.sub, dto);
  }

  @Patch(':sessionId/permit-retake')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async permitRetake(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitorSession(sessionId, user);
    const examId = await this.sessions.getExamIdForSession(sessionId);
    await this.access.assertCanAct(examId, user, ExamPermissionLevel.CO_OWNER);
    return this.sessions.permitRetake(sessionId);
  }

  @Patch(':sessionId/revoke-retake')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  async revokeRetake(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitorSession(sessionId, user);
    const examId = await this.sessions.getExamIdForSession(sessionId);
    await this.access.assertCanAct(examId, user, ExamPermissionLevel.CO_OWNER);
    return this.sessions.revokeRetake(sessionId);
  }
}