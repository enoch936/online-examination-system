import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';

@Module({
  imports: [ExamAccessModule],
  controllers: [InstructorsController],
  providers: [InstructorsService],
})
export class InstructorsModule {}
