import { forwardRef, Module } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  // MonitoringService now needs SubmissionsService to force-close sessions, and
  // SubmissionsService already needs MonitoringService, so both directions are
  // wrapped in forwardRef to break the circular provider dependency.
  imports: [forwardRef(() => MonitoringModule)],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
