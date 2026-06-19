/*
  Warnings:

  - You are about to drop the column `answerString` on the `student_answers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "student_answers" DROP COLUMN "answerString",
ADD COLUMN     "answerJson" TEXT;
