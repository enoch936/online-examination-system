import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { RealtimeModule } from '../websocket/realtime.module';
import { ExamSessionsController } from './exam-sessions.controller';
import { ExamSessionsService } from './exam-sessions.service';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [MonitoringModule, ExamAccessModule, RealtimeModule],
  controllers: [ExamSessionsController, RequestsController],
  providers: [ExamSessionsService, RequestsService],
  exports: [ExamSessionsService],
})
export class ExamSessionsModule {}