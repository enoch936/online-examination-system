import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CertificateTemplateBootstrapService } from './certificate-template.bootstrap';
import { ContentService } from './content.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

/**
 * Fake-Prisma tests pin the decision logic and write shapes: which template wins
 * for an exam, that promoting a default clears the previous one, that publishing
 * appends a revision. The real unique constraints and the transactional swap are
 * proved against Postgres in scripts/verify-e2e.ts.
 */

const admin = { sub: 'admin-1', roles: ['SUPER_ADMIN'] } as unknown as AuthenticatedUser;

interface FakePrisma {
  certificateTemplate: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  templateRevision: { create: jest.Mock; findMany: jest.Mock };
  contentDocument: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  contentRevision: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
  exam: { findUnique: jest.Mock };
  user: { findFirst: jest.Mock };
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
}

function makeService() {
  const prisma: FakePrisma = {
    certificateTemplate: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    templateRevision: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    contentDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    contentRevision: { create: jest.fn().mockResolvedValue({}), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    exam: { findUnique: jest.fn() },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    // Run the callback against the same fake so transactional code is exercised.
    $transaction: jest.fn((arg: unknown) => (typeof arg === 'function' ? (arg as (tx: FakePrisma) => unknown)(prisma) : Promise.all(arg as unknown[]))),
  };
  const service = new ContentService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const templateRow = (over: Record<string, unknown> = {}) => ({
  id: 'tpl-1',
  slug: 'standard',
  name: 'Standard',
  description: null,
  status: 'PUBLISHED',
  isDefault: true,
  version: 1,
  publishedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  content: JSON.stringify({ title: 'Award' }),
  design: JSON.stringify({ accentColor: '#123456' }),
  createdById: 'admin-1',
  updatedById: 'admin-1',
  ...over,
});

describe('ContentService.createTemplate', () => {
  it('rejects a malformed slug', async () => {
    const { service } = makeService();
    await expect(service.createTemplate({ slug: 'Not A Slug', name: 'x' }, admin)).rejects.toThrow(/lowercase words/);
  });

  it('rejects a duplicate slug rather than relying on the DB error', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow());

    await expect(service.createTemplate({ slug: 'standard', name: 'x' }, admin)).rejects.toThrow(ConflictException);
    expect(prisma.certificateTemplate.create).not.toHaveBeenCalled();
  });

  it('validates the content before writing', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(null);

    await expect(service.createTemplate({ slug: 'new-one', name: 'x', design: { accentColor: 'blue' } }, admin)).rejects.toThrow(
      /hex colour/,
    );
    expect(prisma.certificateTemplate.create).not.toHaveBeenCalled();
  });
});

describe('ContentService.setDefaultTemplate', () => {
  it('refuses to promote an unpublished template', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow({ status: 'DRAFT' }));

    await expect(service.setDefaultTemplate('tpl-1', admin)).rejects.toThrow(/published template/);
  });

  it('clears the incumbent default in the same transaction', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow());
    prisma.certificateTemplate.findFirst.mockResolvedValue(templateRow());

    await service.setDefaultTemplate('tpl-1', admin);

    expect(prisma.certificateTemplate.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true, id: { not: 'tpl-1' } },
      data: { isDefault: false },
    });
  });
});

describe('ContentService.archiveTemplate', () => {
  it('refuses to archive the default template', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow({ isDefault: true }));

    await expect(service.archiveTemplate('tpl-1', admin)).rejects.toThrow(/Promote a different template/);
    expect(prisma.certificateTemplate.update).not.toHaveBeenCalled();
  });

  it('archives a non-default template', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow({ isDefault: false }));
    prisma.certificateTemplate.update.mockResolvedValue(templateRow({ isDefault: false, status: 'ARCHIVED' }));
    prisma.certificateTemplate.findFirst.mockResolvedValue(templateRow({ isDefault: false, status: 'ARCHIVED' }));

    await service.archiveTemplate('tpl-1', admin);

    expect(prisma.certificateTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ARCHIVED', isDefault: false }) }),
    );
  });
});

describe('ContentService.publishTemplate', () => {
  it('appends a revision and stamps publishedAt', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow({ status: 'DRAFT', version: 1 }));
    prisma.certificateTemplate.findFirst.mockResolvedValue(templateRow({ status: 'DRAFT', version: 1 }));

    await service.publishTemplate('tpl-1', admin, 'first publish');

    expect(prisma.templateRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 1, note: 'first publish' }) }),
    );
    expect(prisma.certificateTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }),
    );
  });

  it('increments the version when republishing a published template', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow({ status: 'PUBLISHED', version: 4 }));
    prisma.certificateTemplate.findFirst.mockResolvedValue(templateRow({ status: 'PUBLISHED', version: 4 }));

    await service.publishTemplate('tpl-1', admin);

    expect(prisma.certificateTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 5 }) }),
    );
  });

  it('refuses to publish an archived template', async () => {
    const { service, prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow({ status: 'ARCHIVED' }));

    await expect(service.publishTemplate('tpl-1', admin)).rejects.toThrow(/archived/);
    expect(prisma.templateRevision.create).not.toHaveBeenCalled();
  });
});

