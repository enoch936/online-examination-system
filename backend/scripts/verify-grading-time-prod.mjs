/**
 * Production E2E for the grading + time-extension release, over real HTTP.
 *
 * The read-only probe (probe-grading-time-prod.mjs) proves the schema landed and
 * the endpoints answer, but production has no live exam to grade and no session
 * to extend, so the write paths would go unproven. This script builds its own
 * fixtures with a unique run id, drives the deployed API exactly as a student
 * and a proctor would, asserts the outcome, and deletes everything it created —
 * so it is safe to run against a populated production database.
 *
 * What it proves, in order:
 *   start -> answers -> submit produces a Result with an automatic score and a
 *   grading lifecycle; a grant moves the authoritative deadline, stacks, writes
 *   an audit row and notifies the student; bulk grading regrades without
 *   touching manual marks; a submitted session can no longer be extended.
 *
 *   node scripts/verify-grading-time-prod.mjs <directDbUrl> <jwtSecret> <apiOrigin>
 *
 * Secrets come from argv and are never printed.
 */
import { PrismaClient } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';

const [directUrl, accessSecret, apiOrigin] = process.argv.slice(2);
if (!directUrl || !accessSecret || !apiOrigin) {
  console.error('usage: verify-grading-time-prod.mjs <directDbUrl> <jwtSecret> <apiOrigin>');
  process.exit(2);
}

const RUN = randomUUID().slice(0, 8);
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });
const created = { examIds: [], userIds: [], classIds: [], bankIds: [], questionIds: [], subjectIds: [], courseIds: [] };
const track = (bucket, id) => {
  created[bucket].push(id);
  return id;
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, seconds = 1800) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + seconds });
  return body + '.' + createHmac('sha256', accessSecret).update(body).digest('base64url');
}

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t) => console.log(`\n${t}`);
const short = (t, n = 160) => String(t ?? '').replace(/\s+/g, ' ').slice(0, n);

