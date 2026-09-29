/**
 * Explains a 401 "Account is not active" on the student certificates page.
 *
 * Prisma's @unique on User.email is case-sensitive, so Postgres happily stores
 * two rows that differ only in case. A login that matches the lowercased
 * address can then land on the shadowed, inactive row and every subsequent
 * request 401s — which the page surfaces as "Could not load certificates".
 *
 *   node scripts/inspect-student-login.mjs <directDbUrl>
 */
import { PrismaClient } from '@prisma/client';

const [directUrl] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const students = await prisma.user.findMany({
  where: { roles: { some: { role: { name: 'STUDENT' } } } },
  select: {
    id: true,
    email: true,
    status: true,
    emailVerifiedAt: true,
    lastLoginAt: true,
    createdAt: true,
    roles: { select: { role: { select: { name: true } } } },
  },
  orderBy: { createdAt: 'desc' },
});

console.log(`=== ${students.length} student accounts ===`);
for (const s of students) {
  const roles = s.roles.map((r) => r.role.name).join(',');
  console.log(
    `  ${s.email.padEnd(38)} status=${s.status.padEnd(21)} verified=${s.emailVerifiedAt ? 'yes' : 'no '} lastLogin=${s.lastLoginAt?.toISOString() ?? 'never'}  roles=${roles}`,
  );
  if (s.status !== 'ACTIVE') console.log(`      id=${s.id}  created=${s.createdAt.toISOString()}`);
}

// Postgres is case-sensitive on @unique; group the raw values ourselves.
const byLower = new Map();
for (const s of students) {
  const key = s.email.toLowerCase();
  byLower.set(key, [...(byLower.get(key) ?? []), s]);
}

console.log('\n=== case-insensitive collisions ===');
let collisions = 0;
for (const [key, group] of byLower) {
  if (group.length > 1) {
    collisions += 1;
    console.log(`  ${key} has ${group.length} rows:`);
    for (const s of group) {
      console.log(`    ${s.email}  status=${s.status}  id=${s.id}  lastLogin=${s.lastLoginAt?.toISOString() ?? 'never'}`);
    }
  }
}
if (collisions === 0) console.log('  none');

await prisma.$disconnect();
