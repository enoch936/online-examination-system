-- Bulk grading bookkeeping + exam-time extension audit.
--
-- 1. Result gains an explicit grading lifecycle and keeps the automatic score
--    alongside any manual adjustment, so a grader's edit never erases the
--    machine-calculated figure it overrode.
-- 2. ExamSession records the time extensions it has been granted, so the
--    effective deadline is always derivable from persisted state rather than
--    from whatever the browser last displayed.

-- ---------------------------------------------------------------------------
-- 1. Result: grading status + automatic/manual score split
-- ---------------------------------------------------------------------------
-- GradingStatus is a real Postgres enum (not TEXT) so Prisma's generated client
-- and the column can never drift; it has to be created before the column.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GradingStatus') THEN
    CREATE TYPE "GradingStatus" AS ENUM ('PENDING', 'GRADED', 'PUBLISHED');
  END IF;
END $$;

ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "gradingStatus" "GradingStatus" NOT NULL DEFAULT 'GRADED';
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "autoScore" DECIMAL;
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "manualAdjusted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "gradedById" TEXT;
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "regradeCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: every pre-existing Result was produced by the automatic path
-- (finalizeSubmission) or by manual grading, and already carries a score, so it
-- is GRADED and its stored score is also its automatic score.
UPDATE "results" SET "autoScore" = "score" WHERE "autoScore" IS NULL;

CREATE INDEX IF NOT EXISTS "results_gradingStatus_submittedAt_idx"
  ON "results" ("gradingStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "results_examId_gradingStatus_idx"
  ON "results" ("examId", "gradingStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'results_gradedById_fkey'
  ) THEN
    ALTER TABLE "results"
      ADD CONSTRAINT "results_gradedById_fkey"
      FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. ExamSession: extension bookkeeping (additive, existing rows unaffected)
-- ---------------------------------------------------------------------------
ALTER TABLE "exam_sessions" ADD COLUMN IF NOT EXISTS "originalExpiresAt" TIMESTAMP(3);
ALTER TABLE "exam_sessions" ADD COLUMN IF NOT EXISTS "totalExtensionMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "exam_sessions" ADD COLUMN IF NOT EXISTS "lastExtendedAt" TIMESTAMP(3);
ALTER TABLE "exam_sessions" ADD COLUMN IF NOT EXISTS "lastExtendedById" TEXT;

-- Seed the baseline from the deadline the session started with so the original
-- deadline stays knowable after the first extension moves `expiresAt`.
UPDATE "exam_sessions"
   SET "originalExpiresAt" = "expiresAt"
 WHERE "originalExpiresAt" IS NULL
   AND "expiresAt" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_sessions_lastExtendedById_fkey'
  ) THEN
    ALTER TABLE "exam_sessions"
      ADD CONSTRAINT "exam_sessions_lastExtendedById_fkey"
      FOREIGN KEY ("lastExtendedById") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "exam_sessions_examId_status_expiresAt_idx"
  ON "exam_sessions" ("examId", "status", "expiresAt");

-- ---------------------------------------------------------------------------
-- 3. TimeExtension: append-only audit of every manual time grant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "time_extensions" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "previousExpiresAt" TIMESTAMP(3),
  "newExpiresAt" TIMESTAMP(3) NOT NULL,
  "totalExtensionMinutes" INTEGER NOT NULL,
  "grantedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "time_extensions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "time_extensions_sessionId_createdAt_idx"
  ON "time_extensions" ("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "time_extensions_examId_createdAt_idx"
  ON "time_extensions" ("examId", "createdAt");
CREATE INDEX IF NOT EXISTS "time_extensions_studentId_createdAt_idx"
  ON "time_extensions" ("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "time_extensions_grantedById_idx"
  ON "time_extensions" ("grantedById");

-- ---------------------------------------------------------------------------
-- 4. NotificationType.EXAM_TIME_EXTENDED
-- ---------------------------------------------------------------------------
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_TIME_EXTENDED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_extensions_sessionId_fkey') THEN
    ALTER TABLE "time_extensions" ADD CONSTRAINT "time_extensions_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_extensions_examId_fkey') THEN
    ALTER TABLE "time_extensions" ADD CONSTRAINT "time_extensions_examId_fkey"
      FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_extensions_studentId_fkey') THEN
    ALTER TABLE "time_extensions" ADD CONSTRAINT "time_extensions_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_extensions_grantedById_fkey') THEN
    ALTER TABLE "time_extensions" ADD CONSTRAINT "time_extensions_grantedById_fkey"
      FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;