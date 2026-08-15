-- CreateEnum
CREATE TYPE "QuestionBankStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "questionBankId" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "questionBankId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "topic" TEXT;

-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courseId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" "Difficulty",
    "status" "QuestionBankStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_banks_tenantId_idx" ON "question_banks"("tenantId");

-- CreateIndex
CREATE INDEX "question_banks_courseId_idx" ON "question_banks"("courseId");

-- CreateIndex
CREATE INDEX "question_banks_categoryId_idx" ON "question_banks"("categoryId");

-- CreateIndex
CREATE INDEX "question_banks_status_idx" ON "question_banks"("status");

-- CreateIndex
CREATE INDEX "questions_questionBankId_idx" ON "questions"("questionBankId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

