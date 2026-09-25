import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [ExamAccessModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
