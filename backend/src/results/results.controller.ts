import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
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
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query('examId') examId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.results.findMany(user, {
      examId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.results.findOne(user, id);
  }

  @Patch(':id/publish')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.results.publish(id);
  }

  @Post(':id/grade')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  async grade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { answers: Array<{ answerId: string; score: number; feedback?: string }> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.results.gradeManually(id, user.sub, dto.answers);
  }
}
