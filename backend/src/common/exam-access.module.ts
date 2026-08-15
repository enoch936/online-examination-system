import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ExamAccessService } from './exam-access.service';

@Module({
  providers: [ExamAccessService, AuditService],
  exports: [ExamAccessService, AuditService],
})
export class ExamAccessModule {}
