const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkAllAttempts() {
  console.log('🔍 Checking all exam attempts...\n');
  
  try {
    // Get all exam attempts
    const attemptsQuery = `
      SELECT 
        a.id,
        a.exam_id,
        a.user_id,
        a.status,
        a.submitted_at,
        a.created_at,
        e.title as exam_title,
        e.status as exam_status,
        u.name as student_name,
        u.email as student_email
      FROM exam_attempts a
      JOIN exams e ON a.exam_id = e.id
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `;
    
    const attemptsResult = await pool.query(attemptsQuery);
    
    console.log(`✅ Found ${attemptsResult.rows.length} recent attempts:\n`);
    
    if (attemptsResult.rows.length === 0) {
      console.log('❌ No exam attempts found in database');
      
      // Check if there are any exams at all
      const examsQuery = 'SELECT COUNT(*) as count FROM exams';
      const examsResult = await pool.query(examsQuery);
      console.log(`   Total exams: ${examsResult.rows[0].count}`);
      
      // Check if there are any users
      const usersQuery = 'SELECT COUNT(*) as count FROM users';
      const usersResult = await pool.query(usersQuery);
      console.log(`   Total users: ${usersResult.rows[0].count}`);
      
      return;
    }
    
    attemptsResult.rows.forEach((attempt, index) => {
      console.log(`${index + 1}. Attempt: ${attempt.id}`);
      console.log(`   Student: ${attempt.student_name} (${attempt.student_email})`);
      console.log(`   Exam: ${attempt.exam_title} (${attempt.exam_status})`);
      console.log(`   Status: ${attempt.status}`);
      console.log(`   Created: ${attempt.created_at}`);
      console.log(`   Submitted: ${attempt.submitted_at || 'Not submitted'}`);
      console.log('');
    });
    
    // Test the fixed query with an actual attempt
    if (attemptsResult.rows.length > 0) {
      const testAttempt = attemptsResult.rows[0];
      console.log(`🧪 Testing fixed query with exam: ${testAttempt.exam_id}`);
      
      const fixedQuery = `
        SELECT 
          a.id AS attempt_id,
          a.exam_id,
          a.user_id,
          u.name,
          u.email,
          a.score,
          a.total_points,
          a.percentage,
          a.status,
          a.submitted_at,
          a.graded_at,
          a.feedback,
          a.violations_count,
          COALESCE(violation_details.violations, '[]') as violations,
          COALESCE(violation_details.risk_score, 0) as risk_score
        FROM exam_attempts a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN (
          SELECT 
            pv.attempt_id,
            COUNT(pv.id) as violation_count,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'type', pv.type,
                'time', pv.timestamp,
                'details', pv.details
              ) ORDER BY pv.timestamp DESC
            ) as violations,
            COALESCE(SUM(pv.risk_score), 0) as risk_score
          FROM proctoring_violations pv
          GROUP BY pv.attempt_id
        ) violation_details ON violation_details.attempt_id = a.id
        WHERE a.exam_id = $1
        ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC
      `;
      
      const queryResult = await pool.query(fixedQuery, [testAttempt.exam_id]);
      console.log(`✅ Fixed query returned ${queryResult.rows.length} results`);
      
      // Test old restrictive query for comparison
      const oldQuery = `
        SELECT
          u.name,
          u.email,
          u.student_id,
          a.id as attempt_id,
          a.score,
          a.percentage,
          a.status,
          a.submitted_at,
          a.graded_at,
          a.feedback,
          a.violations_count,
          COALESCE(violation_details.violations, '[]') as violations,
          COALESCE(violation_details.risk_score, 0) as risk_score
        FROM exam_attempts a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN (
          SELECT 
            pv.attempt_id,
            COUNT(pv.id) as violation_count,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'type', pv.type,
                'time', pv.timestamp,
                'details', pv.details
              ) ORDER BY pv.timestamp DESC
            ) as violations,
            COALESCE(SUM(pv.risk_score), 0) as risk_score
          FROM proctoring_violations pv
          GROUP BY pv.attempt_id
        ) violation_details ON violation_details.attempt_id = a.id
        WHERE a.exam_id = $1
        AND a.status IN ('submitted', 'terminated', 'pending_review', 'graded')
        AND a.submitted_at IS NOT NULL
        ORDER BY a.submitted_at DESC
      `;
      
      const oldResult = await pool.query(oldQuery, [testAttempt.exam_id]);
      console.log(`❌ Old restrictive query returned: ${oldResult.rows.length} results`);
      
      console.log('\n🎯 COMPARISON:');
      console.log(`   Fixed query: ${queryResult.rows.length} results`);
      console.log(`   Old query: ${oldResult.rows.length} results`);
      console.log(`   Improvement: +${queryResult.rows.length - oldResult.rows.length} results`);
      
      if (queryResult.rows.length > 0) {
        console.log('\n📋 Sample result from fixed query:');
        const row = queryResult.rows[0];
        console.log(`   Student: ${row.name} (${row.email})`);
        console.log(`   Status: ${row.status}`);
        console.log(`   Submitted: ${row.submitted_at || 'Not submitted'}`);
        console.log(`   Score: ${row.score || 'Not graded'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkAllAttempts().catch(console.error);
