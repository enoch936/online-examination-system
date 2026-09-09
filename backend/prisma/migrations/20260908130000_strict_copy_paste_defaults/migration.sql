-- Enforce copy/paste restrictions by default for every exam (student browser
-- blocks the action when disableCopy/disablePaste are set).

ALTER TABLE "exam_monitoring_configs" ALTER COLUMN "disableCopy" SET DEFAULT true;
ALTER TABLE "exam_monitoring_configs" ALTER COLUMN "disablePaste" SET DEFAULT true;

UPDATE "exam_monitoring_configs" SET "disableCopy" = true, "disablePaste" = true;