import { Controller, Get, Optional, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AnalyticsService } from './analytics.service';

@ApiBearerAuth()
@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Role-scoped by default. Every authenticated role can call this; the service
   * narrows what it returns to the caller, so a student cannot reach platform
   * numbers by hitting this endpoint directly.
   */
  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.getOverview(user);
  }

  /** Instructor/admin only. Returns nothing for student-only callers. */
  @Get('exams')
  exams(
    @CurrentUser() user: AuthenticatedUser,
    @Optional() @Query('examIds') examIds?: string,
  ) {
    const ids = examIds
      ? examIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;
    return this.analytics.getExamBreakdown(user, ids);
  }
}