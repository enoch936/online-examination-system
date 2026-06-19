import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { LogViolationDto } from './dto/log-violation.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { ExamSessionsService } from './exam-sessions.service';

@ApiBearerAuth()
@ApiTags('Exam Sessions')
@Controller('exam-sessions')
@Roles(RoleName.STUDENT)
export class ExamSessionsController {
  constructor(private readonly sessions: ExamSessionsService) {}

  @Post(':examId/start')
  start(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.startExam(examId, user.sub);
  }

  @Get(':sessionId/resume')
  resume(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.resumeSession(sessionId, user.sub);
  }

  @Patch(':sessionId/answers')
  saveAnswer(@Param('sessionId') sessionId: string, @Body() dto: SaveAnswerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.saveAnswer(sessionId, user.sub, dto);
  }

  @Post(':sessionId/violations')
  logViolation(
    @Param('sessionId') sessionId: string,
    @Body() dto: LogViolationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.logViolation(sessionId, user.sub, dto);
  }
}
