import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { GradeAnswersDto } from './dto/grade-answers.dto';
import { OverrideResultDto } from './dto/override-result.dto';
import { ResultsService } from './results.service';

@ApiBearerAuth()
@ApiTags('Results')
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  @ApiQuery({ name: 'examId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'passed', required: false, type: Boolean })
  @ApiQuery({ name: 'certificateStatus', required: false, enum: ['issued', 'none'] })
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query('examId') examId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('passed') passed?: string,
    @Query('certificateStatus') certificateStatus?: string,
  ) {
    return this.results.findMany(user, {
      examId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      passed: passed === undefined ? undefined : passed === 'true',
      certificateStatus: certificateStatus === 'issued' || certificateStatus === 'none' ? certificateStatus : undefined,
    });
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
