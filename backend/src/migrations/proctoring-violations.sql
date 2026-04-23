-- Create proctoring_violations table
CREATE TABLE IF NOT EXISTS proctoring_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL,
    session_id VARCHAR(255),
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_attempt_id ON proctoring_violations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_student_id ON proctoring_violations(student_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_exam_id ON proctoring_violations(exam_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_timestamp ON proctoring_violations(timestamp);

-- Add violations_count column to exam_attempts if it doesn't exist
ALTER TABLE exam_attempts 
ADD COLUMN IF NOT EXISTS violations_count INTEGER DEFAULT 0;

-- Add session_id column to exam_attempts if it doesn't exist
ALTER TABLE exam_attempts 
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
