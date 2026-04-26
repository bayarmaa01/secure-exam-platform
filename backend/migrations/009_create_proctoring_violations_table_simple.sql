-- Create proctoring_violations table
CREATE TABLE IF NOT EXISTS proctoring_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL,
    student_id UUID NOT NULL,
    exam_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT NOW(),
    session_id VARCHAR(255),
    risk_score INT DEFAULT 0
);

-- Add foreign key constraints
ALTER TABLE proctoring_violations 
ADD CONSTRAINT fk_proctoring_violations_attempt_id 
FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE;

ALTER TABLE proctoring_violations 
ADD CONSTRAINT fk_proctoring_violations_student_id 
FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE proctoring_violations 
ADD CONSTRAINT fk_proctoring_violations_exam_id 
FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

-- Ensure violations_count column exists in exam_attempts
ALTER TABLE exam_attempts 
ADD COLUMN violations_count INT DEFAULT 0;

-- Add indexes for performance
CREATE INDEX idx_proctoring_violations_attempt_id ON proctoring_violations(attempt_id);
CREATE INDEX idx_proctoring_violations_exam_id ON proctoring_violations(exam_id);
CREATE INDEX idx_proctoring_violations_timestamp ON proctoring_violations(timestamp DESC);
CREATE INDEX idx_proctoring_violations_type ON proctoring_violations(type);
