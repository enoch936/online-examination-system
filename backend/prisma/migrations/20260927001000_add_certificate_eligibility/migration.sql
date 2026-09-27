-- Per-exam certificate eligibility configuration.
--
-- Every column is additive with a default that reproduces today's behaviour, so
-- no existing exam changes how it issues certificates:
--   certificateEnabled=false      -> bulk/auto issuance stays off; staff can
--                                    still issue one certificate by hand
--   certificateMinPercentage=NULL -> no extra gate beyond the pass mark
--   certificateValidityDays=NULL  -> certificates never expire
--   certificateAutoIssue=false    -> results are not auto-certified on publish
ALTER TABLE "exams" ADD COLUMN     "certificateEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "certificateMinPercentage" DECIMAL(65,30),
ADD COLUMN     "certificateValidityDays" INTEGER,
ADD COLUMN     "certificateAutoIssue" BOOLEAN NOT NULL DEFAULT false;
