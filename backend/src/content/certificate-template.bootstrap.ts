import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TemplateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_DESIGN } from './template-content.util';

/**
 * Installs the built-in `standard` certificate template at first boot.
 *
 * It is deliberately NOT a Prisma seed script: this must also run on an
 * existing production database, where `prisma db seed` never gets executed.
 * Like the super admin bootstrap it is idempotent and never overwrites — if an
 * administrator has since edited the `standard` template, or published a
 * different default, that is left exactly as it is.
 */
@Injectable()
export class CertificateTemplateBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CertificateTemplateBootstrapService.name);
  private static readonly SLUG = 'standard';

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const seeded = await this.ensure();
      this.logger.log(seeded ? 'Seeded the default certificate template.' : 'Default certificate template already present; skipped.');
    } catch (err) {
      // A failure here must not stop the API from serving traffic: with no
      // template the PDF builder falls back to the built-in wording, which is
      // exactly what it rendered before the CMS existed.
      this.logger.error(`Could not seed the default certificate template: ${(err as Error).message}`);
    }
  }

  async ensure(): Promise<boolean> {
    const existing = await this.prisma.certificateTemplate.findUnique({
      where: { slug: CertificateTemplateBootstrapService.SLUG },
    });
    if (existing) return false;

    // Never claim the default slot if another template already holds it, or two
    // templates would resolve for the same exam.
    const otherDefault = await this.prisma.certificateTemplate.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });

    // `createdById` has to point at a real user; the oldest admin is the most
    // sensible author. Without one, skip seeding rather than store a fake id.
    const owner = await this.prisma.user.findFirst({
      where: { roles: { some: { role: { name: 'SUPER_ADMIN' } } } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!owner) return false;

    const created = await this.prisma.certificateTemplate.create({
      data: {
        slug: CertificateTemplateBootstrapService.SLUG,
        name: 'Standard certificate',
        description: 'Default certificate wording, used when an exam has no template of its own.',
        status: TemplateStatus.PUBLISHED,
        isDefault: !otherDefault,
        publishedAt: new Date(),
        content: JSON.stringify(DEFAULT_TEMPLATE_CONTENT),
        design: JSON.stringify(DEFAULT_TEMPLATE_DESIGN),
        createdById: owner.id,
      },
      select: { id: true },
    });

    await this.prisma.templateRevision.create({
      data: {
        templateId: created.id,
        version: 1,
        design: JSON.stringify(DEFAULT_TEMPLATE_DESIGN),
        content: JSON.stringify(DEFAULT_TEMPLATE_CONTENT),
        status: TemplateStatus.PUBLISHED,
        note: 'Initial default template',
        authorId: owner.id,
      },
    });

    return true;
  }
}
