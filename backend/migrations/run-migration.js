const { pool } = require('../dist/db.js');

async function runMigration() {
  console.log('Running migration 007_update_exam_question_types.sql...');
  
  try {
    const client = await pool.connect();
    
    // Update exams table type constraint
    await client.query(`
      ALTER TABLE exams 
      DROP CONSTRAINT IF EXISTS exams_type_check
    `);
    
    await client.query(`
      ALTER TABLE exams 
      ADD CONSTRAINT exams_type_check 
      CHECK (type IN ('mcq', 'writing', 'coding', 'mixed', 'ai_proctored'))
    `);
    
    // Update questions table to support all new types
    await client.query(`
      ALTER TABLE questions 
      DROP CONSTRAINT IF EXISTS questions_type_check
    `);
    
    await client.query(`
      ALTER TABLE questions 
      ADD CONSTRAINT questions_type_check 
      CHECK (type IN ('mcq', 'short_answer', 'long_answer', 'coding'))
    `);
    
    // Add new columns for coding questions
    await client.query(`
      ALTER TABLE questions 
      ADD COLUMN IF NOT EXISTS language VARCHAR(20),
      ADD COLUMN IF NOT EXISTS starter_code JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS test_cases JSONB DEFAULT '[]'::jsonb
    `);
    
    // Add indexes for new columns
    await client.query('CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_questions_language ON questions(language)');
    
    // Update existing questions with type 'text' to 'short_answer'
    const result1 = await client.query(`
      UPDATE questions 
      SET type = 'short_answer' 
      WHERE type = 'text'
    `);
    console.log(`Updated ${result1.rowCount} questions from 'text' to 'short_answer'`);
    
    // Update existing exams with type 'written' to 'writing'
    const result2 = await client.query(`
      UPDATE exams 
      SET type = 'writing' 
      WHERE type = 'written'
    `);
    console.log(`Updated ${result2.rowCount} exams from 'written' to 'writing'`);
    
    client.release();
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
