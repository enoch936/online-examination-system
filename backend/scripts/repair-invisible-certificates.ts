/**
 * One-off repair for certificates that exist but are invisible to their owner.
 *
 * Before the fix, assigning a certificate wrote the certificate without
 * publishing the underlying result, and a student may only see certificates on
 * published results. Anything assigned that way is still stranded: the
 * certificate is real, but the dashboard never lists it.
 *
 * This publishes the results behind those certificates, using the certificate's
 * own issuedAt as the publication time so the audit trail shows the result
 * becoming visible at the moment the certificate was actually issued, rather
 * than whenever this script happened to run.
 *
 * Safe to re-run: it only touches results that are still unpublished.
 *
 * Run with:  npx tsx scripts/repair-invisible-certificates.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const stranded = await prisma.certificate.findMany({
    where: { result: { publishedAt: null } },
    select: { id: true, certificateNo: true, issuedAt: true, resultId: true, result: { select: { publishedAt: true } } },
  });

  if (stranded.length === 0) {
    console.log('No stranded certificates found. Nothing to repair.');
    return;
  }

  console.log(`Found ${stranded.length} certificate(s) on an unpublished result.`);
  for (const certificate of stranded) {
    console.log(`  ${certificate.certificateNo}  issued ${certificate.issuedAt.toISOString()}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: no changes made.');
    return;
  }

  // Grouped by result so two certificates on one result update it once.
  const publishedByResult = new Map<string, Date>();
  for (const certificate of stranded) {
    const existing = publishedByResult.get(certificate.resultId);
    if (!existing || certificate.issuedAt < existing) {
      publishedByResult.set(certificate.resultId, certificate.issuedAt);
    }
  }

  let updated = 0;
  for (const [resultId, publishedAt] of publishedByResult) {
    await prisma.result.update({ where: { id: resultId }, data: { publishedAt } });
    updated += 1;
  }

  const stillStranded = await prisma.certificate.count({ where: { result: { publishedAt: null } } });
  console.log(`\nPublished ${updated} result(s). Certificates still stranded: ${stillStranded}.`);
  if (stillStranded > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
