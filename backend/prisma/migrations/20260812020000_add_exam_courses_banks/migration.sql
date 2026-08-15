-- CreateTable
CREATE TABLE "exam_courses" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "exam_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_question_banks" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionBankId" TEXT NOT NULL,

    CONSTRAINT "exam_question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_courses_courseId_idx" ON "exam_courses"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_courses_examId_courseId_key" ON "exam_courses"("examId", "courseId");

-- CreateIndex
CREATE INDEX "exam_question_banks_questionBankId_idx" ON "exam_question_banks"("questionBankId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_question_banks_examId_questionBankId_key" ON "exam_question_banks"("examId", "questionBankId");

-- AddForeignKey
ALTER TABLE "exam_courses" ADD CONSTRAINT "exam_courses_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_courses" ADD CONSTRAINT "exam_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_banks" ADD CONSTRAINT "exam_question_banks_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_banks" ADD CONSTRAINT "exam_question_banks_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill join tables from existing exams so historical data is consistent
INSERT INTO "exam_courses" ("id", "examId", "courseId")
SELECT gen_random_uuid(), "id", "courseId" FROM "exams";

INSERT INTO "exam_question_banks" ("id", "examId", "questionBankId")
SELECT gen_random_uuid(), "id", "questionBankId" FROM "exams" WHERE "questionBankId" IS NOT NULL;
