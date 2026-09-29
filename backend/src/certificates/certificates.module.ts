import { Module } from '@nestjs/common';
import { ExamAccessModule } from '../common/exam-access.module';
import { ContentModule } from '../content/content.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [ExamAccessModule, ContentModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  // ResultsModule needs the service to auto-issue on publish, so it has to be
  // exported. Without this the app fails to boot with
  // "Nest can't resolve dependencies of the ResultsService" even though the
  // build and the unit tests both pass.
  exports: [CertificatesService],
})
export class CertificatesModule {}
