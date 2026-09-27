-- SubmissionReason records *why* a submission was created, so "was this attempt
-- on time?" is always answerable from the row itself rather than inferred.
--
-- Safe to run online: the new column is NOT NULL with a default, so the table is
-- never without a value while it is being added.
CREATE TYPE "SubmissionReason" AS ENUM ('MANUAL_SUBMIT', 'AUTO_TIME_EXPIRY', 'AUTO_FORCE_SUBMIT', 'AUTO_EXAM_ENDED', 'AUTO_INSTRUCTOR_END_SESSION', 'AUTO_ADMIN_FORCE_SUBMIT');

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "reason" "SubmissionReason" NOT NULL DEFAULT 'MANUAL_SUBMIT';

-- Backfill from the pre-existing `autoSubmitted` flag so historical rows are not
-- all mislabelled as manual submissions. The exact system cause is unknowable
-- for past data, but "was automatic" is, and that is the distinction that
-- matters for on-time reporting and proctoring review.
UPDATE "submissions" SET "reason" = 'AUTO_TIME_EXPIRY' WHERE "autoSubmitted" = true;

-- CreateIndex
CREATE INDEX "submissions_reason_idx" ON "submissions"("reason");
