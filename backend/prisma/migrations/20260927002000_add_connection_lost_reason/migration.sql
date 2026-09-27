-- A connection loss under connectionLossPolicy = END_SESSION used to be recorded
-- as AUTO_INSTRUCTOR_END_SESSION, even though no instructor was involved. That
-- made "was this attempt ended by a human?" unanswerable from the row itself and
-- mis-attributed the cause in on-time reporting and proctoring review.
--
-- Adding a value to an enum is additive; no existing row changes meaning.
ALTER TYPE "SubmissionReason" ADD VALUE IF NOT EXISTS 'AUTO_CONNECTION_LOST';
