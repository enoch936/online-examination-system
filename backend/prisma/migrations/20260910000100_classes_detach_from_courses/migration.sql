-- Detach classes from courses: a class is a plain container of students,
-- not a course "section". Drop the FK, the per-course indexes and the column,
-- then make (tenantId, name) unique like (tenantId, code) already is.
ALTER TABLE "classes" DROP CONSTRAINT "classes_courseId_fkey";

DROP INDEX IF EXISTS "classes_courseId_name_key";
DROP INDEX IF EXISTS "classes_courseId_idx";

ALTER TABLE "classes" DROP COLUMN "courseId";

CREATE UNIQUE INDEX "classes_tenantId_name_key" ON "classes"("tenantId", "name");