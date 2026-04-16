-- Create exam sessions table for live exam management
CREATE TABLE exam_sessions (
    id SERIAL PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NOT NULL,
    server_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    answers JSONB,
    score INTEGER DEFAULT 0,
    percentage DECIMAL(5,2) DEFAULT 0,
    violation_count INTEGER DEFAULT 0,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_exam_sessions_exam_id ON exam_sessions(exam_id);
CREATE INDEX idx_exam_sessions_user_id ON exam_sessions(user_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions(status);
CREATE INDEX idx_exam_sessions_course_id ON exam_sessions(course_id);

-- Add comments
COMMENT ON TABLE exam_sessions IS 'Live exam sessions with server-controlled timing and anti-cheat monitoring';
COMMENT ON COLUMN exam_sessions.status IS 'Session status: active, submitted, force_submitted';
COMMENT ON COLUMN exam_sessions.answers IS 'Student answers stored as JSON';
COMMENT ON COLUMN exam_sessions.violation_count IS 'Number of cheating violations detected';

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_exam_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exam_sessions_updated_at
    BEFORE UPDATE ON exam_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_exam_sessions_updated_at();
