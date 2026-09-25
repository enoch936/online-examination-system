import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [ExamAccessModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
