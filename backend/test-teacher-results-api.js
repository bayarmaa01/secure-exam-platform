const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testTeacherResultsAPI() {
  console.log('🧪 Testing Teacher Results API fix...\n');
  
  try {
    // Find a teacher and their exam
    const teacherExamQuery = `
      SELECT e.id, e.title, e.status, e.teacher_id, u.name as teacher_name, u.email as teacher_email
      FROM exams e
      JOIN users u ON e.teacher_id = u.id
      ORDER BY e.created_at DESC
      LIMIT 1
    `;
    
    const teacherExamResult = await pool.query(teacherExamQuery);
    
    if (teacherExamResult.rows.length === 0) {
      console.log('❌ No exams found');
      return;
    }
    
    const exam = teacherExamResult.rows[0];
    console.log(`✅ Found exam: ${exam.title} (${exam.status})`);
    console.log(`   Teacher: ${exam.teacher_name} (${exam.teacher_email})`);
    
    // Test the fixed query directly
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
    
    console.log(`\n🔍 Testing fixed query for exam: ${exam.id}`);
    const queryResult = await pool.query(fixedQuery, [exam.id]);
    
    console.log(`✅ Query returned ${queryResult.rows.length} results`);
    
    if (queryResult.rows.length > 0) {
      console.log('\n📋 Sample results:');
      queryResult.rows.slice(0, 3).forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name} (${row.email})`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Score: ${row.score || 'Not graded'}`);
        console.log(`      Submitted: ${row.submitted_at || 'Not submitted'}`);
        console.log(`      Violations: ${row.violations_count || 0}`);
        console.log('');
      });
    } else {
      console.log('\n📝 No attempts found for this exam');
      
      // Check if there are any attempts at all for this exam
      const anyAttemptsQuery = 'SELECT COUNT(*) as count FROM exam_attempts WHERE exam_id = $1';
      const anyAttemptsResult = await pool.query(anyAttemptsQuery, [exam.id]);
      
      console.log(`   Total attempts in database: ${anyAttemptsResult.rows[0].count}`);
      
      if (anyAttemptsResult.rows[0].count > 0) {
        console.log('   ⚠️  Attempts exist but query returned 0 - there might be a filtering issue');
      } else {
        console.log('   ℹ️  No attempts exist for this exam - this is expected for draft exams');
      }
    }
    
    // Test the old restrictive query for comparison
    console.log('\n🔍 Testing old restrictive query for comparison:');
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
    
    const oldResult = await pool.query(oldQuery, [exam.id]);
    console.log(`❌ Old restrictive query returned: ${oldResult.rows.length} results`);
    
    console.log('\n🎯 COMPARISON:');
    console.log(`   Fixed query: ${queryResult.rows.length} results`);
    console.log(`   Old query: ${oldResult.rows.length} results`);
    console.log(`   Improvement: +${queryResult.rows.length - oldResult.rows.length} results`);
    
    // Test API response format
    console.log('\n📡 Expected API response format:');
    const apiResponse = {
      success: true,
      results: queryResult.rows.map(row => ({
        student: {
          name: row.name,
          email: row.email,
          rollNumber: row.student_id
        },
        score: row.score,
        totalPoints: row.total_points,
        percentage: row.percentage,
        status: row.status,
        submittedAt: row.submitted_at,
        gradedAt: row.graded_at,
        feedback: row.feedback,
        violationsCount: row.violations_count,
        violations: row.violations,
        riskScore: row.risk_score
      }))
    };
    
    console.log(`   Results: ${apiResponse.results.length} students`);
    if (apiResponse.results.length > 0) {
      console.log(`   Sample student: ${apiResponse.results[0].student.name} - ${apiResponse.results[0].status}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testTeacherResultsAPI().catch(console.error);
