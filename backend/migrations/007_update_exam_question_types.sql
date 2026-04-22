-- Migration 007: Update exam and question types for unified system
-- Supports MCQ, Writing, Coding, and Mixed exams

-- Update exams table type constraint
ALTER TABLE exams 
DROP CONSTRAINT IF EXISTS exams_type_check;

ALTER TABLE exams 
ADD CONSTRAINT exams_type_check 
CHECK (type IN ('mcq', 'writing', 'coding', 'mixed', 'ai_proctored'));

-- Update questions table to support all new types
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_type_check;

ALTER TABLE questions 
ADD CONSTRAINT questions_type_check 
CHECK (type IN ('mcq', 'short_answer', 'long_answer', 'coding'));

-- Add new columns for coding questions
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS language VARCHAR(20),
ADD COLUMN IF NOT EXISTS starter_code JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS test_cases JSONB DEFAULT '[]'::jsonb;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_language ON questions(language);

-- Update existing questions with type 'text' to 'short_answer'
UPDATE questions 
SET type = 'short_answer' 
WHERE type = 'text';

-- Update existing exams with type 'written' to 'writing'
UPDATE exams 
SET type = 'writing' 
WHERE type = 'written';

COMMIT;
