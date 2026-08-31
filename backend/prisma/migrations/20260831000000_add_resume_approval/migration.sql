-- Resume-approval protection: exams opt-in, sessions track instructor decisions
ALTER TABLE "exams" ADD COLUMN "resumeApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "exam_sessions" ADD COLUMN "resumeApprovedAt" TIMESTAMP(3);
ALTER TABLE "exam_sessions" ADD COLUMN "resumeDeniedAt" TIMESTAMP(3);