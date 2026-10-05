/**
 * One-off: apply the contact-inbox permission grants to a database.
 *
 * Mirrors prisma/migrations/20260813000000_add_contact_permissions/migration.sql
 * exactly, but through the Prisma client so each step is observable. Idempotent.
 *
 *   node scripts/grant-contact-permissions.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: 'contact.read', label: 'Read contact messages', module: 'contact' },
  { key: 'contact.manage', label: 'Manage contact messages', module: 'contact' },
];

// SUPER_ADMIN + ADMIN run the inbox; INSTRUCTOR keeps read-only access.
const GRANTS = {
  SUPER_ADMIN: ['contact.read', 'contact.manage'],
  ADMIN: ['contact.read', 'contact.manage'],
  INSTRUCTOR: ['contact.read'],
};

for (const permission of PERMISSIONS) {
  const row = await prisma.permission.upsert({
    where: { key: permission.key },
    update: { label: permission.label, module: permission.module },
    create: permission,
  });
  console.log(`permission ${row.key} -> ${row.id}`);
}

for (const [roleName, keys] of Object.entries(GRANTS)) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.log(`role ${roleName}: not present, skipped`);
    continue;
  }
  for (const key of keys) {
    const permission = await prisma.permission.findUnique({ where: { key } });
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
    console.log(`granted ${key} to ${roleName}`);
  }
}

console.log('\nfinal state:');
for (const role of await prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } }, orderBy: { name: 'asc' } })) {
  const contact = role.rolePermissions.map((rp) => rp.permission.key).filter((k) => k.startsWith('contact')).sort();
  console.log(`  ${role.name.padEnd(12)} ${contact.join(', ') || '(none)'}`);
}

await prisma.$disconnect();
