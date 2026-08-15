-- CreateEnum
CREATE TYPE "ExamPermissionLevel" AS ENUM ('VIEWER', 'MONITOR', 'PROCTOR', 'CO_OWNER');

-- AlterTable
ALTER TABLE "exam_shares" ADD COLUMN "permissionLevel" "ExamPermissionLevel" NOT NULL DEFAULT 'VIEWER';
