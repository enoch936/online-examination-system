/**
 * Inspects and, with --purge, removes rows left behind by an interrupted
 * `smoke-content-api.mjs` run. That script deletes its own fixtures at the end,
 * but a connection reset partway through leaves the scratch template behind, and
 * the next run then fails on the duplicate slug rather than on anything real.
 *
 *   npx tsx scripts/inspect-smoke-residue.ts [--purge]
 */
import { PrismaClient } from '@prisma/client';

const SCRATCH_SLUG = 'smoke-check-do-not-use';
const SCRATCH_KEY = 'smoke-check-do-not-use';

const prisma = new PrismaClient();
const purge = process.argv.includes('--purge');

async function main() {
  const templates = await prisma.certificateTemplate.findMany({
    where: { slug: { in: [SCRATCH_SLUG] } },
    select: { id: true, slug: true, status: true, isDefault: true, publishedAt: true },
  });
  const documents = await prisma.contentDocument.findMany({
    where: { key: { in: [SCRATCH_KEY] } },
    select: { id: true, key: true, status: true },
  });

  console.log(`scratch templates: ${JSON.stringify(templates, null, 2)}`);
  console.log(`scratch documents: ${JSON.stringify(documents, null, 2)}`);

  if (templates.length === 0 && documents.length === 0) {
    console.log('\nNo smoke-test residue.');
    return;
  }

  if (!purge) {
    console.log('\nRe-run with --purge to remove these rows.');
    return;
  }

  // A promoted scratch default would hide the real default, so restore first.
  if (templates.some((t) => t.isDefault)) {
    const real = await prisma.certificateTemplate.findFirst({
      where: { isDefault: true, slug: { notIn: [SCRATCH_SLUG] } },
      select: { id: true, slug: true },
    });
    if (real) {
      const promoted = await prisma.certificateTemplate.update({ where: { id: real.id }, data: { isDefault: true } });
      await prisma.certificateTemplate.updateMany({
        where: { id: { in: templates.map((t) => t.id) }, isDefault: true },
        data: { isDefault: false },
      });
      console.log(`\nrestored ${promoted.slug} as the default template`);
    } else {
      console.log('\nWARNING: the scratch template is the only default and no real default exists. Not touching it.');
      return;
    }
  }

  // Revisions reference the rows, so they go first.
  const revisions = await prisma.templateRevision.deleteMany({ where: { template: { slug: SCRATCH_SLUG } } });
  const docRevisions = await prisma.contentRevision.deleteMany({ where: { document: { key: SCRATCH_KEY } } });
  const delTemplates = await prisma.certificateTemplate.deleteMany({ where: { slug: SCRATCH_SLUG } });
  const delDocuments = await prisma.contentDocument.deleteMany({ where: { key: SCRATCH_KEY } });
  console.log(
    `removed ${delTemplates.count} template(s), ${revisions.count} template revision(s), ` +
      `${delDocuments.count} document(s), ${docRevisions.count} document revision(s)`,
  );

  const defaults = await prisma.certificateTemplate.findMany({
    where: { isDefault: true },
    select: { slug: true, status: true },
  });
  console.log(`defaults now: ${JSON.stringify(defaults)}`);
  if (defaults.length !== 1) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
