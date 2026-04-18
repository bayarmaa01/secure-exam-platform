-- Migration 005: Fix answers table schema
-- This migration ensures the answers table has all required columns
-- and fixes any missing columns that might cause "column does not exist" errors

-- Check if answers table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'answers'
    ) THEN
        CREATE TABLE answers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
            question_id UUID REFERENCES questions(id),
            answer TEXT,
            is_correct BOOLEAN,
            points_earned DECIMAL(5,2) DEFAULT 0,
            time_taken INT,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(attempt_id, question_id)
        );
        RAISE NOTICE 'Created answers table';
    END IF;
END
$$;

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Check and add is_correct column
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'is_correct'
    ) THEN
        ALTER TABLE answers ADD COLUMN is_correct BOOLEAN;
        RAISE NOTICE 'Added is_correct column to answers table';
    END IF;

    -- Check and add points_earned column
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'points_earned'
    ) THEN
        ALTER TABLE answers ADD COLUMN points_earned DECIMAL(5,2) DEFAULT 0;
        RAISE NOTICE 'Added points_earned column to answers table';
    END IF;

    -- Check and add time_taken column
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'time_taken'
    ) THEN
        ALTER TABLE answers ADD COLUMN time_taken INT;
        RAISE NOTICE 'Added time_taken column to answers table';
    END IF;

    -- Check and add created_at column
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE answers ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to answers table';
    END IF;

    -- Check and add id column (primary key)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE answers ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
        RAISE NOTICE 'Added id column to answers table';
    END IF;

    -- Check and add attempt_id foreign key
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'attempt_id'
    ) THEN
        ALTER TABLE answers ADD COLUMN attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added attempt_id column to answers table';
    END IF;

    -- Check and add question_id foreign key
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'question_id'
    ) THEN
        ALTER TABLE answers ADD COLUMN question_id UUID REFERENCES questions(id);
        RAISE NOTICE 'Added question_id column to answers table';
    END IF;

    -- Check and add answer column
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'answer'
    ) THEN
        ALTER TABLE answers ADD COLUMN answer TEXT;
        RAISE NOTICE 'Added answer column to answers table';
    END IF;
END
$$;

-- Ensure proper indexes exist for performance
DO $$
BEGIN
    -- Create index for attempt_id if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'answers' 
        AND indexname = 'idx_answers_attempt_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);
        RAISE NOTICE 'Created idx_answers_attempt_id index';
    END IF;

    -- Create index for question_id if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'answers' 
        AND indexname = 'idx_answers_question_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
        RAISE NOTICE 'Created idx_answers_question_id index';
    END IF;

    -- Create unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_constraint 
        WHERE conname = 'answers_attempt_id_question_id_unique'
    ) THEN
        ALTER TABLE answers ADD CONSTRAINT answers_attempt_id_question_id_unique UNIQUE(attempt_id, question_id);
        RAISE NOTICE 'Created unique constraint on (attempt_id, question_id)';
    END IF;
END
$$;

-- Add comments for better documentation
COMMENT ON TABLE answers IS 'Stores student answers for exam attempts with grading information';
COMMENT ON COLUMN answers.id IS 'Primary key UUID for the answer record';
COMMENT ON COLUMN answers.attempt_id IS 'Foreign key to exam_attempts table';
COMMENT ON COLUMN answers.question_id IS 'Foreign key to questions table';
COMMENT ON COLUMN answers.answer IS 'The student\'s answer text or selection';
COMMENT ON COLUMN answers.is_correct IS 'Whether the answer is correct (auto-graded)';
COMMENT ON COLUMN answers.points_earned IS 'Points earned for this answer';
COMMENT ON COLUMN answers.time_taken IS 'Time taken to answer this question (in seconds)';
COMMENT ON COLUMN answers.created_at IS 'Timestamp when the answer was submitted';

RAISE NOTICE 'Migration 005: Answers table schema fix completed successfully';
