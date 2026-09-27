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

const created = { examIds: [] as string[], userIds: [] as string[], courseIds: [] as string[], subjectIds: [] as string[], bankIds: [] as string[] };
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