describe('ContentService.resolveForExam', () => {
  it('prefers the exam-pinned template over the default', async () => {
    const { service, prisma } = makeService();
    const pinned = templateRow({ id: 'tpl-pinned', slug: 'pinned' });
    prisma.exam.findUnique.mockResolvedValue({ certificateTemplate: pinned });

    const resolved = await service.resolveForExam('exam-1');

    expect(resolved?.id).toBe('tpl-pinned');
    // The default lookup must not even run once a pin is found.
    expect(prisma.certificateTemplate.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the published default when the exam has no pin', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({ certificateTemplate: null });
    prisma.certificateTemplate.findFirst.mockResolvedValue(templateRow({ id: 'tpl-default' }));

    const resolved = await service.resolveForExam('exam-1');

    expect(resolved?.id).toBe('tpl-default');
    expect(prisma.certificateTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isDefault: true, status: 'PUBLISHED' } }),
    );
  });

  it('returns null when neither a pin nor a default exists', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({ certificateTemplate: null });
    prisma.certificateTemplate.findFirst.mockResolvedValue(null);

    expect(await service.resolveForExam('exam-1')).toBeNull();
  });

  it('parses the stored content blob into the typed shape', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({ certificateTemplate: templateRow({ content: JSON.stringify({ title: 'X' }) }) });

    const resolved = await service.resolveForExam('exam-1');

    expect(typeof resolved?.content).toBe('object');
    expect(resolved?.content).toHaveProperty('title', 'X');
    // Defaults are filled for anything the stored blob left out.
    expect(resolved?.content).toHaveProperty('introText');
  });
});

describe('CertificateTemplateBootstrapService', () => {
  it('creates the published default when none exists', async () => {
    const { prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(null);
    prisma.certificateTemplate.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
    prisma.certificateTemplate.create.mockResolvedValue(templateRow());

    const bootstrap = new CertificateTemplateBootstrapService(prisma as unknown as PrismaService);
    expect(await bootstrap.ensure()).toBe(true);

    expect(prisma.certificateTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'standard', status: 'PUBLISHED', isDefault: true }),
      }),
    );
  });

  it('never overwrites an existing standard template', async () => {
    const { prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(templateRow());

    const bootstrap = new CertificateTemplateBootstrapService(prisma as unknown as PrismaService);
    expect(await bootstrap.ensure()).toBe(false);
    expect(prisma.certificateTemplate.create).not.toHaveBeenCalled();
  });

  it('does not claim the default slot if another template already holds it', async () => {
    const { prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(null);
    prisma.certificateTemplate.findFirst.mockResolvedValue({ id: 'other-default' });
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
    prisma.certificateTemplate.create.mockResolvedValue(templateRow());

    const bootstrap = new CertificateTemplateBootstrapService(prisma as unknown as PrismaService);
    await bootstrap.ensure();

    expect(prisma.certificateTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDefault: false }) }),
    );
  });

  it('does not seed without a real author to attribute it to', async () => {
    const { prisma } = makeService();
    prisma.certificateTemplate.findUnique.mockResolvedValue(null);
    prisma.certificateTemplate.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);

    const bootstrap = new CertificateTemplateBootstrapService(prisma as unknown as PrismaService);
    expect(await bootstrap.ensure()).toBe(false);
    expect(prisma.certificateTemplate.create).not.toHaveBeenCalled();
  });
});

describe('ContentService.revertDocument', () => {
  it('copies the old revision into a new draft', async () => {
    const { service, prisma } = makeService();
    prisma.contentDocument.findUnique.mockResolvedValue({ id: 'doc-1', key: 'home.hero', version: 3, content: '{}' });
    prisma.contentRevision.findUnique.mockResolvedValue({ version: 1, content: '{"old":true}' });
    prisma.contentDocument.update.mockResolvedValue({ id: 'doc-1', version: 3, content: '{"old":true}' });

    await service.revertDocument('home.hero', 1, admin);

    expect(prisma.contentDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'home.hero' }, data: expect.objectContaining({ content: '{"old":true}', status: 'DRAFT' }) }),
    );
  });

  it('throws when the revision does not exist', async () => {
    const { service, prisma } = makeService();
    prisma.contentDocument.findUnique.mockResolvedValue({ id: 'doc-1', key: 'home.hero', version: 3, content: '{}' });
    prisma.contentRevision.findUnique.mockResolvedValue(null);

    await expect(service.revertDocument('home.hero', 99, admin)).rejects.toThrow(NotFoundException);
  });
});

describe('ContentService.createDocument', () => {
  it('rejects a malformed key', async () => {
    const { service } = makeService();
    await expect(service.createDocument({ key: 'Bad Key', title: 'x' }, admin)).rejects.toThrow(BadRequestException);
  });

  it('rejects a duplicate key', async () => {
    const { service, prisma } = makeService();
    prisma.contentDocument.findUnique.mockResolvedValue({ id: 'doc-1', key: 'home.hero' });

    await expect(service.createDocument({ key: 'home.hero', title: 'x' }, admin)).rejects.toThrow(ConflictException);
  });
});
