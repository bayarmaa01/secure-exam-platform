-- Create proctoring_events table for AI proctoring system
CREATE TABLE IF NOT EXISTS proctoring_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'face_detected', 'no_face', 'multiple_faces', 'tab_switch', 'frame_gap'
    event_data JSONB, -- Additional event-specific data
    risk_score INTEGER DEFAULT 0,
    cheating_probability DECIMAL(3,2), -- 0.00 to 1.00
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proctoring_events_session_id ON proctoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_attempt_id ON proctoring_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_student_id ON proctoring_events(student_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_timestamp ON proctoring_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_type ON proctoring_events(event_type);

-- Create a summary table for quick access to proctoring statistics
CREATE TABLE IF NOT EXISTS proctoring_session_summary (
    session_id VARCHAR(255) PRIMARY KEY,
    attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    final_risk_score INTEGER DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high'
    total_events INTEGER DEFAULT 0,
    face_detection_count INTEGER DEFAULT 0,
    no_face_count INTEGER DEFAULT 0,
    multiple_faces_count INTEGER DEFAULT 0,
    tab_switch_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_summary_attempt_id ON proctoring_session_summary(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_summary_student_id ON proctoring_session_summary(student_id);
