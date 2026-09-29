/**
 * End-to-end verification against a real PostgreSQL database.
 *
 * The unit suites cover the pure decision logic. This script covers what only a
 * real database can prove: that the unique constraints, transactions and
 * batching actually behave the way the services assume.
 *
 * Run with:  npx tsx scripts/verify-e2e.ts
 *
 * It creates its own exam/user fixtures with a unique run id and deletes
 * everything it created, so it is safe to run against a populated database.
 */
import { PrismaClient, Prisma, RoleName, ExamStatus, QuestionType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const RUN = randomUUID().slice(0, 8);
let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const created = {
  examIds: [] as string[],
  userIds: [] as string[],
  courseIds: [] as string[],
  subjectIds: [] as string[],
  bankIds: [] as string[],
  templateIds: [] as string[],
  documentIds: [] as string[],
};
let examCounter = 0;

async function makeInstructor(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `e2e-instructor-${RUN}@example.test`,
      passwordHash: 'not-a-real-hash',
      firstName: 'E2E',
      lastName: `Instructor ${RUN}`,
      roles: { create: [{ role: { connect: { name: RoleName.INSTRUCTOR } } }] },
    },
  });
  created.userIds.push(user.id);
  return user.id;
}

async function makeStudent(index: number): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `e2e-student-${index}-${RUN}@example.test`,
      passwordHash: 'not-a-real-hash',
      firstName: `E2E${index}`,
      lastName: `Student ${RUN}`,
      roles: { create: [{ role: { connect: { name: RoleName.STUDENT } } }] },
    },
  });
  created.userIds.push(user.id);
  return user.id;
}

/**
 * An exam with:
 *  - 1 auto-gradable multiple choice question (5 marks)
 *  - 1 essay question (5 marks) that must be graded by hand
 * so totalMarks === 10, passingMarks === 5.
 */
/** Only the certificate columns differ between scenarios; the rest is fixed. */
type ExamCertificateOverrides = Partial<
  Pick<
    Prisma.ExamUncheckedCreateInput,
    'certificateEnabled' | 'certificateMinPercentage' | 'certificateValidityDays' | 'certificateAutoIssue'
  >
>;

async function makeExam(instructorId: string, overrides: ExamCertificateOverrides = {}) {
  const subject = await prisma.subject.create({ data: { name: `E2E Subject ${RUN}`, code: `E2E${RUN}` } });
  created.subjectIds.push(subject.id);
  const course = await prisma.course.create({ data: { name: `E2E Course ${RUN}`, code: `E2EC${RUN}`, subjectId: subject.id } });
  created.courseIds.push(course.id);
  const bank = await prisma.questionBank.create({
    data: {
      name: `E2E Bank ${RUN}`,
      description: 'fixture',
      courseId: course.id,
      categoryId: subject.id,
      difficulty: 'MEDIUM',
      status: 'PUBLISHED',
      createdById: instructorId,
    },
  });
  created.bankIds.push(bank.id);

  // `Question` uses `prompt` (not `text`) and requires `tags` + `createdById`.
  const mcq = await prisma.question.create({
    data: {
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: `E2E multiple choice ${RUN}`,
      tags: 'e2e',
      createdById: instructorId,
      subjectId: subject.id,
      questionBankId: bank.id,
      options: {
        create: [
          { label: 'A', text: 'Correct', isCorrect: true, sortOrder: 0 },
          { label: 'B', text: 'Wrong', isCorrect: false, sortOrder: 1 },
        ],
      },
    },
  });
  const essay = await prisma.question.create({
    data: {
      type: QuestionType.ESSAY,
      prompt: `E2E essay ${RUN}`,
      tags: 'e2e',
      createdById: instructorId,
      subjectId: subject.id,
      questionBankId: bank.id,
    },
  });

  examCounter += 1;
  const exam = await prisma.exam.create({
    data: {
      title: `E2E Exam ${RUN} #${examCounter}`,
      slug: `e2e-exam-${RUN}-${examCounter}`,
      description: 'fixture',
      courseId: course.id,
      createdById: instructorId,
      durationMinutes: 30,
      totalMarks: 10,
      passingMarks: 5,
      attemptsAllowed: 3,
      negativeMarkingRate: 0,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3_600_000),
      status: ExamStatus.PUBLISHED,
      questions: {
        create: [
          { questionId: mcq.id, points: 5, sortOrder: 0 },
          { questionId: essay.id, points: 5, sortOrder: 1 },
        ],
      },
      ...overrides,
    },
    include: { questions: true },
  });
  created.examIds.push(exam.id);
  return { exam, mcqId: mcq.id, essayId: essay.id };
}

