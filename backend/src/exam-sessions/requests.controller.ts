import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { RequestsService } from './requests.service';

@ApiBearerAuth()
@ApiTags('Exam Requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post('retake')
  @Roles(RoleName.STUDENT)
  requestRetake(
    @Body() body: { examId: string; reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.requestRetake(user.sub, body.examId, body.reason);
  }

  @Post('resume')
  @Roles(RoleName.STUDENT)
  requestResume(
    @Body() body: { sessionId: string; reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.requestResume(user.sub, body.sessionId, body.reason);
  }

  @Get('pending')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  listPending(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.listPending(user);
  }

  @Get('exam/:examId')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  listForExam(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.listForExam(examId, user);
  }

  @Post(':requestId/approve')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  approve(
    @Param('requestId') requestId: string,
    @Body() body: { note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.decide(user, requestId, true, body.note);
  }

  @Post(':requestId/reject')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('sessions.monitor')
  reject(
    @Param('requestId') requestId: string,
    @Body() body: { note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.decide(user, requestId, false, body.note);
  }
}