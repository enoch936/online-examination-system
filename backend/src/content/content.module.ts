import { Module } from '@nestjs/common';
import { CertificateTemplateBootstrapService } from './certificate-template.bootstrap';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

// PrismaModule is @Global, so PrismaService needs no local import here.
@Module({
  controllers: [ContentController],
  providers: [ContentService, CertificateTemplateBootstrapService],
  // CertificatesModule resolves and snapshots a template at issue time.
  exports: [ContentService],
})
export class ContentModule {}