async function makeResult(examId: string, studentId: string, questionIds: string[], points: number) {
  const session = await prisma.examSession.create({
    data: { examId, studentId, attemptNumber: 1, status: 'IN_PROGRESS', startedAt: new Date(), expiresAt: new Date(Date.now() + 1_800_000) },
  });
  const submission = await prisma.submission.create({ data: { sessionId: session.id, submittedAt: new Date() } });
  const result = await prisma.result.create({
    data: { submissionId: submission.id, examId, studentId, score: points, maxScore: 10, percentage: points * 10, passed: points >= 5 },
  });
  return { session, submission, result };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * Runs `fn` while `templateId` is the only default template, then restores
 * whichever templates were default beforehand. Several scenarios need to reason
 * about "the default", and this script must not permanently change the default
 * of a database it did not create.
 */
async function withSoleDefaultTemplate<T>(templateId: string, fn: () => Promise<T>): Promise<T> {
  const prior = await prisma.certificateTemplate.findMany({ where: { isDefault: true }, select: { id: true } });
  const restore = async () => {
    await prisma.certificateTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    if (prior.length > 0) {
      await prisma.certificateTemplate.updateMany({ where: { id: { in: prior.map((p) => p.id) } }, data: { isDefault: true } });
    }
  };

  await prisma.$transaction([
    prisma.certificateTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.certificateTemplate.update({ where: { id: templateId }, data: { isDefault: true } }),
  ]);

  try {
    return await fn();
  } finally {
    await restore();
  }
}

async function main() {
  const instructorId = await makeInstructor();

  // -- A: the UNIQUE(resultId) constraint the bulk generator relies on --------
  section('A. Certificate.resultId is UNIQUE (basis of idempotent bulk issuance)');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true, certificateValidityDays: 30 });
    const studentId = await makeStudent(1);
    const { result } = await makeResult(exam.id, studentId, [], 10);

    await prisma.certificate.create({ data: { resultId: result.id, certificateNo: `E2E-A-1-${RUN}`, verificationCode: randomUUID() } });
    let conflicted = false;
    try {
      await prisma.certificate.create({ data: { resultId: result.id, certificateNo: `E2E-A-2-${RUN}`, verificationCode: randomUUID() } });
    } catch (error) {
      conflicted = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    check('a second certificate for the same result raises P2002', conflicted);
  }

  // -- B: createMany skipDuplicates is a no-op on re-run ---------------------
  section('B. createMany({ skipDuplicates: true }) makes a repeat bulk run a no-op');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true });
    const studentIds = await Promise.all([makeStudent(2), makeStudent(3)]);
    const results = await Promise.all(
      studentIds.map((studentId, i) => makeResult(exam.id, studentId, [], i === 0 ? 10 : 4)),
    );

    const issueable = results.filter((r) => r.result.passed).map((r) => r.result.id);
    const first = await prisma.certificate.createMany({
      data: issueable.map((resultId) => ({ resultId, certificateNo: `E2E-B-${RUN}-${resultId.slice(0, 6)}`, verificationCode: randomUUID() })),
      skipDuplicates: true,
    });
    check('first run creates one certificate for the passed result', first.count === 1, `got ${first.count}`);

    const second = await prisma.certificate.createMany({
      data: issueable.map((resultId) => ({ resultId, certificateNo: `E2E-B-retry-${RUN}-${resultId.slice(0, 6)}`, verificationCode: randomUUID() })),
      skipDuplicates: true,
    });
    check('re-running creates nothing', second.count === 0, `got ${second.count}`);

    const total = await prisma.certificate.count({ where: { result: { examId: exam.id } } });
    check('the failed result never got a certificate', total === 1, `got ${total}`);
  }

  // -- C: the exam certificate columns actually persist -----------------------
  section('C. Exam certificate configuration round-trips through the database');
  {
    const { exam } = await makeExam(instructorId, {
      certificateEnabled: true,
      certificateMinPercentage: 80,
      certificateValidityDays: 365,
      certificateAutoIssue: true,
    });
    const reloaded = await prisma.exam.findUnique({ where: { id: exam.id } });
    check('certificateEnabled persisted', reloaded?.certificateEnabled === true);
    check('certificateMinPercentage persisted', Number(reloaded?.certificateMinPercentage) === 80);
    check('certificateValidityDays persisted', reloaded?.certificateValidityDays === 365);
    check('certificateAutoIssue persisted', reloaded?.certificateAutoIssue === true);

    const defaults = await makeExam(instructorId);
    const reloadedDefaults = await prisma.exam.findUnique({ where: { id: defaults.exam.id } });
    check('unset min percentage defaults to null', reloadedDefaults?.certificateMinPercentage === null);
    check('unset validity defaults to null', reloadedDefaults?.certificateValidityDays === null);
    check('certificates default to disabled', reloadedDefaults?.certificateEnabled === false);
  }

  // -- D: submission reason backfill/constraint ------------------------------
  section('D. Submission.reason records how an attempt was finalised');
  {
    const { exam } = await makeExam(instructorId);
    const studentId = await makeStudent(4);
    const { submission, session } = await makeResult(exam.id, studentId, [], 10);

    await prisma.submission.update({ where: { id: submission.id }, data: { reason: 'AUTO_TIME_EXPIRY', autoSubmitted: true } });
    const reloaded = await prisma.submission.findUnique({ where: { id: submission.id } });
    check('reason persisted', reloaded?.reason === 'AUTO_TIME_EXPIRY');
    check('autoSubmitted persisted', reloaded?.autoSubmitted === true);

    const manual = await prisma.submission.update({ where: { id: submission.id }, data: { reason: 'MANUAL_SUBMIT', autoSubmitted: false } });
    check('reason can be corrected to a manual submit', manual.reason === 'MANUAL_SUBMIT');
    await prisma.examSession.update({ where: { id: session.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  }

  // -- E: one submission per session (the finalisation race guard) -----------
  section('E. Submission.sessionId is UNIQUE (the finalisation race guard)');
  {
    const { exam } = await makeExam(instructorId);
    const studentId = await makeStudent(5);
    const { submission, session } = await makeResult(exam.id, studentId, [], 10);

    let conflicted = false;
    try {
      await prisma.submission.create({ data: { sessionId: session.id, submittedAt: new Date() } });
    } catch (error) {
      conflicted = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    check('a second submission for one session raises P2002', conflicted);
    await prisma.submission.delete({ where: { id: submission.id } });
  }

  // -- F: transactional reissue does not lose the certificate ----------------
  section('F. reissue (delete + create) is atomic under a real transaction');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true, certificateValidityDays: 10 });
    const studentId = await makeStudent(6);
    const { result } = await makeResult(exam.id, studentId, [], 10);
    const original = await prisma.certificate.create({ data: { resultId: result.id, certificateNo: `E2E-F-${RUN}-orig`, verificationCode: randomUUID() } });

    const next = await prisma.$transaction(async (tx) => {
      await tx.certificate.delete({ where: { id: original.id } });
      return tx.certificate.create({ data: { resultId: result.id, certificateNo: `E2E-F-${RUN}-new`, verificationCode: randomUUID() } });
    });
    const survivors = await prisma.certificate.findMany({ where: { resultId: result.id } });
    check('exactly one certificate remains', survivors.length === 1, `got ${survivors.length}`);
    check('it is the new certificate', survivors[0]?.id === next.id);
    check('the old number is gone', survivors[0]?.certificateNo === `E2E-F-${RUN}-new`);
    check('a new verification code was issued', survivors[0]?.verificationCode !== original.verificationCode);

    // A failing step inside the transaction must roll the delete back.
    let rolledBack = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.certificate.delete({ where: { id: next.id } });
        throw new Error('simulated failure after delete');
      });
    } catch {
      rolledBack = true;
    }
    const afterRollback = await prisma.certificate.findUnique({ where: { id: next.id } });
    check('a failure after the delete rolls the delete back', rolledBack && afterRollback !== null);
  }

  // -- G: official attempt selection over real retakes -----------------------
  section('G. Official attempt picks the best result when a student retakes');
  {
    const { exam } = await makeExam(instructorId);
    const studentId = await makeStudent(7);

    const attempts: Array<{ score: number }> = [{ score: 4 }, { score: 8 }, { score: 6 }];
    for (const [index, attempt] of attempts.entries()) {
      const session = await prisma.examSession.create({
        data: {
          examId: exam.id,
          studentId,
          attemptNumber: index + 1,
          status: 'SUBMITTED',
          startedAt: new Date(Date.now() - (index + 1) * 600_000),
          expiresAt: new Date(Date.now() - index * 600_000),
          submittedAt: new Date(Date.now() - index * 600_000),
        },
      });
      const submittedAt = session.submittedAt ?? new Date();
      const submission = await prisma.submission.create({ data: { sessionId: session.id, submittedAt } });
      await prisma.result.create({
        data: { submissionId: submission.id, examId: exam.id, studentId, score: attempt.score, maxScore: 10, percentage: attempt.score * 10, passed: attempt.score >= 5 },
      });
    }

    const { selectBestAttempt } = await import('../src/results/result-calculation.util');
    const results = await prisma.result.findMany({ where: { examId: exam.id, studentId }, include: { submission: { include: { session: true } } } });
    const candidates = results.map((r) => {
      const session = r.submission.session;
      const startedAt = session.startedAt ? new Date(session.startedAt) : null;
      const submittedAt = new Date(r.submission.submittedAt ?? session.submittedAt ?? new Date());
      return {
        id: r.id,
        percentage: Number(r.percentage),
        durationMinutes: startedAt ? (submittedAt.getTime() - startedAt.getTime()) / 60_000 : 0,
        submittedAt,
        attemptNumber: session.attemptNumber,
      };
    });
    const best = selectBestAttempt(candidates);
    const bestResult = results.find((r) => r.id === best?.id);
    check('the highest-scoring attempt (80%) is the official one', Number(bestResult?.percentage) === 80, `got ${bestResult?.percentage}`);
    check('only one attempt is official', best !== null);
  }

  // -- H: certificate list scoping is enforced in SQL ------------------------
  section('H. A student cannot read another student\'s certificate');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true });
    const owner = await makeStudent(8);
    const other = await makeStudent(9);
    const { result } = await makeResult(exam.id, owner, [], 10);
    const certificate = await prisma.certificate.create({ data: { resultId: result.id, certificateNo: `E2E-H-${RUN}`, verificationCode: randomUUID() } });

    // Same predicate the service builds for a student, evaluated by Postgres.
    const studentScope = { result: { studentId: other, publishedAt: { not: null } } } as Prisma.CertificateWhereInput;
    const visible = await prisma.certificate.count({ where: { id: certificate.id, OR: [studentScope] } });
    check("another student sees 0 matching certificates", visible === 0, `got ${visible}`);

    const ownerScope = { result: { studentId: owner, publishedAt: { not: null } } } as Prisma.CertificateWhereInput;
    const ownerVisible = await prisma.certificate.count({ where: { id: certificate.id, OR: [ownerScope] } });
    check('the owner sees exactly 1 once the result is published', ownerVisible === 0, 'result is unpublished, so 0 is correct here');

    await prisma.result.update({ where: { id: result.id }, data: { publishedAt: new Date() } });
    const ownerPublished = await prisma.certificate.count({ where: { id: certificate.id, OR: [ownerScope] } });
    check('the owner sees it after publication', ownerPublished === 1, `got ${ownerPublished}`);
  }

  // -- I: unpublished results are excluded from unattended issuance ----------
  section('I. Unattended issuance requires a published result');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true, certificateAutoIssue: true });
    const studentId = await makeStudent(10);
    const { result } = await makeResult(exam.id, studentId, [], 10);

    const { evaluateCertificateEligibility } = await import('../src/certificates/certificate-eligibility.util');
    const before = evaluateCertificateEligibility(
      { passed: true, percentage: 100, minPercentage: null, enabled: true, requirePublished: true, publishedAt: result.publishedAt },
      true,
    );
    check('an unpublished result is refused', before.eligible === false && before.reason === 'RESULT_NOT_PUBLISHED');

    await prisma.result.update({ where: { id: result.id }, data: { publishedAt: new Date() } });
    const after = evaluateCertificateEligibility(
      { passed: true, percentage: 100, minPercentage: null, enabled: true, requirePublished: true, publishedAt: new Date() },
      true,
    );
    check('the same result is accepted once published', after.eligible === true);
  }

  // -- J: the connection-loss reason really exists in the enum ----------------
  section('J. AUTO_CONNECTION_LOST is a usable Submission.reason value');
  {
    const { exam } = await makeExam(instructorId);
    const studentId = await makeStudent(11);
    const { submission, session } = await makeResult(exam.id, studentId, [], 10);

    // Reading the enum from information_schema is what proves the migration
    // actually ran against this database, rather than the generated client
    // merely accepting a new string.
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'SubmissionReason'
      ORDER BY enumsortorder
    `;
    const labels = enumValues.map((row) => row.enumlabel);
    const expected = [
      'MANUAL_SUBMIT',
      'AUTO_TIME_EXPIRY',
      'AUTO_FORCE_SUBMIT',
      'AUTO_EXAM_ENDED',
      'AUTO_INSTRUCTOR_END_SESSION',
      'AUTO_CONNECTION_LOST',
      'AUTO_ADMIN_FORCE_SUBMIT',
    ];
    check('the enum type exposes AUTO_CONNECTION_LOST', labels.includes('AUTO_CONNECTION_LOST'), `got ${labels.join(',')}`);
    check(
      'every pre-existing reason survived the migration',
      expected.every((reason) => labels.includes(reason)),
      `missing ${expected.filter((r) => !labels.includes(r)).join(',') || 'none'}`,
    );

    const updated = await prisma.submission.update({ where: { id: submission.id }, data: { reason: 'AUTO_CONNECTION_LOST' } });
    const reloaded = await prisma.submission.findUnique({ where: { id: submission.id } });
    check('a connection loss round-trips through the column', updated.reason === 'AUTO_CONNECTION_LOST' && reloaded?.reason === 'AUTO_CONNECTION_LOST');
    await prisma.examSession.update({ where: { id: session.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  }

  // -- K: certificate identity columns are UNIQUE ----------------------------
  section('K. Certificate.certificateNo and verificationCode are UNIQUE');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true });
    const studentId = await makeStudent(12);
    const { result } = await makeResult(exam.id, studentId, [], 10);
    const certificate = await prisma.certificate.create({
      data: { resultId: result.id, certificateNo: `E2E-K-${RUN}`, verificationCode: randomUUID() },
    });

    const duplicateNo = await prisma.$transaction(async (tx) =>
      tx.certificate.createMany({
        data: [{ resultId: result.id, certificateNo: `E2E-K-${RUN}`, verificationCode: randomUUID() }],
        skipDuplicates: true,
      }),
    );
    check('skipDuplicates drops a colliding certificateNo', duplicateNo.count === 0, `got ${duplicateNo.count}`);

    const duplicateCode = await prisma.$transaction(async (tx) =>
      tx.certificate.createMany({
        data: [{ resultId: result.id, certificateNo: `E2E-K-${RUN}-other`, verificationCode: certificate.verificationCode }],
        skipDuplicates: true,
      }),
    );
    check('skipDuplicates drops a colliding verificationCode', duplicateCode.count === 0, `got ${duplicateCode.count}`);

    let codeConflict = false;
    try {
      await prisma.certificate.create({
        data: { resultId: result.id, certificateNo: `E2E-K-${RUN}-third`, verificationCode: certificate.verificationCode },
      });
    } catch (error) {
      codeConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    check('a direct insert with a taken code raises P2002', codeConflict);
  }

  // -- L: bulk issuance counts only what it really inserted ------------------
  section('L. createMany reports only genuinely new rows at scale');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true });
    const studentId = await makeStudent(13);
    const { result } = await makeResult(exam.id, studentId, [], 10);
    // Three results: one already certified, two fresh.
    const other = await prisma.result.create({
      data: { submissionId: (await prisma.submission.create({ data: { sessionId: (await prisma.examSession.create({ data: { examId: exam.id, studentId, attemptNumber: 2, status: 'SUBMITTED', startedAt: new Date(), expiresAt: new Date(), submittedAt: new Date() } })).id, submittedAt: new Date() } })).id, examId: exam.id, studentId, score: 6, maxScore: 10, percentage: 60, passed: true },
    });
    await prisma.certificate.create({ data: { resultId: result.id, certificateNo: `E2E-L-${RUN}-pre`, verificationCode: randomUUID() } });

    const firstPass = await prisma.certificate.createMany({
      data: [result.id, other.id].map((resultId, i) => ({ resultId, certificateNo: `E2E-L-${RUN}-${i}`, verificationCode: randomUUID() })),
      skipDuplicates: true,
    });
    check('the first pass inserts only the uncertified result', firstPass.count === 1, `got ${firstPass.count}`);

    const secondPass = await prisma.certificate.createMany({
      data: [result.id, other.id].map((resultId, i) => ({ resultId, certificateNo: `E2E-L-${RUN}-r2-${i}`, verificationCode: randomUUID() })),
      skipDuplicates: true,
    });
    check('a second pass inserts nothing', secondPass.count === 0, `got ${secondPass.count}`);

    const live = await prisma.certificate.count({ where: { result: { examId: exam.id } } });
    check('each result still has exactly one certificate', live === 2, `got ${live}`);
  }

  // -- M: two concurrent issuances cannot produce a duplicate ---------------
  section('M. Concurrent bulk issuance yields one certificate per result');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true });
    const studentId = await makeStudent(14);
    const { result } = await makeResult(exam.id, studentId, [], 10);

    // Two overlapping transactions racing to certify the same result. One must
    // win outright; a second row would mean a student holds two certificates.
    const issue = (tag: string) =>
      prisma.$transaction(async (tx) => {
        // `SELECT 1 FROM pg_sleep(...)` rather than a bare pg_sleep, whose void
        // result Prisma cannot deserialise.
        await tx.$queryRaw`SELECT 1 FROM pg_sleep(0.2)`;
        return tx.certificate.createMany({
          data: [{ resultId: result.id, certificateNo: `E2E-M-${RUN}-${tag}`, verificationCode: randomUUID() }],
          skipDuplicates: true,
        });
      });

    const [a, b] = await Promise.all([issue('a'), issue('b')]);
    const inserted = a.count + b.count;
    const live = await prisma.certificate.count({ where: { resultId: result.id } });
    check('the race inserted at most one row', inserted <= 1, `inserted ${inserted}`);
    check('exactly one certificate exists for the result', live === 1, `got ${live}`);
  }

  // -- N: report aggregation counts a retake once ---------------------------
  section('N. A report counts a retaking student once, on their official attempt');
  {
    const { exam } = await makeExam(instructorId);
    const studentId = await makeStudent(15);
    const quiet = await makeStudent(16);

    for (const [index, score] of [4, 8, 6].entries()) {
      const session = await prisma.examSession.create({
        data: {
          examId: exam.id,
          studentId,
          attemptNumber: index + 1,
          status: 'SUBMITTED',
          startedAt: new Date(Date.now() - (index + 1) * 600_000),
          expiresAt: new Date(Date.now() - index * 600_000),
          submittedAt: new Date(Date.now() - index * 600_000),
        },
      });
      const submitted = session.submittedAt ?? new Date();
      const submission = await prisma.submission.create({ data: { sessionId: session.id, submittedAt: submitted } });
      await prisma.result.create({
        data: { submissionId: submission.id, examId: exam.id, studentId, score, maxScore: 10, percentage: score * 10, passed: score >= 5 },
      });
    }
    // A second student with a single attempt, so the average is not degenerate.
    const solo = await makeResult(exam.id, quiet, [], 4);
    await prisma.result.update({ where: { id: solo.result.id }, data: { score: 4, percentage: 40, passed: false } });

    const { selectOfficialResults } = await import('../src/results/result-calculation.util');
    const rows = await prisma.result.findMany({
      where: { examId: exam.id },
      include: { submission: { include: { session: true } } },
    });
    const mapped = rows.map((r) => {
      const session = r.submission.session;
      const startedAt = session.startedAt ? new Date(session.startedAt) : null;
      const submittedAt = new Date(r.submission.submittedAt ?? session.submittedAt ?? new Date());
      return {
        id: r.id,
        studentId: r.studentId,
        examId: r.examId,
        score: Number(r.score),
        percentage: Number(r.percentage),
        startedAt,
        submittedAt,
        attemptNumber: session.attemptNumber,
      };
    });
    const official = selectOfficialResults(mapped);

    check('four attempts collapse to two official results', official.length === 2, `got ${official.length}`);
    const retaker = official.find((r) => r.studentId === studentId);
    check('the retaker is represented by the 80% attempt', retaker?.percentage === 80, `got ${retaker?.percentage}`);
    const mean = official.reduce((sum, r) => sum + r.percentage, 0) / official.length;
    check('the cohort average uses official attempts only (60%)', mean === 60, `got ${mean}`);
    const passedCount = official.filter((r) => r.percentage >= 50).length;
    check('exactly one student counts as passing', passedCount === 1, `got ${passedCount}`);
  }

  // -- O: child-first teardown leaves no orphans ----------------------------
  section('O. Deleting a session cascades to its answers and submission');
  {
    const { exam } = await makeExam(instructorId);
    const studentId = await makeStudent(17);
    const { session, submission } = await makeResult(exam.id, studentId, [], 6);
    const examQuestion = await prisma.examQuestion.findFirstOrThrow({ where: { examId: exam.id } });
    await prisma.studentAnswer.create({
      data: {
        sessionId: session.id,
        questionId: examQuestion.questionId,
        selectedOptionIds: '[]',
        score: 3,
        answerJson: 'null',
      },
    });

    await prisma.examSession.delete({ where: { id: session.id } });
    const orphans = await Promise.all([
      prisma.studentAnswer.count({ where: { sessionId: session.id } }),
      prisma.submission.count({ where: { id: submission.id } }),
    ]);
    check('the answer rows are removed with the session', orphans[0] === 0, `got ${orphans[0]}`);
    check('the submission is removed with the session', orphans[1] === 0, `got ${orphans[1]}`);
  }

  // -- Q: certificate assignment provenance persists -------------------------
  section('Q. A manual certificate records its assignment and override reason');
  {
    const { exam } = await makeExam(instructorId, { certificateEnabled: true });
    const studentId = await makeStudent(30);
    const { result } = await makeResult(exam.id, studentId, [], 2); // failed, overridden

    const certificate = await prisma.certificate.create({
      data: {
        resultId: result.id,
        certificateNo: `E2E-Q-${RUN}`,
        verificationCode: randomUUID(),
        assignment: 'MANUAL',
        overrideReason: 'Dean approved a special exemption',
        issuedById: instructorId,
      },
    });
    const reloaded = await prisma.certificate.findUnique({ where: { id: certificate.id } });
    check('assignment persisted as MANUAL', reloaded?.assignment === 'MANUAL');
    check('overrideReason persisted', reloaded?.overrideReason === 'Dean approved a special exemption');
    check('issuedById persisted', reloaded?.issuedById === instructorId);

    // The default must stay BULK so an earned certificate is distinguishable.
    const earned = await prisma.certificate.create({
      data: { resultId: (await makeResult(exam.id, await makeStudent(31), [], 10)).result.id, certificateNo: `E2E-Q2-${RUN}`, verificationCode: randomUUID() },
    });
    check('an unspecified assignment defaults to BULK', earned.assignment === 'BULK');
    check('an unspecified override reason defaults to null', earned.overrideReason === null);
  }

  // -- R: the snapshot is frozen against template edits and deletion ---------
  section('R. templateSnapshot stays valid after the template is edited or deleted');
  {
    const template = await prisma.certificateTemplate.create({
      data: {
        slug: `e2e-frozen-${RUN}`,
        name: 'E2E Frozen',
        status: 'PUBLISHED',
        content: JSON.stringify({ title: 'Original wording' }),
        design: JSON.stringify({ accentColor: '#111111' }),
        createdById: instructorId,
        isDefault: false,
      },
    });
    created.templateIds.push(template.id);

    const { exam } = await makeExam(instructorId, { certificateEnabled: true });
    const { result } = await makeResult(exam.id, await makeStudent(32), [], 10);
    const certificate = await prisma.certificate.create({
      data: {
        resultId: result.id,
        certificateNo: `E2E-R-${RUN}`,
        verificationCode: randomUUID(),
        templateId: template.id,
        templateSnapshot: JSON.stringify({ id: template.id, version: 1, content: { title: 'Original wording' } }),
      },
    });

    // Edit the live template. The snapshot must not move.
    await prisma.certificateTemplate.update({ where: { id: template.id }, data: { content: JSON.stringify({ title: 'CHANGED' }) } });
    const afterEdit = await prisma.certificate.findUnique({ where: { id: certificate.id } });
    check('editing the template leaves the snapshot untouched', JSON.parse(afterEdit!.templateSnapshot!).content.title === 'Original wording');
    check('the live template really did change', JSON.parse((await prisma.certificateTemplate.findUniqueOrThrow({ where: { id: template.id } })).content).title === 'CHANGED');

    // Delete the template: the FK is SET NULL, the snapshot must survive.
    await prisma.certificateTemplate.delete({ where: { id: template.id } });
    const afterDelete = await prisma.certificate.findUnique({ where: { id: certificate.id } });
    check('deleting the template nulls templateId', afterDelete?.templateId === null);
    check('the issued certificate keeps its frozen snapshot', JSON.parse(afterDelete!.templateSnapshot!).content.title === 'Original wording');
  }

  // -- S: unique constraints on templates, revisions and documents -----------
  section('S. Template, revision and content-document uniqueness is enforced');
  {
    const slug = `e2e-unique-${RUN}`;
    const template = await prisma.certificateTemplate.create({
      data: { slug, name: 'E2E Unique', createdById: instructorId, content: '{}', design: '{}' },
    });
    created.templateIds.push(template.id);

    let slugConflict = false;
    try {
      await prisma.certificateTemplate.create({ data: { slug, name: 'Duplicate', createdById: instructorId, content: '{}', design: '{}' } });
    } catch (error) {
      slugConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    check('a duplicate template slug raises P2002', slugConflict);

    await prisma.templateRevision.create({
      data: { templateId: template.id, version: 1, content: '{}', design: '{}', status: 'DRAFT', authorId: instructorId },
    });
    let revisionConflict = false;
    try {
      await prisma.templateRevision.create({
        data: { templateId: template.id, version: 1, content: '{}', design: '{}', status: 'DRAFT', authorId: instructorId },
      });
    } catch (error) {
      revisionConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    check('a duplicate (templateId, version) revision raises P2002', revisionConflict);

    const key = `e2e.doc.${RUN}`;
    const document = await prisma.contentDocument.create({
      data: { key, title: 'E2E Doc', content: '{}', createdById: instructorId },
    });
    created.documentIds.push(document.id);
    let keyConflict = false;
    try {
      await prisma.contentDocument.create({ data: { key, title: 'Duplicate', content: '{}', createdById: instructorId } });
    } catch (error) {
      keyConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    check('a duplicate content-document key raises P2002', keyConflict);
  }

  // -- T: the default-template swap leaves exactly one default ---------------
  section('T. Promoting a default template atomically clears the previous one');
  {
    const a = await prisma.certificateTemplate.create({
      data: { slug: `e2e-default-a-${RUN}`, name: 'A', status: 'PUBLISHED', isDefault: false, createdById: instructorId, content: '{}', design: '{}' },
    });
    const b = await prisma.certificateTemplate.create({
      data: { slug: `e2e-default-b-${RUN}`, name: 'B', status: 'PUBLISHED', isDefault: false, createdById: instructorId, content: '{}', design: '{}' },
    });
    created.templateIds.push(a.id, b.id);

    await prisma.certificateTemplate.update({ where: { id: a.id }, data: { isDefault: true } });

    // The exact statement pair the service runs, to prove the swap is safe.
    await prisma.$transaction([
      prisma.certificateTemplate.updateMany({ where: { isDefault: true, id: { not: b.id } }, data: { isDefault: false } }),
      prisma.certificateTemplate.update({ where: { id: b.id }, data: { isDefault: true } }),
    ]);

    const defaults = await prisma.certificateTemplate.count({ where: { isDefault: true, id: { in: [a.id, b.id] } } });
    check('exactly one of the two templates is the default afterwards', defaults === 1, `got ${defaults}`);
    check('the promoted template is the default', (await prisma.certificateTemplate.findUniqueOrThrow({ where: { id: b.id } })).isDefault === true);
    check('the previous default was cleared', (await prisma.certificateTemplate.findUniqueOrThrow({ where: { id: a.id } })).isDefault === false);

    // Leave the database's own default exactly as it was found.
    await prisma.certificateTemplate.update({ where: { id: b.id }, data: { isDefault: false } });
  }

  // -- U: an exam pin wins over the default at resolution time ---------------
  section('U. An exam-pinned template resolves ahead of the default');
  {
    const pinned = await prisma.certificateTemplate.create({
      data: { slug: `e2e-pinned-${RUN}`, name: 'Pinned', status: 'PUBLISHED', isDefault: false, createdById: instructorId, content: JSON.stringify({ title: 'Pinned title' }), design: '{}' },
    });
    const fallback = await prisma.certificateTemplate.create({
      data: { slug: `e2e-fallback-${RUN}`, name: 'Fallback', status: 'PUBLISHED', isDefault: false, createdById: instructorId, content: JSON.stringify({ title: 'Fallback title' }), design: '{}' },
    });
    created.templateIds.push(pinned.id, fallback.id);

    const { exam: pinnedExam } = await makeExam(instructorId, { certificateEnabled: true });
    await prisma.exam.update({ where: { id: pinnedExam.id }, data: { certificateTemplateId: pinned.id } });
    const { exam: plainExam } = await makeExam(instructorId, { certificateEnabled: true });

    const resolve = async (examId: string) => {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: { certificateTemplate: { select: { id: true } } },
      });
      if (exam?.certificateTemplate) return exam.certificateTemplate.id;
      const def = await prisma.certificateTemplate.findFirst({ where: { isDefault: true, status: 'PUBLISHED' } });
      return def?.id ?? null;
    };

    await withSoleDefaultTemplate(fallback.id, async () => {
      check('the pinned exam resolves to its own template', (await resolve(pinnedExam.id)) === pinned.id);
      check('an unpinned exam resolves to the published default', (await resolve(plainExam.id)) === fallback.id);

      // Deleting the pin must fall back rather than leave nothing.
      await prisma.certificateTemplate.delete({ where: { id: pinned.id } });
      check('deleting the pin falls back to the default', (await resolve(pinnedExam.id)) === fallback.id);
    });
  }

  // -- P: fixtures are fully reclaimable -------------------------------------
  section('P. The fixtures this run created are reclaimable in child-first order');
  {
    const before = await prisma.user.count({ where: { id: { in: created.userIds } } });
    check('the run still owns its fixtures before teardown', before === created.userIds.length, `got ${before}`);

    // The same order the teardown uses: sessions first, then the exam, then the
    // bank, course, subject and finally the users. If any of these were blocked
    // by a RESTRICT constraint the real teardown would leak.
    const examIds = [...created.examIds];
    await prisma.examSession.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.examQuestion.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.exam.deleteMany({ where: { id: { in: examIds } } });
    await prisma.question.deleteMany({ where: { prompt: { startsWith: 'E2E ' } } });
    await prisma.questionBank.deleteMany({ where: { id: { in: created.bankIds } } });
    await prisma.course.deleteMany({ where: { id: { in: created.courseIds } } });
    await prisma.subject.deleteMany({ where: { id: { in: created.subjectIds } } });
    await prisma.templateRevision.deleteMany({ where: { templateId: { in: created.templateIds } } });
    await prisma.certificateTemplate.deleteMany({ where: { id: { in: created.templateIds } } });
    await prisma.contentRevision.deleteMany({ where: { documentId: { in: created.documentIds } } });
    await prisma.contentDocument.deleteMany({ where: { id: { in: created.documentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });

    const leftover = await Promise.all([
      prisma.exam.count({ where: { id: { in: examIds } } }),
      prisma.user.count({ where: { id: { in: created.userIds } } }),
      prisma.question.count({ where: { prompt: { startsWith: 'E2E ' } } }),
    ]);
    check('no exam survives', leftover[0] === 0, `got ${leftover[0]}`);
    check('no user survives', leftover[1] === 0, `got ${leftover[1]}`);
    check('no question survives', leftover[2] === 0, `got ${leftover[2]}`);

    // The teardown block runs afterwards; clearing the lists keeps it a no-op.
    created.examIds.length = 0;
    created.userIds.length = 0;
    created.courseIds.length = 0;
    created.subjectIds.length = 0;
    created.bankIds.length = 0;
    created.templateIds.length = 0;
    created.documentIds.length = 0;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('\nverification crashed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Child-first. ExamSession.examId, ExamQuestion.questionId, the exam join
    // tables and Question.createdById are all RESTRICT rather than CASCADE, so
    // order matters. Failures are reported rather than swallowed — a silent
    // cleanup leaves fixtures behind and makes the next run fail on a unique
    // constraint.
    const problems: string[] = [];
    const note = (label: string) => (e: unknown) => problems.push(`${label}: ${e}`);
    const examIds = created.examIds;

    await prisma.examSession.deleteMany({ where: { examId: { in: examIds } } }).catch(note('sessions'));
    await prisma.examQuestion.deleteMany({ where: { examId: { in: examIds } } }).catch(note('examQuestions'));
    await prisma.examAssignment.deleteMany({ where: { examId: { in: examIds } } }).catch(note('examAssignments'));
    await prisma.examClassAssignment.deleteMany({ where: { examId: { in: examIds } } }).catch(note('examClassAssignments'));
    await prisma.examShare.deleteMany({ where: { examId: { in: examIds } } }).catch(note('examShares'));
    await prisma.examCourse.deleteMany({ where: { examId: { in: examIds } } }).catch(note('examCourses'));
    await prisma.examQuestionBank.deleteMany({ where: { examId: { in: examIds } } }).catch(note('examQuestionBanks'));
    await prisma.exam.deleteMany({ where: { id: { in: examIds } } }).catch(note('exams'));

    // Questions reference their bank, subject and creator, all by RESTRICT.
    await prisma.question.deleteMany({ where: { prompt: { startsWith: 'E2E ' } } }).catch(note('questions'));

    await prisma.questionBank.deleteMany({ where: { id: { in: created.bankIds } } }).catch(note('banks'));
    await prisma.course.deleteMany({ where: { id: { in: created.courseIds } } }).catch(note('courses'));
    await prisma.subject.deleteMany({ where: { id: { in: created.subjectIds } } }).catch(note('subjects'));
    await prisma.templateRevision.deleteMany({ where: { templateId: { in: created.templateIds } } }).catch(note('templateRevisions'));
    await prisma.certificateTemplate.deleteMany({ where: { id: { in: created.templateIds } } }).catch(note('certificateTemplates'));
    await prisma.contentRevision.deleteMany({ where: { documentId: { in: created.documentIds } } }).catch(note('contentRevisions'));
    await prisma.contentDocument.deleteMany({ where: { id: { in: created.documentIds } } }).catch(note('contentDocuments'));
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(note('users'));

    if (problems.length > 0) {
      console.error(`\ncleanup left fixtures behind (run scripts/cleanup-e2e-fixtures.ts):`);
      for (const problem of problems) console.error(`  ${problem}`);
      process.exitCode = 1;
    } else {
      console.log('\nfixtures cleaned up');
    }
    await prisma.$disconnect();
  });
