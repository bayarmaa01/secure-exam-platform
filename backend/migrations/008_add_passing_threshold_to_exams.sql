-- Add passing_threshold column to exams table
-- This column is needed for exam submission scoring logic

ALTER TABLE exams 
ADD COLUMN passing_threshold INTEGER DEFAULT 50;

-- Add comment to document the column
COMMENT ON COLUMN exams.passing_threshold IS 'Minimum percentage score required to pass the exam (default: 50)';

-- Update existing exams to have the default passing threshold
UPDATE exams 
SET passing_threshold = 50 
WHERE passing_threshold IS NULL;
