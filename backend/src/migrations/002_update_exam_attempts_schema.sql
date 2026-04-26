-- Migration 002: Update exam_attempts table for grading system
-- Add new columns and update status constraint

-- Add new columns if they don't exist
ALTER TABLE exam_attempts 
ADD COLUMN IF NOT EXISTS violations_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback TEXT,
ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES users(id);

-- Update the status constraint to include new statuses
-- First drop the existing constraint (PostgreSQL allows this if it doesn't exist)
DO $$ 
BEGIN
    ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Constraint doesn't exist, that's fine
END $$;

-- Add the updated constraint
ALTER TABLE exam_attempts 
ADD CONSTRAINT exam_attempts_status_check 
CHECK (status IN ('in_progress', 'submitted', 'pending_review', 'graded', 'terminated'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exam_attempts_graded_by ON exam_attempts(graded_by);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_graded_at ON exam_attempts(graded_at);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);

-- Update any existing records that might need status updates
UPDATE exam_attempts 
SET status = 'pending_review' 
WHERE status IN ('submitted') 
AND exam_id IN (
    SELECT id FROM exams 
    WHERE type IN ('writing', 'coding')
);

-- Log the migration
INSERT INTO migrations (id, name, executed_at) 
VALUES ('002_update_exam_attempts_schema', 'Update exam_attempts for grading system', NOW())
ON CONFLICT (id) DO NOTHING;
