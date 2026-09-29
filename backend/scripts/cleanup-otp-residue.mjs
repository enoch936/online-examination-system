/**
 * Removes the database residue left behind by the reverted SMTP / one-time
 * passcode work: the live probe accounts created while smoke-testing the
 * register flow, and the two orphaned OTP tables that the reverted Prisma
 * models left behind (no down migration was ever written for them).
 *
 * This is safe to run more than once: every step is existence-checked and
 * reports what it did. It never drops or touches any real user row, and it
 * never prints the connection string it is given.
 *
 *   node scripts/cleanup-otp-residue.mjs <directDbUrl>
 */
import { PrismaClient } from '@prisma/client';

const PROBE_EMAILS = [
  'probe-test-77@example.com',
  'probe-flow-88@example.com',
  'probe-rewrite-99@example.com',
];

const OTP_TABLES = ['otp_challenges', 'otp_rate_limits'];

const [dbUrl] = process.argv.slice(2);

if (!dbUrl) {
  console.error('usage: node scripts/cleanup-otp-residue.mjs <directDbUrl>');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function existingOtpTables() {
  const rows = await prisma.$queryRawUnsafe(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any($1)`,
    OTP_TABLES,
  );
  return rows.map((r) => r.table_name);
}

async function main() {
  const host = new URL(dbUrl).hostname;
  console.log(`target database host: ${host}`);
  console.log('');

  const found = await existingOtpTables();

  console.log('probe accounts:');
  for (const email of PROBE_EMAILS) {
    const { count } = await prisma.user.deleteMany({ where: { email } });
    console.log(`  ${email} -> deleted ${count}`);
  }

  const otherProbes = await prisma.user.findMany({
    where: { email: { startsWith: 'probe-' } },
    select: { email: true },
  });
  const otherEmails = otherProbes
    .map((u) => u.email)
    .filter((e) => !PROBE_EMAILS.includes(e));
  if (otherEmails.length) {
    console.log('  other probe-* accounts left alone (review these):');
    for (const e of otherEmails) console.log(`    ${e}`);
  }

  console.log('');
  console.log('otp tables:');
  if (!found.length) {
    console.log('  none present, nothing to drop');
  } else {
    for (const table of OTP_TABLES) {
      if (!found.includes(table)) {
        console.log(`  ${table} -> not present`);
        continue;
      }
      await prisma.$executeRawUnsafe(`drop table if exists "${table}" cascade`);
      console.log(`  ${table} -> dropped`);
    }
  }

  const remaining = await existingOtpTables();
  console.log('');
  console.log(
    remaining.length
      ? `WARNING: tables still present: ${remaining.join(', ')}`
      : 'verified: no otp_challenges / otp_rate_limits tables remain',
  );
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('cleanup failed:', err.message);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
