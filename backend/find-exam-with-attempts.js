const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function findExamWithAttempts() {
  console.log('🔍 Finding exam with attempts...\n');
  
  try {
    // Find exams that have attempts
    const examsWithAttemptsQuery = `
      SELECT DISTINCT 
        e.id, 
        e.title, 
        e.status, 
        e.teacher_id, 
        u.name as teacher_name,
        COUNT(a.id) as attempt_count
      FROM exams e
      JOIN users u ON e.teacher_id = u.id
      LEFT JOIN exam_attempts a ON e.id = a.exam_id
      GROUP BY e.id, e.title, e.status, e.teacher_id, u.name
      HAVING COUNT(a.id) > 0
      ORDER BY COUNT(a.id) DESC
      LIMIT 3
    `;
    
    const result = await pool.query(examsWithAttemptsQuery);
    
    if (result.rows.length === 0) {
      console.log('❌ No exams with attempts found');
      
      // Check if there are any attempts at all
      const totalAttemptsQuery = 'SELECT COUNT(*) as count FROM exam_attempts';
      const totalAttemptsResult = await pool.query(totalAttemptsQuery);
      console.log(`   Total attempts in database: ${totalAttemptsResult.rows[0].count}`);
      
      // Check if there are any exams at all
      const totalExamsQuery = 'SELECT COUNT(*) as count FROM exams';
      const totalExamsResult = await pool.query(totalExamsQuery);
      console.log(`   Total exams in database: ${totalExamsResult.rows[0].count}`);
      
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} exams with attempts:\n`);
    
    result.rows.forEach((exam, index) => {
      console.log(`${index + 1}. ${exam.title} (${exam.status})`);
      console.log(`   Teacher: ${exam.teacher_name}`);
      console.log(`   Attempts: ${exam.attempt_count}`);
      console.log('');
    });
    
    // Test the first exam with attempts
    const testExam = result.rows[0];
    console.log(`🧪 Testing with exam: ${testExam.title}`);
    
    // Test the exact query from the backend
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
    
    const queryResult = await pool.query(resultsQuery, [testExam.id]);
    
    console.log(`✅ Query returned ${queryResult.rows.length} results`);
    
    if (queryResult.rows.length > 0) {
      console.log('\n📋 Attempt details:');
      queryResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name} (${row.email})`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Score: ${row.score || 'Not graded'}`);
        console.log(`      Submitted: ${row.submitted_at || 'Not submitted'}`);
        console.log('');
      });
      
      // Check status distribution
      const statusCounts = {};
      queryResult.rows.forEach(row => {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      });
      
      console.log('📊 Status distribution:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      
      // Test API response format
      const apiResponse = {
        success: true,
        results: queryResult.rows.map(row => ({
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
      
      console.log(`\n📡 API Response: ${apiResponse.results.length} results`);
      console.log('✅ Query is working correctly!');
      
    } else {
      console.log('❌ Query returned 0 results despite having attempts');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

findExamWithAttempts().catch(console.error);
