import { Module } from '@nestjs/common';
import { CertificateRendererService } from './certificate-renderer.service';
import { CertificateTemplateBootstrapService } from './certificate-template.bootstrap';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

// PrismaModule is @Global, so PrismaService needs no local import here.
@Module({
  controllers: [ContentController],
  providers: [ContentService, CertificateTemplateBootstrapService, CertificateRendererService],
  // CertificatesModule resolves and snapshots a template at issue time, and
  // renders it through CertificateRendererService.
  exports: [ContentService, CertificateRendererService],
})
export class ContentModule {}
