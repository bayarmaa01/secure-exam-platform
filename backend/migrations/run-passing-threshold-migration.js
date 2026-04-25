const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function addPassingThresholdColumn() {
  console.log('Adding passing_threshold column to exams table...');
  
  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'exams' 
      AND column_name = 'passing_threshold'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Column passing_threshold already exists');
      return;
    }
    
    // Add the column
    await pool.query(`
      ALTER TABLE exams 
      ADD COLUMN passing_threshold INTEGER DEFAULT 50
    `);
    
    // Add comment
    await pool.query(`
      COMMENT ON COLUMN exams.passing_threshold IS 'Minimum percentage score required to pass the exam (default: 50)'
    `);
    
    // Update existing rows
    await pool.query(`
      UPDATE exams 
      SET passing_threshold = 50 
      WHERE passing_threshold IS NULL
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('Added passing_threshold column to exams table with default value of 50');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
addPassingThresholdColumn().catch(console.error);
