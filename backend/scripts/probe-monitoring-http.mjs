/**
 * Isolates whether live monitoring is broken server-side or only on the socket.
 *
 * The monitor:join socket handler calls MonitoringService.assertCanMonitorExam.
 * If the same call fails over HTTP too, the fault is in the service (not the
 * gateway), and every monitoring route is affected, not just the live feed.
 *
 *   node scripts/probe-monitoring-http.mjs <directDbUrl> <jwtSecret> <apiOrigin>
 */
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

const [directUrl, accessSecret, apiOrigin] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, secret, seconds = 600) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + seconds });
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}

const staff = await prisma.user.findFirst({
  where: { status: 'ACTIVE', roles: { some: { role: { name: { in: ['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'] } } } } },
  select: { id: true, email: true, roles: { select: { role: { select: { name: true } } } } },
});
const roles = staff.roles.map((r) => r.role.name);
const token = sign({ sub: staff.id, email: staff.email, roles, permissions: [] }, accessSecret);
console.log(`staff: ${staff.email} roles=${roles.join(',')}`);

const exam = await prisma.exam.findFirst({ select: { id: true, title: true, status: true }, orderBy: { createdAt: 'desc' } });
console.log(`exam : "${exam.title}" (${exam.status})\n`);

for (const path of [
  `/api/v1/monitoring/exams/${exam.id}/stats`,
  `/api/v1/monitoring/exams/${exam.id}/sessions`,
  `/api/v1/monitoring/exams/${exam.id}/config`,
]) {
  const res = await fetch(`${apiOrigin}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  const label = path.split('/').pop();
  console.log(`  ${label.padEnd(8)} -> ${res.status}  ${text.slice(0, 160)}`);
}

await prisma.$disconnect();
