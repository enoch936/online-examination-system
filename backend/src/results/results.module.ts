import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  // One-way: certificates read Prisma directly, so depending back on results here
  // would be a cycle. Results depend on certificates for auto-issue on publish.
  imports: [ExamAccessModule, CertificatesModule],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
