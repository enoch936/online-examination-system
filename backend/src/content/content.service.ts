import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TemplateStatus } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CertificateRendererService } from './certificate-renderer.service';
import {
  assertValidTemplateContent,
  assertValidTemplateDesign,
  parseTemplateContent,
  parseTemplateDesign,
  DEFAULT_TEMPLATE_CONTENT,
  DEFAULT_TEMPLATE_DESIGN,
} from './template-content.util';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export type UpsertTemplateInput = {
  slug: string;
  name: string;
  description?: string | null;
  content?: unknown;
  design?: unknown;
  note?: string | null;
};

/**
 * A preview request carries the editor's unsaved content and design. Both are
 * optional so a client can preview against the defaults, and neither is
 * persisted: nothing here touches the database.
 */
export type PreviewTemplateInput = {
  content?: unknown;
  design?: unknown;
};

export type UpsertDocumentInput = {
  key: string;
  title: string;
  description?: string | null;
  content?: unknown;
  note?: string | null;
};

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private audit(actorId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
    void this.prisma.auditLog
      .create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          before: JSON.stringify(before ?? null),
          after: JSON.stringify(after ?? null),
        },
      })
      .catch(() => undefined);
  }

  // -- Certificate templates --------------------------------------------------

  async listTemplates(includeArchived = false) {
    const templates = await this.prisma.certificateTemplate.findMany({
      where: includeArchived ? {} : { status: { not: TemplateStatus.ARCHIVED } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    // The stored blobs are opaque JSON; the editor needs the typed shape.
    return templates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      status: t.status,
      isDefault: t.isDefault,
      version: t.version,
      publishedAt: t.publishedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      content: parseTemplateContent(t.content),
      design: parseTemplateDesign(t.design),
    }));
  }

  async getTemplate(idOrSlug: string) {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!template) throw new NotFoundException('Template not found');
    return {
      ...template,
      content: parseTemplateContent(template.content),
      design: parseTemplateDesign(template.design),
    };
  }

  /**
   * Only one template may be the default, so promotion is a transaction: the
   * incumbent is cleared and the new one flagged together, leaving no window
   * where two (or zero) templates claim to be default.
   */
  async setDefaultTemplate(id: string, user: AuthenticatedUser) {
    const template = await this.prisma.certificateTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.status !== TemplateStatus.PUBLISHED) {
      throw new BadRequestException('Only a published template can be the default');
    }

    await this.prisma.$transaction([
      this.prisma.certificateTemplate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      }),
      this.prisma.certificateTemplate.update({ where: { id }, data: { isDefault: true } }),
    ]);

    this.audit(user.sub, 'CERTIFICATE_TEMPLATE_DEFAULTED', 'CERTIFICATE_TEMPLATE', id, null, { isDefault: true });
    return this.getTemplate(id);
  }

  async createTemplate(input: UpsertTemplateInput, user: AuthenticatedUser) {
    if (!SLUG_PATTERN.test(input.slug)) {
      throw new BadRequestException('slug must be lowercase words separated by hyphens');
    }
    const existing = await this.prisma.certificateTemplate.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException('A template with this slug already exists');

    const content = assertValidTemplateContent(input.content ?? {});
    const design = assertValidTemplateDesign(input.design ?? {});

    const template = await this.prisma.certificateTemplate.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        content: JSON.stringify(content),
        design: JSON.stringify(design),
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    this.audit(user.sub, 'CERTIFICATE_TEMPLATE_CREATED', 'CERTIFICATE_TEMPLATE', template.id, null, { slug: template.slug });
    return this.getTemplate(template.id);
  }

  async updateTemplate(id: string, input: UpsertTemplateInput, user: AuthenticatedUser) {
    const before = await this.prisma.certificateTemplate.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Template not found');

    if (input.slug && input.slug !== before.slug) {
      if (!SLUG_PATTERN.test(input.slug)) {
        throw new BadRequestException('slug must be lowercase words separated by hyphens');
      }
      const clash = await this.prisma.certificateTemplate.findUnique({ where: { slug: input.slug } });
      if (clash) throw new ConflictException('A template with this slug already exists');
    }

    const content = assertValidTemplateContent(input.content ?? parseTemplateContent(before.content));
    const design = assertValidTemplateDesign(input.design ?? parseTemplateDesign(before.design));

    await this.prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(input.slug && input.slug !== before.slug ? { slug: input.slug } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        content: JSON.stringify(content),
        design: JSON.stringify(design),
        // A published template keeps its status but gains a version, so
        // already-issued certificates stay pinned to the snapshot they were
        // rendered from.
        ...(before.status === TemplateStatus.PUBLISHED ? { version: { increment: 1 } } : {}),
        updatedById: user.sub,
      },
    });

    if (before.status === TemplateStatus.PUBLISHED) {
      await this.prisma.templateRevision.create({
        data: {
          templateId: id,
          version: before.version + 1,
          design: JSON.stringify(design),
          content: JSON.stringify(content),
          status: TemplateStatus.PUBLISHED,
          note: input.note ?? null,
          authorId: user.sub,
        },
      });
    }

    this.audit(user.sub, 'CERTIFICATE_TEMPLATE_UPDATED', 'CERTIFICATE_TEMPLATE', id, { version: before.version }, { content, design });
    return this.getTemplate(id);
  }

  /** Publishing snapshots the current shape, so a published template is traceable. */
  async publishTemplate(id: string, user: AuthenticatedUser, note?: string | null) {
    const template = await this.prisma.certificateTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.status === TemplateStatus.ARCHIVED) {
      throw new BadRequestException('An archived template cannot be published');
    }

    const nextVersion = template.status === TemplateStatus.PUBLISHED ? template.version + 1 : template.version;
    await this.prisma.$transaction([
      this.prisma.templateRevision.create({
        data: {
          templateId: id,
          version: nextVersion,
          design: template.design,
          content: template.content,
          status: TemplateStatus.PUBLISHED,
          note: note ?? null,
          authorId: user.sub,
        },
      }),
      this.prisma.certificateTemplate.update({
        where: { id },
        data: { status: TemplateStatus.PUBLISHED, version: nextVersion, publishedAt: new Date(), updatedById: user.sub },
      }),
    ]);

    this.audit(user.sub, 'CERTIFICATE_TEMPLATE_PUBLISHED', 'CERTIFICATE_TEMPLATE', id, { status: template.status }, { status: 'PUBLISHED', version: nextVersion });
    return this.getTemplate(id);
  }

  async archiveTemplate(id: string, user: AuthenticatedUser) {
    const template = await this.prisma.certificateTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    // Archiving a default would leave newly-issued certificates with no
    // template, silently reverting them to the built-in wording.
    if (template.isDefault) {
      throw new BadRequestException('Promote a different template to default before archiving this one');
    }

    await this.prisma.certificateTemplate.update({
      where: { id },
      data: { status: TemplateStatus.ARCHIVED, isDefault: false, updatedById: user.sub },
    });
    this.audit(user.sub, 'CERTIFICATE_TEMPLATE_ARCHIVED', 'CERTIFICATE_TEMPLATE', id, { status: template.status }, { status: 'ARCHIVED' });
    return this.getTemplate(id);
  }

  async listTemplateRevisions(id: string) {
    const template = await this.prisma.certificateTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!template) throw new NotFoundException('Template not found');
    return this.prisma.templateRevision.findMany({ where: { templateId: id }, orderBy: { version: 'desc' } });
  }

  // -- Resolution used by the certificate pipeline -----------------------------

  /**
   * The template a certificate issued for `examId` should use: the exam's own
   * pin when set, otherwise the published default. Returns `null` when nothing
   * is configured, and the caller falls back to the built-in wording.
   */
  async resolveForExam(examId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const exam = await tx.exam.findUnique({
      where: { id: examId },
      select: {
        certificateTemplate: {
          select: { id: true, slug: true, name: true, content: true, design: true, version: true },
        },
      },
    });
    const pinned = exam?.certificateTemplate;
    if (pinned) {
      return { ...pinned, content: parseTemplateContent(pinned.content), design: parseTemplateDesign(pinned.design) };
    }

    const fallback = await tx.certificateTemplate.findFirst({
      where: { isDefault: true, status: TemplateStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, slug: true, name: true, content: true, design: true, version: true },
    });
    if (!fallback) return null;
    return { ...fallback, content: parseTemplateContent(fallback.content), design: parseTemplateDesign(fallback.design) };
  }

  // -- Content documents -------------------------------------------------------

  async listDocuments() {
    return this.prisma.contentDocument.findMany({ orderBy: { key: 'asc' } });
  }

  async getDocument(key: string) {
    const document = await this.prisma.contentDocument.findUnique({ where: { key } });
    if (!document) throw new NotFoundException('Content document not found');
    return document;
  }

  async createDocument(input: UpsertDocumentInput, user: AuthenticatedUser) {
    if (!CONTENT_KEY_PATTERN.test(input.key)) {
      throw new BadRequestException('key must be lowercase words separated by dots, dashes or underscores');
    }
    const existing = await this.prisma.contentDocument.findUnique({ where: { key: input.key } });
    if (existing) throw new ConflictException('A content document with this key already exists');

    const document = await this.prisma.contentDocument.create({
      data: {
        key: input.key,
        title: input.title,
        description: input.description ?? null,
        content: JSON.stringify(input.content ?? {}),
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    this.audit(user.sub, 'CONTENT_DOCUMENT_CREATED', 'CONTENT_DOCUMENT', document.id, null, { key: document.key });
    return document;
  }

  async updateDocument(key: string, input: UpsertDocumentInput, user: AuthenticatedUser) {
    const before = await this.prisma.contentDocument.findUnique({ where: { key } });
    if (!before) throw new NotFoundException('Content document not found');

    const document = await this.prisma.contentDocument.update({
      where: { key },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.content !== undefined ? { content: JSON.stringify(input.content) } : {}),
        updatedById: user.sub,
      },
    });
    this.audit(user.sub, 'CONTENT_DOCUMENT_UPDATED', 'CONTENT_DOCUMENT', document.id, { version: before.version }, { version: before.version });
    return document;
  }

  async publishDocument(key: string, user: AuthenticatedUser, note?: string | null) {
    const document = await this.prisma.contentDocument.findUnique({ where: { key } });
    if (!document) throw new NotFoundException('Content document not found');

    const nextVersion = document.status === 'PUBLISHED' ? document.version + 1 : document.version;
    await this.prisma.$transaction([
      this.prisma.contentRevision.create({
        data: {
          documentId: document.id,
          version: nextVersion,
          content: document.content,
          status: 'PUBLISHED',
          note: note ?? null,
          authorId: user.sub,
        },
      }),
      this.prisma.contentDocument.update({
        where: { key },
        data: { status: 'PUBLISHED', version: nextVersion, publishedAt: new Date(), updatedById: user.sub },
      }),
    ]);

    this.audit(user.sub, 'CONTENT_DOCUMENT_PUBLISHED', 'CONTENT_DOCUMENT', document.id, { status: document.status }, { status: 'PUBLISHED', version: nextVersion });
    return this.getDocument(key);
  }

  async archiveDocument(key: string, user: AuthenticatedUser) {
    const document = await this.prisma.contentDocument.findUnique({ where: { key } });
    if (!document) throw new NotFoundException('Content document not found');
    const updated = await this.prisma.contentDocument.update({
      where: { key },
      data: { status: 'ARCHIVED', updatedById: user.sub },
    });
    this.audit(user.sub, 'CONTENT_DOCUMENT_ARCHIVED', 'CONTENT_DOCUMENT', document.id, { status: document.status }, { status: 'ARCHIVED' });
    return updated;
  }

  async listDocumentRevisions(key: string) {
    const document = await this.prisma.contentDocument.findUnique({ where: { key }, select: { id: true } });
    if (!document) throw new NotFoundException('Content document not found');
    return this.prisma.contentRevision.findMany({ where: { documentId: document.id }, orderBy: { version: 'desc' } });
  }

  /**
   * Roll a document back to an earlier revision by copying the old content into
   * a fresh DRAFT. History is never rewritten: the revision log stays
   * append-only, so a bad rollback is itself rollback-able.
   */
  async revertDocument(key: string, version: number, user: AuthenticatedUser) {
    const document = await this.prisma.contentDocument.findUnique({ where: { key } });
    if (!document) throw new NotFoundException('Content document not found');

    const revision = await this.prisma.contentRevision.findUnique({
      where: { documentId_version: { documentId: document.id, version } },
    });
    if (!revision) throw new NotFoundException('Revision not found');

    const updated = await this.prisma.contentDocument.update({
      where: { key },
      data: { content: revision.content, status: 'DRAFT', updatedById: user.sub },
    });
    this.audit(
      user.sub,
      'CONTENT_DOCUMENT_REVERTED',
      'CONTENT_DOCUMENT',
      document.id,
      { version: document.version },
      { revertedTo: version },
    );
    return updated;
  }
}
