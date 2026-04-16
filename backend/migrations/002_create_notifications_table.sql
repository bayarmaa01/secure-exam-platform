-- Create notifications table for exam announcements and system messages

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Add comments
COMMENT ON TABLE notifications IS 'Notifications for users about exams and system events';
COMMENT ON COLUMN notifications.type IS 'Notification type: exam_created, exam_reminder, general';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read by the user';
