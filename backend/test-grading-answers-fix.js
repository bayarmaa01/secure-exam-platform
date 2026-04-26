const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testGradingAnswersFix() {
  console.log('🧪 Testing grading answers fix...\n');
  
  try {
    // Find a recent attempt with answers
    const attemptQuery = `
      SELECT 
        a.id,
        a.exam_id,
        a.user_id,
        a.status,
        a.submitted_at,
        e.title,
        e.type,
        u.name as student_name,
        u.email as student_email
      FROM exam_attempts a
      JOIN exams e ON a.exam_id = e.id
      JOIN users u ON a.user_id = u.id
      WHERE a.status IN ('submitted', 'pending_review', 'graded')
      ORDER BY a.submitted_at DESC
      LIMIT 1
    `;
    
    const attemptResult = await pool.query(attemptQuery);
    
    if (attemptResult.rows.length === 0) {
      console.log('❌ No submitted attempts found');
      return;
    }
    
    const attempt = attemptResult.rows[0];
    console.log(`✅ Found attempt: ${attempt.id}`);
    console.log(`   Student: ${attempt.student_name} (${attempt.student_email})`);
    console.log(`   Exam: ${attempt.title} (${attempt.type})`);
    console.log(`   Status: ${attempt.status}`);
    
    // Get questions for this exam
    const questionsQuery = `
      SELECT id, question_text, points, type, options, correct_answer
      FROM questions
      WHERE exam_id = $1
      ORDER BY id
    `;
    
    const questionsResult = await pool.query(questionsQuery, [attempt.exam_id]);
    console.log(`\n❓ Found ${questionsResult.rows.length} questions`);
    
    // Get answers from answers table (the new approach)
    const answersQuery = `
      SELECT question_id, answer, points_earned, is_correct
      FROM answers
      WHERE attempt_id = $1
    `;
    
    const answersResult = await pool.query(answersQuery, [attempt.id]);
    console.log(`📝 Found ${answersResult.rows.length} answers in answers table`);
    
    // Format answers as the API would
    const formattedAnswers = {};
    answersResult.rows.forEach(answer => {
      formattedAnswers[answer.question_id] = answer.answer;
    });
    
    console.log('\n📋 Formatted answers (question_id -> answer):');
    Object.entries(formattedAnswers).forEach(([questionId, answer]) => {
      console.log(`   ${questionId}: ${answer}`);
    });
    
    // Test how frontend would display this
    console.log('\n🎯 Testing frontend display logic:');
    questionsResult.rows.forEach((question, index) => {
      const answer = formattedAnswers[question.id] || '';
      console.log(`   Q${index + 1}: ${question.question_text.substring(0, 50)}...`);
      console.log(`   Answer: ${answer || 'No answer'}`);
      console.log(`   Points: ${question.points}`);
      console.log('');
    });
    
    // Test the complete API response structure
    const apiResponse = {
      success: true,
      attempt: {
        id: attempt.id,
        answers: formattedAnswers,
        score: null,
        status: attempt.status,
        submittedAt: attempt.submitted_at,
        startedAt: attempt.started_at,
        feedback: null,
        totalPoints: 0,
        percentage: null,
        exam: {
          title: attempt.title,
          type: attempt.type,
          totalMarks: 100,
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
    
    console.log('✅ API Response structure test:');
    console.log(`   - attempt.answers: ${Object.keys(apiResponse.attempt.answers).length} answers`);
    console.log(`   - attempt.questions: ${apiResponse.attempt.questions.length} questions`);
    console.log(`   - Answer mapping works: ${Object.keys(apiResponse.attempt.answers).every(key => apiResponse.attempt.questions.find(q => q.id === key))}`);
    
    // Test specific answer access
    if (questionsResult.rows.length > 0) {
      const firstQuestion = questionsResult.rows[0];
      const firstAnswer = apiResponse.attempt.answers?.[firstQuestion.id] || '';
      console.log(`\n🧪 First question test:`);
      console.log(`   Question ID: ${firstQuestion.id}`);
      console.log(`   Question: ${firstQuestion.question_text}`);
      console.log(`   Answer: "${firstAnswer}"`);
      console.log(`   Answer type: ${typeof firstAnswer}`);
      console.log(`   Answer length: ${firstAnswer.length}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testGradingAnswersFix().catch(console.error);
