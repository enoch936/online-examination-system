import { createHmac } from 'node:crypto';

/**
 * Read-only production check for the analytics endpoints. Mints a short-lived
 * token per role the same way the other probes do, then asserts the shape of
 * the response and, critically, that scoping actually differs by role: a
 * student's payload must never contain another candidate's numbers.
 *
 * Usage: node scripts/probe-analytics-prod.mjs <DIRECT_DATABASE_URL> <JWT_ACCESS_SECRET> [baseUrl]
 */

const dbUrl = process.argv[2];
const accessSecret = process.argv[3];
const base = (process.argv[4] ?? 'https://oes-backend-nrpu.onrender.com').replace(/\/$/, '');

if (!dbUrl || !accessSecret) {
  console.error('usage: node scripts/probe-analytics-prod.mjs <dbUrl> <secret> [baseUrl]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
const ok = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sign(payload, seconds = 600) {
  const now = Math.floor(Date.now() / 1000);
  const body =
    b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + seconds });
  return body + '.' + createHmac('sha256', accessSecret).update(body).digest('base64url');
}

async function api(path, token) {
  const res = await fetch(`${base}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

try {
  // `status: 'ACTIVE'` matters: the JWT strategy re-checks it, so probing with a
  // suspended or unverified account returns 401 and looks like a missing route.
  const [staff, student] = await Promise.all([
    prisma.user.findFirst({
      where: {
        status: 'ACTIVE',
        roles: { some: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } } },
      },
      select: { id: true, email: true },
    }),
    // Deliberately a student who has actually sat exams: probing scoping with an
    // account that owns nothing would pass even if the filter were missing.
// `Result.studentId` has no inverse relation field in the schema, so the
    // candidate is found by scanning real attempts rather than filtering users.
    (async () => {
      const attempts = await prisma.result.findMany({
        select: { studentId: true },
        distinct: ['studentId'],
        take: 50,
      });
      for (const attempt of attempts) {
        const candidate = await prisma.user.findFirst({
          where: {
            id: attempt.studentId,
            status: 'ACTIVE',
            roles: { some: { role: { name: 'STUDENT' } } },
          },
          select: { id: true, email: true },
        });
        if (candidate) return candidate;
      }
      return prisma.user.findFirst({
        where: { status: 'ACTIVE', roles: { some: { role: { name: 'STUDENT' } } } },
        select: { id: true, email: true },
      });
    })(),
  ]);

  if (!staff) {
    console.log('no admin/instructor account found to probe with');
    process.exit(0);
  }
  const staffToken = sign({ sub: staff.id, email: staff.email, roles: ['SUPER_ADMIN'], permissions: [] });
  const studentToken = student
    ? sign({ sub: student.id, email: student.email, roles: ['STUDENT'], permissions: [] })
    : null;

  console.log(`probing ${base}`);

  const admin = await api('/analytics/overview', staffToken);
  ok('admin overview responds 200', admin.status === 200, `status=${admin.status}`);
  const data = admin.body?.data ?? {};
  ok('admin overview reports ADMIN audience', data.audience === 'ADMIN', `audience=${data.audience}`);
  ok(
    'metrics block is complete',
    ['totalExams', 'passRate', 'pendingGrading', 'averagePercentage', 'violations24h'].every(
      (key) => typeof data.metrics?.[key] === 'number',
    ),
  );
  ok(
    'pass rate is a percentage, not a fraction or NaN',
    typeof data.metrics?.passRate === 'number' &&
      data.metrics.passRate >= 0 &&
      data.metrics.passRate <= 100 &&
      !Number.isNaN(data.metrics.passRate),
    `passRate=${data.metrics?.passRate}`,
  );
  ok(
    'official attempt count never exceeds the raw count',
    typeof data.scope?.officialResultCount === 'number' &&
      data.scope.officialResultCount <= data.scope.resultCount,
    `${data.scope?.officialResultCount} of ${data.scope?.resultCount}`,
  );
  ok(
    'pass + fail equals official attempts',
    data.metrics?.passedCount + data.metrics?.failedCount === data.scope?.officialResultCount,
    `${data.metrics?.passedCount}+${data.metrics?.failedCount} vs ${data.scope?.officialResultCount}`,
  );
  ok(
    'trend has a gapless 14-day axis',
    Array.isArray(data.charts?.trend) &&
      data.charts.trend.length === 14 &&
      data.charts.trend.every((p) => typeof p.submissions === 'number'),
    `points=${data.charts?.trend?.length}`,
  );
  ok(
    'score bands are fixed and total to the official count',
    JSON.stringify(data.charts?.scoreDistribution?.map((b) => b.label)) ===
      JSON.stringify(['0-39', '40-59', '60-74', '75-89', '90-100']) &&
      data.charts.scoreDistribution.reduce((s, b) => s + b.count, 0) === data.scope.officialResultCount,
    `bands total ${data.charts?.scoreDistribution?.reduce((s, b) => s + b.count, 0)}`,
  );

  const exams = await api('/analytics/exams', staffToken);
  ok('exam breakdown responds 200', exams.status === 200, `status=${exams.status}`);
  ok(
    'every returned exam row has the fields the table renders',
    (exams.body?.data?.exams ?? []).every(
      (row) =>
        typeof row.title === 'string' &&
        typeof row.status === 'string' &&
        typeof row.averagePercentage === 'number' &&
        typeof row.pendingGrading === 'number',
    ),
    `rows=${exams.body?.data?.exams?.length ?? 0}`,
  );

  if (studentToken) {
    const asStudent = await api('/analytics/overview', studentToken);
    ok('student overview responds 200', asStudent.status === 200, `status=${asStudent.status}`);
    const sdata = asStudent.body?.data ?? {};
    ok('student overview reports STUDENT audience', sdata.audience === 'STUDENT', `audience=${sdata.audience}`);
    ok(
      'student sees strictly fewer attempts than the platform',
      sdata.scope?.resultCount > 0 && sdata.scope?.resultCount < data.scope?.resultCount,
      `student=${sdata.scope?.resultCount} vs admin=${data.scope?.resultCount}`,
    );
    const own = await prisma.result.count({ where: { studentId: student.id } });
    ok(
      'student attempt count matches their own rows exactly',
      sdata.scope?.resultCount === own,
      `payload=${sdata.scope?.resultCount} database=${own}`,
    );
    ok(
      'student pass rate is derived from their own attempts',
      sdata.metrics?.passedCount + sdata.metrics?.failedCount === sdata.scope?.officialResultCount,
      `${sdata.metrics?.passedCount}+${sdata.metrics?.failedCount} vs ${sdata.scope?.officialResultCount}`,
    );
    const studentExams = await api('/analytics/exams', studentToken);
    ok(
      'student is refused the exam breakdown',
      studentExams.status === 200 &&
        (studentExams.body?.data?.exams ?? []).length === 0,
      `status=${studentExams.status} rows=${studentExams.body?.data?.exams?.length}`,
    );
  } else {
    console.log('  --   no student account present, skipped student scoping checks');
  }

  const anon = await fetch(`${base}/api/v1/analytics/overview`);
  ok('unauthenticated analytics is rejected', anon.status === 401, `status=${anon.status}`);
} finally {
  await prisma.$disconnect();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);