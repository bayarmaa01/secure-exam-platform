-- Migration 006: Add University Subjects Support
-- This migration adds subjects table and updates courses to include subjects

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert university-level subjects
INSERT INTO subjects (name, code, description, department) VALUES
('Data Structures', 'DS101', 'Fundamental data structures and algorithms', 'Computer Science'),
('Databases', 'DB201', 'Database design and management systems', 'Computer Science'),
('Operating Systems', 'OS301', 'Operating system concepts and implementation', 'Computer Science'),
('Computer Networks', 'CN401', 'Network protocols and architectures', 'Computer Science'),
('C Programming', 'C101', 'C language programming fundamentals', 'Computer Science'),
('HTML/CSS', 'WEB101', 'Web development fundamentals', 'Computer Science'),
('Algorithms', 'ALG201', 'Algorithm design and analysis', 'Computer Science'),
('Software Engineering', 'SE301', 'Software development methodologies', 'Computer Science'),
('Artificial Intelligence', 'AI401', 'Introduction to AI and machine learning', 'Computer Science'),
('Cybersecurity', 'CS401', 'Information security and protection', 'Computer Science')
ON CONFLICT (name) DO NOTHING;

-- Add subject_id column to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id);

-- Update existing courses to have a default subject
UPDATE courses 
SET subject_id = (SELECT id FROM subjects WHERE code = 'CS101')
WHERE subject_id IS NULL;

-- Add index for subject_id
CREATE INDEX IF NOT EXISTS idx_courses_subject_id ON courses(subject_id);

-- Add comment for documentation
COMMENT ON COLUMN courses.subject_id IS 'Reference to the subject this course belongs to';

COMMIT;
