const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function debugGradingAnswers() {
  console.log('🔍 Debugging grading answers issue...\n');
  
  try {
    // Find a recent writing exam attempt
    const attemptQuery = `
      SELECT 
        a.id,
        a.answers,
        a.exam_id,
        a.user_id,
        a.status,
        a.score,
        e.title,
        e.type,
        u.name as student_name,
        u.email as student_email
      FROM exam_attempts a
      JOIN exams e ON a.exam_id = e.id
      JOIN users u ON a.user_id = u.id
      WHERE e.type = 'writing'
      AND a.status IN ('submitted', 'pending_review')
      ORDER BY a.submitted_at DESC
      LIMIT 1
    `;
    
    const attemptResult = await pool.query(attemptQuery);
    
    if (attemptResult.rows.length === 0) {
      console.log('❌ No writing exam attempts found');
      return;
    }
    
    const attempt = attemptResult.rows[0];
    console.log(`✅ Found attempt: ${attempt.id}`);
    console.log(`   Student: ${attempt.student_name} (${attempt.student_email})`);
    console.log(`   Exam: ${attempt.title} (${attempt.type})`);
    console.log(`   Status: ${attempt.status}`);
    console.log(`   Score: ${attempt.score || 'Not graded'}`);
    
    console.log('\n📝 Raw answers data:');
    console.log('   Type:', typeof attempt.answers);
    console.log('   Value:', attempt.answers);
    
    if (attempt.answers) {
      try {
        const parsedAnswers = typeof attempt.answers === 'string' 
          ? JSON.parse(attempt.answers) 
          : attempt.answers;
        
        console.log('\n📊 Parsed answers:');
        console.log('   Keys:', Object.keys(parsedAnswers));
        console.log('   Sample answers:');
        Object.entries(parsedAnswers).forEach(([key, value]) => {
          console.log(`     ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
        });
      } catch (parseError) {
        console.log('❌ Failed to parse answers:', parseError.message);
      }
    }
    
    // Get questions for this exam
    const questionsQuery = `
      SELECT id, question_text, points, type, options
      FROM questions
      WHERE exam_id = $1
      ORDER BY id
    `;
    
    const questionsResult = await pool.query(questionsQuery, [attempt.exam_id]);
    
    console.log('\n❓ Questions for this exam:');
    questionsResult.rows.forEach((question, index) => {
      console.log(`   Q${index + 1} (ID: ${question.id}): ${question.question_text}`);
      console.log(`   Type: ${question.type}, Points: ${question.points}`);
      
      // Check if there's an answer for this question
      if (attempt.answers) {
        try {
          const parsedAnswers = typeof attempt.answers === 'string' 
            ? JSON.parse(attempt.answers) 
            : attempt.answers;
          
          const answer = parsedAnswers[question.id];
          console.log(`   Answer: ${answer || 'No answer'}`);
        } catch (e) {
          console.log(`   Answer: Failed to parse`);
        }
      }
      console.log('');
    });
    
    // Test the exact API response structure
    console.log('🔧 Testing API response structure...');
    
    const apiResponse = {
      success: true,
      attempt: {
        id: attempt.id,
        answers: attempt.answers,
        score: attempt.score ? parseFloat(attempt.score) : null,
        status: attempt.status,
        submittedAt: attempt.submitted_at,
        startedAt: attempt.started_at,
        feedback: attempt.feedback,
        totalPoints: parseInt(attempt.total_points) || 0,
        percentage: attempt.percentage ? parseFloat(attempt.percentage) : null,
        exam: {
          title: attempt.title,
          type: attempt.type,
          totalMarks: 100, // Default for testing
          description: 'Test exam'
        },
        student: {
          name: attempt.student_name,
          email: attempt.student_email,
          studentId: attempt.student_roll_number
        },
        questions: questionsResult.rows
      }
    };
    
    console.log('\n📋 API Response structure:');
    console.log('   attempt.answers:', apiResponse.attempt.answers);
    console.log('   attempt.questions:', apiResponse.attempt.questions.length, 'questions');
    
    // Test how frontend would access answers
    console.log('\n🧪 Testing frontend answer access...');
    apiResponse.attempt.questions.forEach((question, index) => {
      const answer = apiResponse.attempt.answers?.[question.id] || '';
      console.log(`   Q${index + 1}: answer = "${answer}"`);
      console.log(`   Q${index + 1}: typeof answer = ${typeof answer}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugGradingAnswers().catch(console.error);
