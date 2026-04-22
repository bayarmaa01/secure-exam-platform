-- Migration 005: Add session_id to warnings table
-- This migration adds the session_id column to support tracking warning sessions

ALTER TABLE warnings 
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Add index for session_id for better query performance
CREATE INDEX IF NOT EXISTS idx_warnings_session_id ON warnings(session_id);

-- Add comment for documentation
COMMENT ON COLUMN warnings.session_id IS 'Session identifier for grouping related warnings during an exam session';

COMMIT;
