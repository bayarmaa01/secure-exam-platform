const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkExamCreation() {
  console.log('🔍 Checking exam creation and dashboard display...\n');
  
  try {
    // Get the teacher ID from the logs
    const teacherId = '83035217-e1cb-42fb-b83d-7b646e92b2f9';
    
    console.log(`👤 Checking exams for teacher: ${teacherId}`);
    
    // Test the exact query from the teacher exams endpoint
    const examsQuery = `
      SELECT e.id, e.title, e.description, e.duration_minutes, e.start_time, e.end_time, e.status, e.created_at, e.course_id,
              c.name as course_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count,
              (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.exam_id = e.id) as attempt_count
       FROM exams e
       LEFT JOIN courses c ON e.course_id = c.id
       WHERE e.teacher_id = $1
       ORDER BY e.created_at DESC
    `;
    
    const result = await pool.query(examsQuery, [teacherId]);
    
    console.log(`✅ Found ${result.rows.length} exams for this teacher\n`);
    
    if (result.rows.length === 0) {
      console.log('❌ No exams found for this teacher');
      
      // Check if the teacher exists
      const teacherQuery = 'SELECT id, name, email, role FROM users WHERE id = $1';
      const teacherResult = await pool.query(teacherQuery, [teacherId]);
      
      if (teacherResult.rows.length === 0) {
        console.log('❌ Teacher not found in database');
      } else {
        console.log('✅ Teacher found:', teacherResult.rows[0].name, teacherResult.rows[0].email);
        
        // Check if there are any exams at all
        const allExamsQuery = 'SELECT COUNT(*) as count FROM exams';
        const allExamsResult = await pool.query(allExamsQuery);
        console.log(`📊 Total exams in database: ${allExamsResult.rows[0].count}`);
        
        if (allExamsResult.rows[0].count > 0) {
          console.log('🔍 Checking recent exams to see who created them...');
          const recentExamsQuery = `
            SELECT e.id, e.title, e.teacher_id, u.name as teacher_name, e.created_at
            FROM exams e
            JOIN users u ON e.teacher_id = u.id
            ORDER BY e.created_at DESC
            LIMIT 5
          `;
          const recentExamsResult = await pool.query(recentExamsQuery);
          
          console.log('📋 Recent exams:');
          recentExamsResult.rows.forEach((exam, index) => {
            console.log(`   ${index + 1}. ${exam.title} by ${exam.teacher_name} (${exam.teacher_id})`);
            console.log(`      Created: ${exam.created_at}`);
          });
        }
      }
    } else {
      console.log('📋 Teacher exams:');
      result.rows.forEach((exam, index) => {
        console.log(`   ${index + 1}. ${exam.title} (${exam.status})`);
        console.log(`      ID: ${exam.id}`);
        console.log(`      Course: ${exam.course_name || 'No Course'}`);
        console.log(`      Questions: ${exam.question_count}`);
        console.log(`      Attempts: ${exam.attempt_count}`);
        console.log(`      Created: ${exam.created_at}`);
        console.log(`      Start: ${exam.start_time || 'Not set'}`);
        console.log(`      End: ${exam.end_time || 'Not set'}`);
        console.log('');
      });
      
      // Test the mapped format that gets sent to frontend
      const mappedResults = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        durationMinutes: row.duration_minutes || 60,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status || 'draft',
        createdAt: row.created_at,
        courseId: row.course_id,
        courseName: row.course_name || 'No Course',
        questionCount: parseInt(row.question_count) || 0,
        attemptCount: parseInt(row.attempt_count) || 0,
        scheduledAt: row.start_time
      }));
      
      console.log('📡 API Response format:');
      console.log(JSON.stringify(mappedResults, null, 2));
    }
    
    // Check if there are any recently created exams (last 24 hours)
    const recentQuery = `
      SELECT COUNT(*) as count
      FROM exams 
      WHERE teacher_id = $1 
      AND created_at > NOW() - INTERVAL '24 hours'
    `;
    
    const recentResult = await pool.query(recentQuery, [teacherId]);
    console.log(`\n📅 Exams created in last 24 hours: ${recentResult.rows[0].count}`);
    
    if (recentResult.rows[0].count > 0) {
      console.log('✅ Recent exams found - they should appear in dashboard');
    } else {
      console.log('ℹ️  No recent exams - try creating a new exam to test');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkExamCreation().catch(console.error);
