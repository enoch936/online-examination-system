/**
 * Removes fixtures left behind by an interrupted verify-e2e run.
 *
 * verify-e2e.ts cleans up after itself on the happy path, but if it crashes
 * mid-run the fixtures survive. Run this before re-running the verification.
 *
 * Deletion is child-first on purpose: `ExamSession.examId` and `User` relations
 * are RESTRICT rather than CASCADE, so deleting an exam with sessions still
 * attached fails at the database level.
 *
 * Run with:  npx tsx scripts/cleanup-e2e-fixtures.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXAM_PREFIX = 'E2E Exam ';
const BANK_PREFIX = 'E2E Bank ';
const COURSE_PREFIX = 'E2E Course ';
const SUBJECT_PREFIX = 'E2E Subject ';

async function main() {
  const exams = await prisma.exam.findMany({ where: { title: { startsWith: EXAM_PREFIX } }, select: { id: true } });
  const examIds = exams.map((exam) => exam.id);

  let sessions = 0;
  if (examIds.length > 0) {
    // Results and certificates hang off submissions, which hang off sessions.
    sessions = (
      await prisma.examSession.deleteMany({ where: { examId: { in: examIds } } })
    ).count;
    // These are plain relations on Exam with no cascade.
    await prisma.examQuestion.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.examAssignment.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.examClassAssignment.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.examShare.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.examCourse.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.examQuestionBank.deleteMany({ where: { examId: { in: examIds } } });
  }

  const deletedExams = await prisma.exam.deleteMany({ where: { id: { in: examIds } } });

  // Questions reference both their bank and their creator, and both those
  // relations are RESTRICT, so questions have to go before either parent.
  await prisma.question.deleteMany({ where: { prompt: { startsWith: 'E2E ' } } });

  const banks = await prisma.questionBank.deleteMany({ where: { name: { startsWith: BANK_PREFIX } } });
  const courses = await prisma.course.deleteMany({ where: { name: { startsWith: COURSE_PREFIX } } });
  const subjects = await prisma.subject.deleteMany({ where: { name: { startsWith: SUBJECT_PREFIX } } });
  const users = await prisma.user.deleteMany({ where: { email: { contains: '@example.test' } } });

  console.log(
    `removed ${deletedExams.count} exams, ${sessions} sessions, ${banks.count} banks, ` +
      `${courses.count} courses, ${subjects.count} subjects, ${users.count} users`,
  );
}

main()
  .catch((error) => {
    console.error('cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
