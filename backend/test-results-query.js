const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testResultsQuery() {
  console.log('🧪 Testing Teacher Results query fix...\n');
  
  try {
    // Find an exam with attempts
    const examQuery = `
      SELECT e.id, e.title, e.status, e.teacher_id, u.name as teacher_name
      FROM exams e
      JOIN users u ON e.teacher_id = u.id
      ORDER BY e.created_at DESC
      LIMIT 1
    `;
    
    const examResult = await pool.query(examQuery);
    
    if (examResult.rows.length === 0) {
      console.log('❌ No exams found');
      return;
    }
    
    const exam = examResult.rows[0];
    console.log(`✅ Testing with exam: ${exam.title} (${exam.status})`);
    console.log(`   Teacher: ${exam.teacher_name}`);
    
    // Test the EXACT query from the backend
    const resultsQuery = `
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
    
    console.log(`\n🔍 Executing query for exam: ${exam.id}`);
    const result = await pool.query(resultsQuery, [exam.id]);
    
    console.log(`✅ Attempts found: ${result.rows.length}`);
    
    if (result.rows.length === 0) {
      console.log('\n❌ No attempts found - checking if any attempts exist for this exam...');
      
      const checkQuery = 'SELECT COUNT(*) as count FROM exam_attempts WHERE exam_id = $1';
      const checkResult = await pool.query(checkQuery, [exam.id]);
      console.log(`   Total attempts in database: ${checkResult.rows[0].count}`);
      
      if (checkResult.rows[0].count > 0) {
        console.log('   ⚠️  Attempts exist but query returned 0 - there might be a JOIN issue');
        
        // Test without violations JOIN
        const simpleQuery = `
          SELECT 
            a.id AS attempt_id,
            a.exam_id,
            a.user_id,
            u.name,
            u.email,
            a.status,
            a.submitted_at
          FROM exam_attempts a
          JOIN users u ON u.id = a.user_id
          WHERE a.exam_id = $1
          ORDER BY a.created_at DESC
        `;
        
        const simpleResult = await pool.query(simpleQuery, [exam.id]);
        console.log(`   Simple query returns: ${simpleResult.rows.length} rows`);
        
        simpleResult.rows.forEach((row, index) => {
          console.log(`     ${index + 1}. ${row.name} - ${row.status} - ${row.submitted_at || 'Not submitted'}`);
        });
      }
    } else {
      console.log('\n📋 Attempts found:');
      result.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name} (${row.email})`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Score: ${row.score || 'Not graded'}`);
        console.log(`      Submitted: ${row.submitted_at || 'Not submitted'}`);
        console.log(`      Violations: ${row.violations_count || 0}`);
        console.log('');
      });
    }
    
    // Test the API response format
    const apiResponse = {
      success: true,
      results: result.rows.map(row => ({
        attemptId: row.attempt_id,
        student: {
          name: row.name,
          email: row.email,
          rollNumber: row.student_id
        },
        score: parseFloat(row.score) || 0,
        percentage: parseFloat(row.percentage) || 0,
        status: row.status,
        submittedAt: row.submitted_at,
        gradedAt: row.graded_at,
        feedback: row.feedback,
        violationsCount: row.violations_count,
        violations: row.violations,
        riskScore: row.risk_score
      }))
    };
    
    console.log(`📡 API Response: ${apiResponse.results.length} results`);
    
    // Check if we have writing exams with pending_review
    const writingAttempts = result.rows.filter(row => row.status === 'pending_review');
    if (writingAttempts.length > 0) {
      console.log(`✅ Found ${writingAttempts.length} writing exam attempts with pending_review status`);
    }
    
    // Check if we have terminated attempts
    const terminatedAttempts = result.rows.filter(row => row.status === 'terminated');
    if (terminatedAttempts.length > 0) {
      console.log(`✅ Found ${terminatedAttempts.length} terminated attempts`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testResultsQuery().catch(console.error);
