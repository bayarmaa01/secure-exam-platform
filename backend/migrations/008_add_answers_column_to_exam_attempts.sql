-- Migration 008: Add missing answers column to exam_attempts table
-- This migration fixes the "column ea.answers does not exist" error in grading routes

-- Add missing answers column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name = 'answers'
    ) THEN
        ALTER TABLE exam_attempts ADD COLUMN answers JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added answers column to exam_attempts table';
    ELSE
        RAISE NOTICE 'answers column already exists in exam_attempts table';
    END IF;
END
$$;

-- Add comment for documentation
COMMENT ON COLUMN exam_attempts.answers IS 'Student answers stored as JSON object';

RAISE NOTICE 'Migration 008: Add answers column to exam_attempts completed successfully';
