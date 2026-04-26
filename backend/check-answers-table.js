const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkAnswersTable() {
  console.log('🔍 Checking answers table...\n');
  
  try {
    // Check if answers table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'answers'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ answers table does not exist');
      return;
    }
    
    console.log('✅ answers table exists');
    
    // Check table structure
    const columnsQuery = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'answers' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table structure:');
    columnsQuery.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
    // Check total answers
    const countQuery = await pool.query('SELECT COUNT(*) as count FROM answers');
    console.log(`\n📊 Total answers in table: ${countQuery.rows[0].count}`);
    
    // Get sample answers if any exist
    if (countQuery.rows[0].count > 0) {
      const sampleQuery = await pool.query(`
        SELECT * FROM answers 
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      
      console.log('\n📝 Sample answers:');
      sampleQuery.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. Attempt: ${row.attempt_id}, Question: ${row.question_id}`);
        console.log(`      Answer: ${row.answer}`);
        console.log(`      Points: ${row.points_earned}, Correct: ${row.is_correct}`);
      });
    }
    
    // Check attempts vs answers
    const attemptsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status IN ('submitted', 'pending_review', 'graded') THEN 1 END) as submitted_attempts
      FROM exam_attempts
    `);
    
    const attemptsStats = attemptsQuery.rows[0];
    console.log('\n📈 Attempts vs Answers:');
    console.log(`   Total attempts: ${attemptsStats.total_attempts}`);
    console.log(`   Submitted attempts: ${attemptsStats.submitted_attempts}`);
    console.log(`   Answers saved: ${countQuery.rows[0].count}`);
    
    if (attemptsStats.submitted_attempts > 0 && countQuery.rows[0].count === 0) {
      console.log('\n⚠️  ISSUE: Submitted attempts exist but no answers are saved!');
      console.log('   This means the answer submission process is not working.');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkAnswersTable().catch(console.error);
