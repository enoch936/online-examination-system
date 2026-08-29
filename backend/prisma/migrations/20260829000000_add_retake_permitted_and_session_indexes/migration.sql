-- AlterTable
ALTER TABLE "exam_sessions" ADD COLUMN     "retakePermitted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "exam_events_type_timestamp_idx" ON "exam_events"("type", "timestamp");

-- CreateIndex
CREATE INDEX "exam_sessions_status_expiresAt_idx" ON "exam_sessions"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "exam_sessions_connectionState_idx" ON "exam_sessions"("connectionState");

-- CreateIndex
CREATE INDEX "exam_sessions_examId_createdAt_idx" ON "exam_sessions"("examId", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_sessionId_idx" ON "submissions"("sessionId");