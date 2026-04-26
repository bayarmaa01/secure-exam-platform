-- Migration 007: Fix exam_attempts table schema
-- This migration adds missing columns that are causing 500 errors in grading routes

-- Add missing started_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name = 'started_at'
    ) THEN
        ALTER TABLE exam_attempts ADD COLUMN started_at TIMESTAMP DEFAULT NOW();
    END IF;
END
$$;

-- Add any other missing columns that might be referenced
DO $$
BEGIN
    -- Check and add submitted_at column if missing
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name = 'submitted_at'
    ) THEN
        ALTER TABLE exam_attempts ADD COLUMN submitted_at TIMESTAMP;
    END IF;

    -- Check and add graded_at column if missing
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name = 'graded_at'
    ) THEN
        ALTER TABLE exam_attempts ADD COLUMN graded_at TIMESTAMP;
    END IF;

    -- Check and add graded_by column if missing
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name = 'graded_by'
    ) THEN
        ALTER TABLE exam_attempts ADD COLUMN graded_by UUID REFERENCES users(id);
    END IF;

    -- Check and add feedback column if missing
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name = 'feedback'
    ) THEN
        ALTER TABLE exam_attempts ADD COLUMN feedback TEXT;
    END IF;
END
$$;
