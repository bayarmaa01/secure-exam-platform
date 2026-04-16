const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testExamCreation() {
  console.log('=== TESTING EXAM CREATION ===');
  
  try {
    const client = await pool.connect();
    
    // Test data from our database
    const courseId = '640a15b6-c467-437d-8438-407707e59afd'; // Test Course
    const teacherId = '7409fc14-df27-4663-8285-2785bdb4ab59'; // Teacher User
    
    console.log(`Testing exam creation: Course ${courseId}, Teacher ${teacherId}`);
    
    // Step 1: Create exam
    const examData = {
      title: 'Test Exam for Debugging',
      description: 'This is a test exam created during debugging',
      duration_minutes: 60,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      course_id: courseId,
      teacher_id: teacherId,
      status: 'draft'
    };
    
    console.log('Creating exam with data:', JSON.stringify(examData, null, 2));
    
    const examResult = await client.query(`
      INSERT INTO exams (title, description, duration_minutes, start_time, end_time, course_id, teacher_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      examData.title,
      examData.description,
      examData.duration_minutes,
      examData.start_time,
      examData.end_time,
      examData.course_id,
      examData.teacher_id,
      examData.status
    ]);
    
    console.log('Exam created successfully:', JSON.stringify(examResult.rows[0], null, 2));
    
    const examId = examResult.rows[0].id;
    
    // Step 2: Add a question to the exam
    const questionData = {
      exam_id: examId,
      question_text: 'What is 2 + 2?',
      options: JSON.stringify(['3', '4', '5', '6']),
      correct_answer: '4',
      type: 'mcq',
      points: 1
    };
    
    console.log('Adding question to exam:', JSON.stringify(questionData, null, 2));
    
    const questionResult = await client.query(`
      INSERT INTO questions (exam_id, question_text, options, correct_answer, type, points)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      questionData.exam_id,
      questionData.question_text,
      questionData.options,
      questionData.correct_answer,
      questionData.type,
      questionData.points
    ]);
    
    console.log('Question created successfully:', JSON.stringify(questionResult.rows[0], null, 2));
    
    // Step 3: Verify the exam and course relationship
    const verifyExam = await client.query(`
      SELECT e.*, c.name as course_name 
      FROM exams e 
      LEFT JOIN courses c ON e.course_id = c.id 
      WHERE e.id = $1
    `, [examId]);
    
    console.log('Exam verification:', JSON.stringify(verifyExam.rows[0], null, 2));
    
    // Step 4: Verify question count
    const questionCount = await client.query(
      'SELECT COUNT(*) as count FROM questions WHERE exam_id = $1',
      [examId]
    );
    
    console.log('Question count:', JSON.stringify(questionCount.rows[0], null, 2));
    
    client.release();
  } catch (error) {
    console.error('Exam creation test error:', error);
  }
  
  await pool.end();
}

testExamCreation();
