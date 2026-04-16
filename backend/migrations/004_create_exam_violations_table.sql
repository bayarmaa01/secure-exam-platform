-- Create exam violations table for anti-cheat monitoring
CREATE TABLE exam_violations (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_exam_violations_session_id ON exam_violations(session_id);
CREATE INDEX idx_exam_violations_user_id ON exam_violations(user_id);
CREATE INDEX idx_exam_violations_type ON exam_violations(type);
CREATE INDEX idx_exam_violations_timestamp ON exam_violations(timestamp);

-- Add comments
COMMENT ON TABLE exam_violations IS 'Anti-cheat violation tracking for live exams';
COMMENT ON COLUMN exam_violations.type IS 'Violation type: tab_switch, fullscreen_exit, copy_paste, right_click';
COMMENT ON COLUMN exam_violations.details IS 'Additional details about the violation';

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_exam_violations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exam_violations_updated_at
    BEFORE UPDATE ON exam_violations
    FOR EACH ROW
    EXECUTE FUNCTION update_exam_violations_updated_at();
