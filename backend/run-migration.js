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
    console.log('Running proctoring violations migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'src', 'migrations', 'proctoring-violations.sql'), 
      'utf8'
    );
    
    await pool.query(migrationSQL);
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
