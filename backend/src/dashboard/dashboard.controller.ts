import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { DashboardService } from './dashboard.service';

@ApiBearerAuth()
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Public()
  @Get('public-stats')
  getPublicStats() {
    return this.dashboard.getPublicStats();
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getStats(user);
  }
}
