/**
 * Reproduces the student certificate dashboard request as a real student.
 *
 * The page renders a client-side fetch against /api/v1/certificates, so an
 * unauthenticated probe of the HTML proves nothing about whether the list loads.
 * This signs a short-lived token for a real STUDENT and calls the same endpoint
 * through the same-origin proxy, printing the status and the body so a failure
 * names the actual cause.
 *
 *   node scripts/probe-student-certificates.mjs <directDbUrl> <jwtSecret> <baseUrl>
 */
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

const [directUrl, accessSecret, base] = process.argv.slice(2);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

function signAccessToken(payload, secret, lifetimeSeconds = 900) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + lifetimeSeconds });
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}

const students = await prisma.user.findMany({
  where: { roles: { some: { role: { name: 'STUDENT' } } } },
  select: { id: true, email: true, status: true },
  orderBy: { email: 'asc' },
  take: 20,
});

// Certificate lives on Result, and Result.studentId points at User, so the
// counts are grouped by studentId rather than through a relation on User.
const resultsByStudent = await prisma.result.groupBy({
  by: ['studentId'],
  _count: { _all: true },
});
const resultCount = new Map(resultsByStudent.map((r) => [r.studentId, r._count._all]));

const certs = await prisma.certificate.findMany({
  select: {
    certificateNo: true,
    result: { select: { studentId: true, publishedAt: true } },
  },
});
const perStudent = new Map();
for (const c of certs) {
  const entry = perStudent.get(c.result.studentId) ?? { total: 0, stranded: 0 };
  entry.total += 1;
  if (!c.result.publishedAt) entry.stranded += 1;
  perStudent.set(c.result.studentId, entry);
}

console.log(`students found: ${students.length}`);
for (const s of students) {
  const entry = perStudent.get(s.id) ?? { total: 0, stranded: 0 };
  console.log(
    `  ${s.email}  status=${s.status}  results=${resultCount.get(s.id) ?? 0}  certificates=${entry.total}  stranded=${entry.stranded}`,
  );
}

for (const student of students) {
  const token = signAccessToken(
    { sub: student.id, email: student.email, roles: ['STUDENT'], permissions: [] },
    accessSecret,
  );
  const started = Date.now();
  try {
    const res = await fetch(`${base}/api/v1/certificates?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    console.log(`\n${student.email} -> ${res.status} in ${Date.now() - started}ms`);
    if (res.status !== 200) {
      console.log(`  body: ${text.slice(0, 400)}`);
    } else {
      const parsed = JSON.parse(text);
      const list = parsed?.data?.data ?? [];
      console.log(`  certificates returned: ${list.length} (total ${parsed?.data?.pagination?.total})`);
      for (const c of list) {
        console.log(`    ${c.certificateNo}  ${c.result?.exam?.title ?? '(no exam)'}  ${c.expired ? 'expired' : 'valid'}`);
      }
    }
  } catch (error) {
    console.log(`\n${student.email} -> THREW after ${Date.now() - started}ms: ${error?.cause?.code ?? error?.message}`);
  }
}

await prisma.$disconnect();
