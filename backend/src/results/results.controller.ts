import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
}
