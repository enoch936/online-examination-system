/**
 * DB utility: list users or reset a user's password (and force ACTIVE).
 *
 *   node scripts/reset-password.mjs <directDbUrl>
 *       -> lists all users (id, email, status, roles, has-password)
 *   node scripts/reset-password.mjs <directDbUrl> <email> <newPassword>
 *       -> bcrypt-hashes with BCRYPT_ROUNDS (default 12, same as the app) and
 *          updates passwordHash + status=ACTIVE, mirroring the app's hashing.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const [directUrl, email, rawPassword] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const list = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      status: true,
      passwordHash: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  console.log('users:');
  users.forEach((u) =>
    console.log(
      `  ${u.email.padEnd(30)} ${u.status.padEnd(20)} hasPw=${u.passwordHash ? 'yes' : 'no'} ` +
        `roles=${u.roles.map((r) => r.role.name).join(',')}`,
    ),
  );
};

if (!email || !rawPassword) {
  await list();
  await prisma.$disconnect();
  process.exit(0);
}

const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`no user with email "${email}"`);
  await prisma.$disconnect();
  process.exit(1);
}
const passwordHash = await bcrypt.hash(rawPassword, rounds);
await prisma.user.update({ where: { id: user.id }, data: { passwordHash, status: 'ACTIVE' } });
console.log(`RESET OK: ${email} -> status=ACTIVE, bcrypt(rounds=${rounds})`);

await prisma.$disconnect();