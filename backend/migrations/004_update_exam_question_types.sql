-- Migration 004: Update Exam and Question Types for Unified System
-- This migration standardizes exam types and question types according to the new design

-- Update exams table to use standardized exam types
ALTER TABLE exams 
DROP CONSTRAINT IF EXISTS exams_type_check;

ALTER TABLE exams 
ADD CONSTRAINT exams_type_check 
CHECK (type IN ('mcq', 'writing', 'coding', 'mixed', 'ai_proctored'));

-- Update questions table to use standardized question types and add missing fields
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_type_check;

-- First, add the new columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'questions' AND column_name = 'language') THEN
        ALTER TABLE questions ADD COLUMN language VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'questions' AND column_name = 'starter_code') THEN
        ALTER TABLE questions ADD COLUMN starter_code JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'questions' AND column_name = 'test_cases') THEN
        ALTER TABLE questions ADD COLUMN test_cases JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Update the question type constraint
ALTER TABLE questions 
ADD CONSTRAINT questions_type_check 
CHECK (type IN ('mcq', 'short_answer', 'long_answer', 'coding'));

-- Migrate existing data from 'text' type to 'short_answer'
UPDATE questions 
SET type = 'short_answer' 
WHERE type = 'text';

-- Migrate existing exam types from 'written' to 'writing'
UPDATE exams 
SET type = 'writing' 
WHERE type = 'written';

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_language ON questions(language);
CREATE INDEX IF NOT EXISTS idx_exams_type ON exams(type);

-- Add comments for documentation
COMMENT ON COLUMN exams.type IS 'Exam type: mcq, writing, coding, mixed, ai_proctored';
COMMENT ON COLUMN questions.type IS 'Question type: mcq, short_answer, long_answer, coding';
COMMENT ON COLUMN questions.language IS 'Programming language for coding questions (python, java, cpp, javascript, c)';
COMMENT ON COLUMN questions.starter_code IS 'JSON object with starter code for different languages';
COMMENT ON COLUMN questions.test_cases IS 'JSON array of test cases for coding questions';

COMMIT;
