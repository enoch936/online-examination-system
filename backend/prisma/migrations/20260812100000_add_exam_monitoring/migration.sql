-- CreateEnum
CREATE TYPE "ConnectionState" AS ENUM ('CONNECTED', 'DISCONNECTED', 'RECONNECTING');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ExamEventType" AS ENUM ('EXAM_STARTED', 'EXAM_RESUMED', 'QUESTION_VIEWED', 'QUESTION_ANSWERED', 'QUESTION_FLAGGED', 'TAB_SWITCHED', 'WINDOW_BLURRED', 'WINDOW_FOCUSED', 'FULLSCREEN_EXITED', 'FULLSCREEN_ENTERED', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CUT_ATTEMPT', 'PRINT_ATTEMPT', 'CONTEXT_MENU_ATTEMPT', 'SHORTCUT_ATTEMPT', 'CAMERA_CONNECTED', 'CAMERA_DISCONNECTED', 'MIC_CONNECTED', 'MIC_DISCONNECTED', 'FACE_DETECTED', 'FACE_NOT_DETECTED', 'MULTIPLE_FACES_DETECTED', 'MOTION_DETECTED', 'AUDIO_ACTIVITY', 'AI_SIGNAL', 'MANUAL_FLAG', 'CONNECTION_LOST', 'CONNECTION_RESTORED', 'EXAM_SUBMITTED', 'PAUSED', 'RESUMED', 'TIME_EXTENDED', 'FORCE_SUBMITTED', 'SESSION_DISCONNECTED', 'WARNING_SENT', 'NOTE_ADDED');

-- AlterTable
ALTER TABLE "exam_sessions" ADD COLUMN     "connectionState" "ConnectionState" NOT NULL DEFAULT 'CONNECTED',
ADD COLUMN     "currentQuestionIndex" INTEGER,
ADD COLUMN     "disconnectCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "heartbeatCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "exam_events" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "ExamEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "severity" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_monitoring_configs" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "webcamEnabled" BOOLEAN NOT NULL DEFAULT false,
    "micEnabled" BOOLEAN NOT NULL DEFAULT false,
    "screenMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiDetectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventLoggingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "weights" TEXT NOT NULL DEFAULT '{}',
    "thresholds" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_monitoring_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_events_examId_timestamp_idx" ON "exam_events"("examId", "timestamp");

-- CreateIndex
CREATE INDEX "exam_events_sessionId_timestamp_idx" ON "exam_events"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "exam_events_studentId_timestamp_idx" ON "exam_events"("studentId", "timestamp");

-- CreateIndex
CREATE INDEX "exam_events_type_idx" ON "exam_events"("type");

-- CreateIndex
CREATE UNIQUE INDEX "exam_monitoring_configs_examId_key" ON "exam_monitoring_configs"("examId");

-- AddForeignKey
ALTER TABLE "exam_events" ADD CONSTRAINT "exam_events_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_events" ADD CONSTRAINT "exam_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_events" ADD CONSTRAINT "exam_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_events" ADD CONSTRAINT "exam_events_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_monitoring_configs" ADD CONSTRAINT "exam_monitoring_configs_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

