import { forwardRef, Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { RealtimeModule } from '../websocket/realtime.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { RiskEngine } from './risk.engine';
import { TimeExtensionService } from './time-extension.service';

@Module({
  // SubmissionsModule is forwardRef'd because MonitoringService depends on
  // SubmissionsService (to freeze attempts on force-submit / end-session) while
  // SubmissionsService already depends on MonitoringService.
  imports: [forwardRef(() => RealtimeModule), ExamAccessModule, forwardRef(() => SubmissionsModule)],
  controllers: [MonitoringController],
  providers: [MonitoringService, RiskEngine, TimeExtensionService],
  exports: [MonitoringService, RiskEngine, TimeExtensionService],
})
export class MonitoringModule {}
