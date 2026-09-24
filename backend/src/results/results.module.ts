import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [ExamAccessModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
