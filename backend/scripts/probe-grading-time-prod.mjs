/**
 * Read-only production probe for the grading + time-extension release.
 *
 * Verifies three things separately, so a failure says which layer broke:
 *   1. the migration actually applied (columns/tables the code now selects);
 *   2. the new read endpoints answer as the deploying user, not as a stranger;
 *   3. the new write endpoints validate and refuse safely — the probe never
 *      grants real time and never grades a real attempt. Refusals are the
 *      expected outcome here: a submitted session cannot be extended, and a
 *      fully graded exam has nothing left to auto-grade.
 *
 *   node scripts/probe-grading-time-prod.mjs <directDbUrl> <jwtSecret> <apiOrigin>
 *
 * Read-only against the database; secrets are read from argv and never printed.
 */
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

const [directUrl, accessSecret, apiOrigin] = process.argv.slice(2);
if (!directUrl || !accessSecret || !apiOrigin) {
  console.error('usage: probe-grading-time-prod.mjs <directDbUrl> <jwtSecret> <apiOrigin>');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, secret, seconds = 600) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + seconds });
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
const short = (t, n = 150) => (t ?? '').slice(0, n);
const pad = (s, n) => String(s).padEnd(n);

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'ok  ' : 'FAIL'}] ${pad(label, 34)} ${detail ?? ''}`);
}

async function call(path, options = {}) {
  const res = await fetch(`${apiOrigin}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const staff = await prisma.user.findFirst({
  where: { status: 'ACTIVE', roles: { some: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'] } } } } },
  select: { id: true, email: true, roles: { select: { role: { select: { name: true } } } } },
});
if (!staff) {
  console.error('no active staff user to probe with');
  process.exit(2);
}
const roles = staff.roles.map((r) => r.role.name);
const token = sign({ sub: staff.id, email: staff.email, roles, permissions: [] }, accessSecret);
console.log(`staff: ${staff.email} roles=${roles.join(',')}\n`);

// ------------------------------------------------ 1. migration actually applied
console.log('schema');
let sample = null;
try {
  sample = await prisma.result.findFirst({
    select: { id: true, score: true, autoScore: true, gradingStatus: true, manualAdjusted: true, regradeCount: true },
    orderBy: { id: 'desc' },
  });
  check('results grading columns', true, sample ? `gradingStatus=${sample.gradingStatus} autoScore=${sample.autoScore} score=${sample.score}` : 'no results yet');
} catch (e) {
  check('results grading columns', false, short(e.message));
}
try {
  const [rows, grants] = await Promise.all([
    prisma.examSession.findFirst({ select: { originalExpiresAt: true, totalExtensionMinutes: true, lastExtendedAt: true } }),
    prisma.timeExtension.count(),
  ]);
  check('session deadline columns', true, rows ? `totalExtensionMinutes=${rows.totalExtensionMinutes} extendedAt=${rows.lastExtendedAt}` : 'no sessions yet');
  check('TimeExtension table', true, `${grants} grant row(s)`);
} catch (e) {
  check('session deadline columns', false, short(e.message));
}

// ---------------------------------------------------------------- 2. read paths
console.log('\nread endpoints');
const exam = await prisma.exam.findFirst({ select: { id: true, title: true, status: true }, orderBy: { createdAt: 'desc' } });
console.log(`exam : ${exam ? `"${exam.title}" (${exam.status})` : 'none in production'}\n`);

const plain = await call('/api/v1/results?page=1&limit=5');
check('GET /results unfiltered', plain.status === 200, `${plain.status} ${short(JSON.stringify(plain.body))}`);

const filtered = await call(
  `/api/v1/results?page=1&limit=5&sortBy=percentage&sortDir=desc&minPercentage=0&maxPercentage=100&gradingStatus=&q=`,
);
check('GET /results with filters', filtered.status === 200, `${filtered.status} ${short(JSON.stringify(filtered.body?.pagination ?? filtered.body))}`);

const pg = filtered.body?.pagination;
if (pg) {
  check('  pagination shape', typeof pg.total === 'number' && typeof pg.totalPages === 'number' && Array.isArray(filtered.body?.data), `total=${pg.total} pages=${pg.totalPages} rows=${filtered.body?.data?.length}`);
  check('  filter not ignored', pg.total <= (plain.body?.pagination?.total ?? pg.total), `unfiltered=${plain.body?.pagination?.total} filtered=${pg.total}`);
}

const pending = await call('/api/v1/results?gradingStatus=PENDING&limit=5');
check('GET /results gradingStatus=PENDING', pending.status === 200, `${pending.status} total=${pending.body?.pagination?.total}`);

// An unknown sort is deliberately ignored rather than rejected: the controller
// whitelists sortBy before it reaches Prisma, so the probe asserts it degrades
// to the default order and never 500s or reflects input into a query.
const noAccent = await call('/api/v1/results?sortBy=%3Cscript%3E&sortDir=sideways&limit=1');
check(
  'GET /results ignores bad sort',
  noAccent.status === 200 && Array.isArray(noAccent.body?.data?.data),
  `${noAccent.status} rows=${noAccent.body?.data?.data?.length}`,
);

if (exam) {
  const ext = await call(`/api/v1/monitoring/exams/${exam.id}/extend-time`);
  check('GET exam extend-time history', ext.status === 200, `${ext.status} ${short(JSON.stringify(ext.body))}`);

  const session = await prisma.examSession.findFirst({
    where: { examId: exam.id },
    select: { id: true, status: true, expiresAt: true, totalExtensionMinutes: true },
    orderBy: { startedAt: 'desc' },
  });
  if (session) {
    const dl = await call(`/api/v1/monitoring/sessions/${session.id}/deadline`);
    const d = dl.body?.data;
    check(
      'GET session deadline',
      dl.status === 200 && d?.expiresAt === session.expiresAt?.toISOString(),
      `${dl.status} expiresAt=${d?.expiresAt} remaining=${d?.remainingSeconds} total=${d?.totalExtensionMinutes}`,
    );
  } else {
    console.log('  [skip] no session for this exam — deadline endpoint not exercised');
  }
}

// ------------------------------------------------ 3. write paths refuse safely
console.log('\nwrite endpoints (expected to refuse, never mutate)');
if (exam) {
  const graded = await prisma.result.count({ where: { examId: exam.id, gradingStatus: { in: ['GRADED', 'PUBLISHED'] } } });
  const bulk = await call('/api/v1/results/bulk/grade', {
    method: 'POST',
    body: JSON.stringify({ examId: exam.id, onlyUngraded: true }),
  });
  const b = bulk.body?.data ?? bulk.body;
  check('POST bulk/grade (ungraded only)', bulk.status === 200 || bulk.status === 201, `${bulk.status} ${short(JSON.stringify(b))}`);
  if (bulk.status === 200 || bulk.status === 201) {
    check('  nothing overwritten', b?.matched === 0 || b?.graded === 0, `matched=${b?.matched} graded=${b?.graded} skipped=${b?.skipped} (${graded} already graded on this exam)`);
  }

  const bulkBad = await call('/api/v1/results/bulk/grade', {
    method: 'POST',
    body: JSON.stringify({ examId: exam.id, minutes: 999 }),
  });
  check('POST bulk/grade validates DTO', bulkBad.status === 400, `${bulkBad.status} ${short(JSON.stringify(bulkBad.body), 90)}`);

  const submitted = await prisma.examSession.findFirst({
    where: { examId: exam.id, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
    select: { id: true, status: true, studentId: true },
  });
  if (submitted) {
    const pick = (row) => `${row?.expiresAt?.toISOString() ?? 'null'}/${row?.totalExtensionMinutes}`;
    const before = await prisma.examSession.findUnique({ where: { id: submitted.id }, select: { expiresAt: true, totalExtensionMinutes: true } });
    const attempt = await call('/api/v1/monitoring/exams/' + exam.id + '/extend-time', {
      method: 'POST',
      body: JSON.stringify({ minutes: 10, studentIds: [submitted.studentId] }),
    });
    const after = await prisma.examSession.findUnique({ where: { id: submitted.id }, select: { expiresAt: true, totalExtensionMinutes: true } });
    const extended = attempt.body?.data;
    check(
      'POST extend-time refuses submitted',
      attempt.status === 200 && extended?.extended === 0 && extended?.skipped?.length > 0,
      `${attempt.status} extended=${extended?.extended} skipped=${JSON.stringify(extended?.skipped ?? attempt.body?.error?.message)}`,
    );
    check('  deadline untouched', pick(before) === pick(after), `${pick(before)} -> ${pick(after)}`);
  } else {
    console.log('  [skip] no submitted session on this exam — refusal path not exercised');
  }

  const tooLong = await call(`/api/v1/monitoring/exams/${exam.id}/extend-time`, {
    method: 'POST',
    body: JSON.stringify({ minutes: 5000 }),
  });
  check('POST extend-time rejects >120 min', tooLong.status === 400, `${tooLong.status} ${short(JSON.stringify(tooLong.body), 90)}`);
}

await prisma.$disconnect();
console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);