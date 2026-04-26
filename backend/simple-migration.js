const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'SecureExamPlatform2024!',
  });

  try {
    console.log('Running exam_attempts schema update...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'src', 'migrations', '002_update_exam_attempts_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Extract just the ALTER TABLE statements (skip the migrations table part)
    const alterTableStatements = migrationSQL
      .split('-- Insert into migrations table')[0] // Get only the ALTER TABLE part
      .trim();
    
    console.log('Executing schema updates...');
    await pool.query(alterTableStatements);
    console.log('Schema updates completed successfully!');
    
    // Verify the changes
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'exam_attempts' 
      AND column_name IN ('violations_count', 'feedback', 'graded_at', 'graded_by')
      ORDER BY column_name
    `);
    
    console.log('Updated columns:');
    if (result.rows.length === 0) {
      console.log('  No new columns found (they may already exist)');
    } else {
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    // Check if status constraint was updated
    const statusCheck = await pool.query(`
      SELECT con.conname, con.consrc 
      FROM pg_constraint con 
      INNER JOIN pg_class rel ON rel.oid = con.conrelid 
      WHERE rel.relname = 'exam_attempts' 
      AND con.conname LIKE '%status%'
    `);
    
    console.log('Status constraints:');
    statusCheck.rows.forEach(constraint => {
      console.log(`  - ${constraint.conname}: ${constraint.consrc}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
