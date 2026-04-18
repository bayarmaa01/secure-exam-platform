-- Migration: Add unique index for active attempts
-- Ensures only ONE in_progress attempt per user per exam

-- Create unique index for active attempts
-- This prevents duplicate in_progress attempts at the database level
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_attempt
ON exam_attempts (exam_id, user_id)
WHERE status = 'in_progress';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 006: Created unique index for active attempts';
    RAISE NOTICE 'This ensures only one in_progress attempt per user per exam';
END $$;
