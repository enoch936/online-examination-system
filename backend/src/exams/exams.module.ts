import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [SubmissionsModule, ExamAccessModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
