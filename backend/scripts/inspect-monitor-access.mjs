/**
 * Reports who can actually open live monitoring, and what state the exams are
 * in. Read-only.
 *
 *   node scripts/inspect-monitor-access.mjs <directDbUrl>
 */
import { PrismaClient } from '@prisma/client';

const [directUrl] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const roles = await prisma.role.findMany({
  select: {
    name: true,
    rolePermissions: { select: { permission: { select: { key: true } } } },
  },
  orderBy: { name: 'asc' },
});

console.log('=== roles and whether they can monitor live ===');
for (const role of roles) {
  const keys = role.rolePermissions.map((p) => p.permission.key);
  const canMonitor = keys.includes('sessions.monitor');
  console.log(`  ${role.name.padEnd(12)} sessions.monitor=${canMonitor ? 'YES' : 'no '}  (${keys.length} permissions)`);
}

console.log('\n=== active staff accounts ===');
const staff = await prisma.user.findMany({
  where: { status: 'ACTIVE', roles: { some: { role: { name: { in: ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'] } } } } },
  select: {
    email: true,
    roles: {
      select: {
        role: {
          select: {
            name: true,
            rolePermissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    },
  },
});
for (const user of staff) {
  const keys = user.roles.flatMap((r) => r.role.rolePermissions.map((p) => p.permission.key));
  console.log(`  ${user.email.padEnd(38)} roles=${user.roles.map((r) => r.role.name).join('/')}  canMonitor=${keys.includes('sessions.monitor')}`);
}
if (staff.length === 0) console.log('  (none)');

console.log('\n=== exams by status ===');
const exams = await prisma.exam.findMany({
  select: { id: true, title: true, status: true, startsAt: true, _count: { select: { sessions: true } } },
  orderBy: { createdAt: 'desc' },
  take: 25,
});
const byStatus = new Map();
for (const e of exams) {
  byStatus.set(e.status, (byStatus.get(e.status) ?? 0) + 1);
}
for (const [status, count] of byStatus) console.log(`  ${status.padEnd(10)} ${count}`);
console.log('');
for (const e of exams) {
  console.log(`  [${e.status.padEnd(9)}] "${e.title}"  sessions=${e._count.sessions}  starts=${e.startsAt?.toISOString() ?? '-'}`);
}

console.log('\n=== live/in-progress sessions right now ===');
const live = await prisma.examSession.findMany({
  where: { status: { in: ['IN_PROGRESS', 'PAUSED'] } },
  select: {
    id: true,
    status: true,
    startedAt: true,
    lastActivityAt: true,
    exam: { select: { title: true } },
    student: { select: { email: true } },
  },
  take: 25,
});
if (live.length === 0) {
  console.log('  (none — no student is currently taking an exam)');
} else {
  for (const s of live) {
    console.log(`  ${s.status.padEnd(12)} ${s.student.email.padEnd(34)} "${s.exam.title}"`);
  }
}

await prisma.$disconnect();