async function call(token, method, path, body) {
  const res = await fetch(`${apiOrigin}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed?.data ?? parsed, raw: parsed };
}

// ------------------------------------------------------------------ fixtures
async function main() {
  const course = await prisma.course.findFirst({ select: { id: true, subjectId: true } });
  if (!course) throw new Error('no course exists to hang the fixture exam on');

  // Subject belongs to the course, not the other way round: Course.subjectId.
  const subjectId = course.subjectId;

  const instructor = await prisma.user.create({
    data: {
      email: `probe-instructor-${RUN}@example.test`,
      passwordHash: 'not-a-real-hash',
      firstName: 'Probe',
      lastName: `Instructor ${RUN}`,
      status: 'ACTIVE',
      roles: { create: [{ role: { connect: { name: 'INSTRUCTOR' } } }] },
    },
    select: { id: true, email: true },
  });
  track('userIds', instructor.id);

  const student = await prisma.user.create({
    data: {
      email: `probe-student-${RUN}@example.test`,
      passwordHash: 'not-a-real-hash',
      firstName: 'Probe',
      lastName: `Student ${RUN}`,
      status: 'ACTIVE',
      roles: { create: [{ role: { connect: { name: 'STUDENT' } } }] },
    },
    select: { id: true, email: true },
  });
  track('userIds', student.id);

  const klass = await prisma.class.create({
    data: { name: `PROBE-${RUN}`, code: `PRB${RUN}`, instructorId: instructor.id },
    select: { id: true, code: true },
  });
  track('classIds', klass.id);
  await prisma.classEnrollment.create({ data: { classId: klass.id, studentId: student.id } });

  const bank = await prisma.questionBank.create({
    data: { name: `PROBE-BANK-${RUN}`, courseId: course.id, categoryId: subjectId, createdById: instructor.id },
    select: { id: true },
  });
  track('bankIds', bank.id);

  const questions = [];
  for (let i = 1; i <= 2; i += 1) {
    const question = await prisma.question.create({
      data: {
        subjectId,
        questionBankId: bank.id,
        createdById: instructor.id,
        type: 'MULTIPLE_CHOICE',
        prompt: `PROBE ${RUN} question ${i}`,
        points: 5,
        tags: 'probe',
        sortOrder: i,
        options: {
          create: [
            { label: 'A', text: 'Wrong', isCorrect: false, sortOrder: 0 },
            { label: 'B', text: `Right ${i}`, isCorrect: true, sortOrder: 1 },
          ],
        },
      },
      select: { id: true, points: true, options: { select: { id: true, isCorrect: true } } },
    });
    track('questionIds', question.id);
    questions.push(question);
  }

  const exam = await prisma.exam.create({
    data: {
      courseId: course.id,
      createdById: instructor.id,
      title: `PROBE-${RUN} exam`,
      slug: `probe-${RUN}`,
      durationMinutes: 30,
      totalMarks: 10,
      passingMarks: 5,
      randomizeQuestions: false,
      randomizeOptions: false,
      fullscreenRequired: false,
      showResultImmediately: true,
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() + 7_200_000),
      // LIVE, not PUBLISHED: a published exam is still "not started yet" to a
      // student, so starting it would be refused for reasons unrelated to this
      // probe.
      status: 'LIVE',
      questions: { create: questions.map((q, i) => ({ questionId: q.id, sortOrder: i + 1, points: 5 })) },
    },
    select: { id: true, durationMinutes: true },
  });
  track('examIds', exam.id);
  await prisma.examAssignment.create({ data: { examId: exam.id, studentId: student.id } });
  await prisma.examClassAssignment.create({ data: { examId: exam.id, classId: klass.id } });

  const instructorToken = sign({ sub: instructor.id, email: instructor.email, roles: ['INSTRUCTOR'], permissions: [] });
  const studentToken = sign({ sub: student.id, email: student.email, roles: ['STUDENT'], permissions: [] });
  console.log(`fixtures: exam=${exam.id} student=${student.email} class=${klass.code}`);

  // ------------------------------------------------------- student: start
  section('student starts the exam');
  const start = await call(studentToken, 'POST', `/api/v1/exam-sessions/${exam.id}/start`);
  const session = start.body ?? {};
  check('start returns a session', start.status < 300 && Boolean(session.id), `${start.status} ${short(JSON.stringify(session))}`);
  if (!session.id) throw new Error(`cannot continue without a session: ${short(JSON.stringify(start.raw))}`);
  const sessionId = session.id;

  const started = await prisma.examSession.findUnique({ where: { id: sessionId } });
  const baseDeadline = started.expiresAt;
  check('deadline derives from duration', baseDeadline != null, `expiresAt=${baseDeadline?.toISOString()} remaining=${started.remainingSeconds}`);

  const deadlineBefore = await call(studentToken, 'GET', `/api/v1/monitoring/sessions/${sessionId}/deadline`);
  check(
    'student deadline endpoint is authoritative',
    deadlineBefore.status === 200 && deadlineBefore.body?.expiresAt === baseDeadline?.toISOString(),
    `${deadlineBefore.status} ${short(JSON.stringify(deadlineBefore.body))}`,
  );

  // ------------------------------------------------ proctor: grant time (one)
  section('proctor grants time to one session');
  const grant = await call(instructorToken, 'POST', `/api/v1/monitoring/exams/${exam.id}/extend-time`, {
    minutes: 10,
    studentIds: [student.id],
    reason: `probe ${RUN}`,
  });
  const first = grant.body ?? {};
  check('grant succeeds', grant.status < 300 && first.extended === 1, `${grant.status} ${short(JSON.stringify(first))}`);

  const afterFirst = await prisma.examSession.findUnique({ where: { id: sessionId } });
  const expectedFirst = new Date(baseDeadline.getTime() + 10 * 60_000);
  check(
    'deadline moved by exactly the granted minutes',
    Math.abs(afterFirst.expiresAt.getTime() - expectedFirst.getTime()) < 2000,
    `${baseDeadline.toISOString()} -> ${afterFirst.expiresAt.toISOString()}`,
  );
  check('total granted minutes persisted', afterFirst.totalExtensionMinutes === 10, `total=${afterFirst.totalExtensionMinutes} lastExtendedAt=${afterFirst.lastExtendedAt?.toISOString()}`);
  check('granter recorded', afterFirst.lastExtendedById === instructor.id, `by=${afterFirst.lastExtendedById}`);

  const grantRows = await prisma.timeExtension.count({ where: { sessionId, examId: exam.id } });
  check('audit row written', grantRows === 1, `TimeExtension rows=${grantRows}`);
  const notification = await prisma.notification.findFirst({
    where: { userId: student.id, type: 'EXAM_TIME_EXTENDED' },
    orderBy: { createdAt: 'desc' },
  });
  check('student notified', Boolean(notification), notification ? notification.title : 'no EXAM_TIME_EXTENDED notification');

  // ------------------------------------------------------- grants stack
  section('grants stack rather than replace');
  const second = await call(instructorToken, 'POST', `/api/v1/monitoring/exams/${exam.id}/extend-time`, {
    minutes: 5,
    studentIds: [student.id],
  });
  const afterSecond = await prisma.examSession.findUnique({ where: { id: sessionId } });
  check(
    'second grant stacks on the first',
    second.body?.extended === 1 && afterSecond.totalExtensionMinutes === 15,
    `total=${afterSecond.totalExtensionMinutes} expiresAt=${afterSecond.expiresAt.toISOString()}`,
  );

  // --------------------------------------------- class targeting resolves right
  section('class targeting resolves to the enrolled student');
  const byClass = await call(instructorToken, 'POST', `/api/v1/monitoring/exams/${exam.id}/extend-time`, {
    minutes: 2,
    classId: klass.id,
  });
  const afterClass = await prisma.examSession.findUnique({ where: { id: sessionId } });
  check(
    'class grant reaches the session',
    byClass.body?.extended === 1 && afterClass.totalExtensionMinutes === 17,
    `extended=${byClass.body?.extended} skipped=${JSON.stringify(byClass.body?.skipped)} total=${afterClass.totalExtensionMinutes}`,
  );

  // ------------------------------------------------- student answers + submits
  section('student answers and submits');
  for (const [index, question] of questions.entries()) {
    const correct = question.options.find((o) => o.isCorrect);
    await call(studentToken, 'PATCH', `/api/v1/exam-sessions/${sessionId}/answers`, {
      questionId: question.id,
      selectedOptionIds: [correct.id],
      remainingSeconds: 600,
    });
    if (index === 0) {
      const saved = await prisma.studentAnswer.findFirst({ where: { sessionId, questionId: question.id } });
      // selectedOptionIds is persisted as a JSON array string.
      let ids = [];
      try {
        ids = JSON.parse(saved?.selectedOptionIds ?? '[]');
      } catch {
        ids = [saved?.selectedOptionIds];
      }
      check('autosave stored the selection', ids.includes(correct.id), `saved=${saved?.selectedOptionIds}`);
    }
  }

  const submit = await call(studentToken, 'POST', '/api/v1/submissions', { sessionId });
  check('submit accepted', submit.status < 300, `${submit.status} ${short(JSON.stringify(submit.body))}`);

  const result = await prisma.result.findFirst({ where: { submission: { sessionId } }, include: { submission: true } });
  check('result created', Boolean(result), `result=${result?.id}`);
  check('automatic score computed', result && Number(result.autoScore) === 10, `autoScore=${result?.autoScore} score=${result?.score} gradingStatus=${result?.gradingStatus}`);
  // The fixture exam shows results immediately, so a settled attempt is published
  // on submission; either way it must not still be asking for a human.
  check(
    'lifecycle settled at submission',
    result && ['GRADED', 'PUBLISHED'].includes(result.gradingStatus),
    `gradingStatus=${result?.gradingStatus} publishedAt=${result?.publishedAt?.toISOString()}`,
  );

  // ------------------------------------------------- bulk grading
  section('bulk grading');
  const ungraded = await call(instructorToken, 'POST', '/api/v1/results/bulk/grade', { examId: exam.id, onlyUngraded: true });
  check('onlyUngraded skips an already-graded attempt', ungraded.body?.matched === 0 && ungraded.body?.graded === 0, `${short(JSON.stringify(ungraded.body))}`);

  const regrade = await call(instructorToken, 'POST', '/api/v1/results/bulk/grade', { examId: exam.id, regrade: true });
  // The attempt was already graded correctly, so a run has nothing to rewrite:
  // it is reported as unchanged rather than as a write.
  check(
    'explicit regrade finds nothing to change',
    regrade.body?.matched === 1 && regrade.body?.graded === 0 && regrade.body?.skipped === 1,
    `${short(JSON.stringify(regrade.body))}`,
  );

  const afterRegrade = await prisma.result.findUnique({ where: { id: result.id } });
  check('regrade counted and score preserved', afterRegrade.regradeCount === 1 && Number(afterRegrade.autoScore) === 10 && Number(afterRegrade.score) === 10, `regradeCount=${afterRegrade.regradeCount} score=${afterRegrade.score} autoScore=${afterRegrade.autoScore}`);

  // ------------------------------------------- manual marks survive a regrade
  section('manual marks survive a regrade');
  const answers = await prisma.studentAnswer.findMany({ where: { sessionId } });
  const manualBody = answers.map((a, i) => ({ answerId: a.id, score: i === 0 ? 3 : 5, feedback: 'marked by probe' }));
  const manual = await call(instructorToken, 'POST', `/api/v1/results/${result.id}/grade`, { answers: manualBody });
  check('manual grading accepted', manual.status < 300, `${manual.status} ${short(JSON.stringify(manual.body))}`);

  const afterManual = await prisma.result.findUnique({ where: { id: result.id } });
  check('manual score recorded', Number(afterManual.score) === 8 && Number(afterManual.autoScore) === 10, `score=${afterManual.score} autoScore=${afterManual.autoScore} manualAdjusted=${afterManual.manualAdjusted} gradingStatus=${afterManual.gradingStatus}`);

  // ------------------------------------------------------------ filtered list
  // Checked while the manual marks are in place, so a band has to discriminate
  // 80% from 100% — a check run after a re-grade that clobbered the marks would
  // pass for the wrong reason.
  section('filtered result list');
  const band = await call(instructorToken, 'GET', `/api/v1/results?examId=${exam.id}&minPercentage=50&maxPercentage=100&sortBy=percentage&sortDir=desc`);
  check('band includes the result', band.status === 200 && band.body?.data?.length === 1, `${band.status} rows=${band.body?.data?.length} total=${band.body?.pagination?.total}`);
  const excluded = await call(instructorToken, 'GET', `/api/v1/results?examId=${exam.id}&minPercentage=85&maxPercentage=100`);
  check('narrower band excludes an 80% result', excluded.body?.data?.length === 0, `rows=${excluded.body?.data?.length}`);
  const row = band.body?.data?.[0];
  check(
    'row exposes score provenance',
    row && Number(row.autoScore) === 10 && Number(row.score) === 8 && row.manualAdjusted === true,
    `autoScore=${row?.autoScore} score=${row?.score} status=${row?.gradingStatus} manualAdjusted=${row?.manualAdjusted}`,
  );

  const regradeAfterManual = await call(instructorToken, 'POST', '/api/v1/results/bulk/grade', { examId: exam.id, regrade: true });
  const afterSecondRegrade = await prisma.result.findUnique({ where: { id: result.id } });
  check(
    'regrade keeps manual marks and the automatic baseline',
    Number(afterSecondRegrade.score) === 8 && Number(afterSecondRegrade.autoScore) === 10,
    `score=${afterSecondRegrade.score} autoScore=${afterSecondRegrade.autoScore} graded=${regradeAfterManual.body?.graded}`,
  );
  check(
    'counters add up to matched',
    regradeAfterManual.body?.graded + regradeAfterManual.body?.skipped === regradeAfterManual.body?.matched,
    `matched=${regradeAfterManual.body?.matched} graded=${regradeAfterManual.body?.graded} skipped=${regradeAfterManual.body?.skipped}`,
  );
  const manualAnswers = await prisma.studentAnswer.findMany({ where: { sessionId }, select: { score: true, graderId: true } });
  check(
    'per-answer manual marks untouched by the regrade',
    manualAnswers.every((a) => a.graderId !== null && a.score !== null),
    manualAnswers.map((a) => `${a.score}/${a.graderId ? 'graded' : 'auto'}`).join(' '),
  );

  // ---------------------------------------- submitted session refuses a grant
  section('a submitted session can no longer be extended');
  const refused = await call(instructorToken, 'POST', `/api/v1/monitoring/exams/${exam.id}/extend-time`, {
    minutes: 10,
    studentIds: [student.id],
  });
  const finalSession = await prisma.examSession.findUnique({ where: { id: sessionId } });
  check(
    'grant refused after submission',
    refused.status < 300 && refused.body?.extended === 0 && refused.body?.skipped?.length === 1,
    `${refused.status} ${short(JSON.stringify(refused.body))}`,
  );
  check('deadline untouched by the refused grant', finalSession.totalExtensionMinutes === 17, `total=${finalSession.totalExtensionMinutes}`);
}

// --------------------------------------------------------------- cleanup
/**
 * Deleted in FK order, children first. Attempts to delete the exam first fail
 * with a RESTRICT violation from exam_sessions, which would strand the exam and
 * both fixture users in production — the one failure mode worse than a failed
 * probe.
 */
async function cleanup() {
  const notes = [];
  const drop = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      notes.push(`${label}: ${e.message.split('\n')[0]}`);
    }
  };

  for (const examId of created.examIds) {
    await drop('timeExtension', () => prisma.timeExtension.deleteMany({ where: { examId } }));
    await drop('auditLog', () => prisma.auditLog.deleteMany({ where: { entity: 'Exam', entityId: examId } }));
    await drop('examEvent', () => prisma.examEvent.deleteMany({ where: { examId } }));
    await drop('result', () => prisma.result.deleteMany({ where: { examId } }));
    await drop('submission', () => prisma.submission.deleteMany({ where: { session: { examId } } }));
    await drop('studentAnswer', () => prisma.studentAnswer.deleteMany({ where: { session: { examId } } }));
    await drop('examViolation', () => prisma.examViolation.deleteMany({ where: { session: { examId } } }));
    await drop('examSession', () => prisma.examSession.deleteMany({ where: { examId } }));
    await drop('examQuestion', () => prisma.examQuestion.deleteMany({ where: { examId } }));
    await drop('examAssignment', () => prisma.examAssignment.deleteMany({ where: { examId } }));
    await drop('examClassAssignment', () => prisma.examClassAssignment.deleteMany({ where: { examId } }));
    await drop('exam', () => prisma.exam.deleteMany({ where: { id: examId } }));
  }
  for (const id of created.bankIds) {
    await drop('question', () => prisma.question.deleteMany({ where: { questionBankId: id } }));
    await drop('questionBank', () => prisma.questionBank.deleteMany({ where: { id } }));
  }
  for (const id of created.classIds) {
    await drop('classEnrollment', () => prisma.classEnrollment.deleteMany({ where: { classId: id } }));
    await drop('examClassAssignment', () => prisma.examClassAssignment.deleteMany({ where: { classId: id } }));
    await drop('class', () => prisma.class.deleteMany({ where: { id } }));
  }
  for (const id of created.userIds) {
    await drop('notification', () => prisma.notification.deleteMany({ where: { userId: id } }));
    await drop('user', () => prisma.user.deleteMany({ where: { id } }));
  }
  for (const id of created.subjectIds) await drop('subject', () => prisma.subject.deleteMany({ where: { id } }));

  const residue = {
    exams: await prisma.exam.count({ where: { id: { in: created.examIds } } }),
    sessions: await prisma.examSession.count({ where: { studentId: { in: created.userIds } } }),
    classes: await prisma.class.count({ where: { id: { in: created.classIds } } }),
    banks: await prisma.questionBank.count({ where: { id: { in: created.bankIds } } }),
    users: await prisma.user.count({ where: { id: { in: created.userIds } } }),
    questions: await prisma.question.count({ where: { id: { in: created.questionIds } } }),
  };
  const leftovers = Object.entries(residue).filter(([, n]) => n > 0);
  console.log(`\ncleanup: ${leftovers.length === 0 ? 'no residue' : `RESIDUE ${JSON.stringify(residue)}`}`);
  if (notes.length) console.log(`cleanup problems:\n  ${notes.join('\n  ')}`);
  return leftovers.length === 0 && notes.length === 0;
}

let clean = false;
try {
  await main();
} catch (e) {
  failed += 1;
  console.log(`\n[FAIL] probe threw — ${e.message}`);
} finally {
  clean = await cleanup();
  await prisma.$disconnect();
}
console.log(`\n${passed} passed, ${failed} failed${clean ? '' : ' (cleanup incomplete)'}`);
process.exit(failed === 0 && clean ? 0 : 1);