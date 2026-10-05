import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GradingStatus, RoleName, SubmissionStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { BulkGradeByIdsDto, BulkGradeDto } from './dto/bulk-operations.dto';
import { GradeAnswersDto } from './dto/grade-answers.dto';
import { OverrideResultDto } from './dto/override-result.dto';
import { BulkGradingService } from './bulk-grading.service';
import { ResultsService } from './results.service';

function isGradingStatus(value: string | undefined): value is GradingStatus {
  return value === 'PENDING' || value === 'GRADED' || value === 'PUBLISHED';
}

function isSubmissionStatus(value: string | undefined): value is SubmissionStatus {
  return (
    value === 'DRAFT' ||
    value === 'SUBMITTED' ||
    value === 'AUTO_SUBMITTED' ||
    value === 'GRADED' ||
    value === 'NEEDS_MANUAL_GRADING'
  );
}

/** Query strings arrive as text; ignore anything non-numeric instead of coercing NaN. */
function toFiniteNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

@ApiBearerAuth()
@ApiTags('Results')
@Controller('results')
export class ResultsController {
  constructor(
    private readonly results: ResultsService,
    private readonly bulkGrading: BulkGradingService,
  ) {}

  @Get()
  @ApiQuery({ name: 'examId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'passed', required: false, type: Boolean })
  @ApiQuery({ name: 'certificateStatus', required: false, enum: ['issued', 'none'] })
  @ApiQuery({ name: 'q', required: false, description: 'Student name/email or exam title' })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'gradingStatus', required: false, enum: ['PENDING', 'GRADED', 'PUBLISHED'] })
  @ApiQuery({ name: 'submissionStatus', required: false, enum: ['DRAFT', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED', 'NEEDS_MANUAL_GRADING'] })
  @ApiQuery({ name: 'minPercentage', required: false })
  @ApiQuery({ name: 'maxPercentage', required: false })
  @ApiQuery({ name: 'submittedFrom', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'submittedTo', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['submittedAt', 'percentage', 'student'] })
  @ApiQuery({ name: 'sortDir', required: false, enum: ['asc', 'desc'] })
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query('examId') examId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('passed') passed?: string,
    @Query('certificateStatus') certificateStatus?: string,
    @Query('q') q?: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
    @Query('gradingStatus') gradingStatus?: string,
    @Query('submissionStatus') submissionStatus?: string,
    @Query('minPercentage') minPercentage?: string,
    @Query('maxPercentage') maxPercentage?: string,
    @Query('submittedFrom') submittedFrom?: string,
    @Query('submittedTo') submittedTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.results.findMany(user, {
      examId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      passed: passed === undefined ? undefined : passed === 'true',
      certificateStatus: certificateStatus === 'issued' || certificateStatus === 'none' ? certificateStatus : undefined,
      q,
      classId,
      studentId,
      gradingStatus: isGradingStatus(gradingStatus) ? gradingStatus : undefined,
      submissionStatus: isSubmissionStatus(submissionStatus) ? submissionStatus : undefined,
      minPercentage: toFiniteNumber(minPercentage),
      maxPercentage: toFiniteNumber(maxPercentage),
      submittedFrom: toDate(submittedFrom),
      submittedTo: toDate(submittedTo),
      sortBy: sortBy === 'percentage' || sortBy === 'student' || sortBy === 'submittedAt' ? sortBy : undefined,
      sortDir: sortDir === 'asc' || sortDir === 'desc' ? sortDir : undefined,
    });
  }

  /**
   * Bulk grading by selection: an exam, optionally narrowed to a class and/or
   * specific students. Returns per-run counters instead of a bare 200 so the UI
   * can report exactly what happened, including the attempts left needing a human.
   */
  @Post('bulk/grade')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  async bulkGrade(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkGradeDto) {
    return this.bulkGrading.run(
      {
        examId: dto.examId,
        classId: dto.classId,
        studentIds: dto.studentIds,
        onlyUngraded: dto.onlyUngraded,
        regrade: dto.regrade,
      },
      user,
    );
  }

  /** Bulk grading for rows the user has ticked in the results table. */
  @Post('bulk/grade-by-ids')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  async bulkGradeByIds(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkGradeByIdsDto) {
    return this.bulkGrading.run({ resultIds: dto.resultIds, regrade: dto.regrade }, user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.results.findOne(user, id);
  }

  @Patch(':id/publish')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  async publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.results.publish(id, user);
  }

  @Post(':id/grade')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  async grade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GradeAnswersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.results.gradeManually(id, user, dto.answers);
  }

  @Patch(':id/override')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  async override(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideResultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.results.overrideResult(id, user, dto);
  }
}
