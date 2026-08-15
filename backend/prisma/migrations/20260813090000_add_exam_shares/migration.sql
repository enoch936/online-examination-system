-- CreateTable
CREATE TABLE "exam_shares" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_shares_examId_instructorId_key" ON "exam_shares"("examId", "instructorId");

-- CreateIndex
CREATE INDEX "exam_shares_instructorId_idx" ON "exam_shares"("instructorId");

-- AddForeignKey
ALTER TABLE "exam_shares" ADD CONSTRAINT "exam_shares_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_shares" ADD CONSTRAINT "exam_shares_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_shares" ADD CONSTRAINT "exam_shares_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
