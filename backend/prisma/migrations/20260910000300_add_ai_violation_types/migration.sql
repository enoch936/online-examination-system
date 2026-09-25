-- Add new ViolationType enum values for AI-detected violations.
-- Recorded server-side in recordEvent when the proctoring client emits
-- face/motion/audio signals so they surface as real violations in the monitor.
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'MOTION';

ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'AUDIO_ACTIVITY';