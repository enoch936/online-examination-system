import { forwardRef, Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { RealtimeModule } from '../websocket/realtime.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { RiskEngine } from './risk.engine';

@Module({
  imports: [forwardRef(() => RealtimeModule), ExamAccessModule],
  controllers: [MonitoringController],
  providers: [MonitoringService, RiskEngine],
  exports: [MonitoringService, RiskEngine],
})
export class MonitoringModule {}
