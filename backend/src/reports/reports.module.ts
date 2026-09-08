import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ExamAccessModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}