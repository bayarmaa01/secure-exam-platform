#!/bin/bash

echo "Applying migration using local PostgreSQL connection..."

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="exam_platform"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Check if PostgreSQL is accessible
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\q" 2>/dev/null; then
    echo "Error: Cannot connect to PostgreSQL. Please ensure:"
    echo "1. PostgreSQL is running"
    echo "2. Database 'exam_platform' exists"
    echo "3. Connection details are correct"
    echo "4. User has necessary permissions"
    exit 1
fi

echo "Running migration..."

# Apply the migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Migration 007: Update exam and question types for unified system

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

SELECT 'Migration completed successfully!' as result;
EOF

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
    echo "Restarting backend to apply changes..."
    docker-compose restart backend
    echo "Done! The exam system now supports MCQ, Writing, Coding, and Mixed exams."
else
    echo "Migration failed. Please check the error above."
    exit 1
fi
