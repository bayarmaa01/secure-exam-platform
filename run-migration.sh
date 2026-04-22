#!/bin/bash

echo "Running database migration for exam system upgrade..."

# Copy migration script to app directory in container
docker cp quick-migration.js secure-exam-platform_backend_1:/app/

# Run migration from the app directory where node_modules is available
docker-compose exec backend node /app/quick-migration.js

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
    echo "Restarting backend to apply changes..."
    docker-compose restart backend
    echo "Done! The exam system now supports MCQ, Writing, Coding, and Mixed exams."
else
    echo "Migration failed. Trying alternative method..."
    
    echo "Running migration using built-in database connection..."
    docker-compose exec backend node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'exam_platform',
  user: 'postgres',
  password: 'postgres',
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Adding coding question columns...');
    await client.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS language VARCHAR(20)');
    await client.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS starter_code JSONB DEFAULT \\'{}\\'::jsonb');
    await client.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS test_cases JSONB DEFAULT \\'[]\\'::jsonb');
    
    console.log('Updating question types...');
    await client.query('UPDATE questions SET type = \\'short_answer\\' WHERE type = \\'text\\'');
    
    console.log('Updating exam types...');
    await client.query('UPDATE exams SET type = \\'writing\\' WHERE type = \\'written\\'');
    
    console.log('Migration completed successfully!');
  } catch (e) { 
    console.error('Migration error:', e.message); 
  }
  finally { 
    client.release(); 
    await pool.end(); 
  }
})();
"
    
    if [ $? -eq 0 ]; then
        echo "Alternative migration completed!"
        docker-compose restart backend
    else
        echo "Both migration methods failed. Please check database connection."
    fi
fi
