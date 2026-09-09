-- Enforce enterprise-strict approval workflow by default:
-- any interruption or retake now requires instructor/admin approval.

ALTER TABLE "exams" ALTER COLUMN "connectionLossPolicy" SET DEFAULT 'APPROVAL_REQUIRED';
ALTER TABLE "exams" ALTER COLUMN "resumePolicy" SET DEFAULT 'INSTRUCTOR_APPROVAL';
ALTER TABLE "exams" ALTER COLUMN "retakePolicy" SET DEFAULT 'INSTRUCTOR_APPROVAL';

UPDATE "exams" SET "connectionLossPolicy" = 'APPROVAL_REQUIRED' WHERE "connectionLossPolicy" IN ('AUTO_RESUME', 'MANUAL_RESUME');
UPDATE "exams" SET "resumePolicy" = 'INSTRUCTOR_APPROVAL' WHERE "resumePolicy" = 'STUDENT';
UPDATE "exams" SET "retakePolicy" = 'INSTRUCTOR_APPROVAL' WHERE "retakePolicy" = 'DISABLED';