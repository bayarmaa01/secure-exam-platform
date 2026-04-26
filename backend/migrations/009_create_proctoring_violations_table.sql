-- Migration 009: Create proctoring_violations table and enhance proctoring system
-- This migration creates the violations table and adds missing columns for enhanced proctoring visibility

-- Create proctoring_violations table if it doesn't exist
CREATE TABLE IF NOT EXISTS proctoring_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL,
    student_id UUID NOT NULL,
    exam_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL, -- tab_switch, copy_paste, fullscreen_exit, etc.
    details JSONB, -- additional violation details
    timestamp TIMESTAMP DEFAULT NOW(),
    session_id VARCHAR(255),
    risk_score INT DEFAULT 0
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Check and add foreign key for attempt_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'proctoring_violations'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'attempt_id'
    ) THEN
        ALTER TABLE proctoring_violations 
        ADD CONSTRAINT fk_proctoring_violations_attempt_id 
        FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key for attempt_id';
    END IF;
    
    -- Check and add foreign key for student_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'proctoring_violations'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'student_id'
    ) THEN
        ALTER TABLE proctoring_violations 
        ADD CONSTRAINT fk_proctoring_violations_student_id 
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key for student_id';
    END IF;
    
    -- Check and add foreign key for exam_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'proctoring_violations'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'exam_id'
    ) THEN
        ALTER TABLE proctoring_violations 
        ADD CONSTRAINT fk_proctoring_violations_exam_id 
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key for exam_id';
    END IF;
END
$$;

-- Ensure violations_count column exists in exam_attempts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name = 'violations_count'
    ) THEN
        ALTER TABLE exam_attempts ADD COLUMN violations_count INT DEFAULT 0;
        RAISE NOTICE 'Added violations_count column to exam_attempts';
    END IF;
END
$$;

-- Add indexes for better performance
DO $$
BEGIN
    -- Index on attempt_id for fast lookups
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'proctoring_violations' 
        AND indexname = 'idx_proctoring_violations_attempt_id'
    ) THEN
        CREATE INDEX idx_proctoring_violations_attempt_id ON proctoring_violations(attempt_id);
        RAISE NOTICE 'Created index on attempt_id';
    END IF;
    
    -- Index on exam_id for teacher queries
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'proctoring_violations' 
        AND indexname = 'idx_proctoring_violations_exam_id'
    ) THEN
        CREATE INDEX idx_proctoring_violations_exam_id ON proctoring_violations(exam_id);
        RAISE NOTICE 'Created index on exam_id';
    END IF;
    
    -- Index on timestamp for ordering
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'proctoring_violations' 
        AND indexname = 'idx_proctoring_violations_timestamp'
    ) THEN
        CREATE INDEX idx_proctoring_violations_timestamp ON proctoring_violations(timestamp DESC);
        RAISE NOTICE 'Created index on timestamp';
    END IF;
    
    -- Index on type for filtering
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'proctoring_violations' 
        AND indexname = 'idx_proctoring_violations_type'
    ) THEN
        CREATE INDEX idx_proctoring_violations_type ON proctoring_violations(type);
        RAISE NOTICE 'Created index on type';
    END IF;
END
$$;

-- Add comments for documentation
COMMENT ON TABLE proctoring_violations IS 'Stores proctoring violations for exam attempts with detailed tracking';
COMMENT ON COLUMN proctoring_violations.type IS 'Type of violation: tab_switch, copy_paste, fullscreen_exit, etc.';
COMMENT ON COLUMN proctoring_violations.details IS 'Additional violation details as JSON object';
COMMENT ON COLUMN proctoring_violations.risk_score IS 'Risk score contribution of this violation';
COMMENT ON COLUMN exam_attempts.violations_count IS 'Total number of violations for this attempt';

RAISE NOTICE 'Migration 009: Proctoring violations table setup completed successfully';
