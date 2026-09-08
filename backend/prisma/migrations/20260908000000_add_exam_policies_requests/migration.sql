-- CreateEnum
CREATE TYPE "ExamConnectionLossPolicy" AS ENUM ('AUTO_RESUME', 'MANUAL_RESUME', 'APPROVAL_REQUIRED', 'END_SESSION', 'MARK_REVIEW');

-- CreateEnum
CREATE TYPE "ExamResumePolicy" AS ENUM ('STUDENT', 'INSTRUCTOR_APPROVAL', 'ADMIN_APPROVAL', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExamRetakePolicy" AS ENUM ('DISABLED', 'AUTO', 'INSTRUCTOR_APPROVAL', 'ADMIN_APPROVAL');

-- CreateEnum
CREATE TYPE "WebcamMode" AS ENUM ('DISABLED', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "MicMode" AS ENUM ('DISABLED', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "FullscreenPolicy" AS ENUM ('DISABLED', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "MonitoringStrictness" AS ENUM ('RELAXED', 'STANDARD', 'STRICT');

-- CreateEnum
CREATE TYPE "RetakeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExamEventType" ADD VALUE 'CAMERA_PERMISSION_DENIED';
ALTER TYPE "ExamEventType" ADD VALUE 'CAMERA_UNAVAILABLE';
ALTER TYPE "ExamEventType" ADD VALUE 'FOCUS_RESTORED';
ALTER TYPE "ExamEventType" ADD VALUE 'PROCTORING_CONSENT_DECLINED';
ALTER TYPE "ExamEventType" ADD VALUE 'SESSION_TERMINATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RETAKE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'RETAKE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'RETAKE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'RESUME_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'RESUME_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'RESUME_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_MESSAGE';

-- AlterTable
ALTER TABLE "exam_monitoring_configs" ADD COLUMN     "detectClipboard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "detectShortcuts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "disableCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "disablePaste" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fullscreenPolicy" "FullscreenPolicy" NOT NULL DEFAULT 'OPTIONAL',
ADD COLUMN     "micMode" "MicMode" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN     "strictness" "MonitoringStrictness" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "trackTabSwitches" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trackWindowBlur" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "violationThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "webcamMode" "WebcamMode" NOT NULL DEFAULT 'DISABLED';

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "connectionLossPolicy" "ExamConnectionLossPolicy" NOT NULL DEFAULT 'AUTO_RESUME',
ADD COLUMN     "resumePolicy" "ExamResumePolicy" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "retakePolicy" "ExamRetakePolicy" NOT NULL DEFAULT 'DISABLED';

-- CreateTable
CREATE TABLE "retake_requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "status" "RetakeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retake_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RetakeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retake_requests_studentId_status_idx" ON "retake_requests"("studentId", "status");

-- CreateIndex
CREATE INDEX "retake_requests_examId_status_idx" ON "retake_requests"("examId", "status");

-- CreateIndex
CREATE INDEX "resume_requests_studentId_status_idx" ON "resume_requests"("studentId", "status");

-- CreateIndex
CREATE INDEX "resume_requests_examId_status_idx" ON "resume_requests"("examId", "status");

-- AddForeignKey
ALTER TABLE "retake_requests" ADD CONSTRAINT "retake_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retake_requests" ADD CONSTRAINT "retake_requests_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retake_requests" ADD CONSTRAINT "retake_requests_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retake_requests" ADD CONSTRAINT "retake_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_requests" ADD CONSTRAINT "resume_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_requests" ADD CONSTRAINT "resume_requests_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_requests" ADD CONSTRAINT "resume_requests_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_requests" ADD CONSTRAINT "resume_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

