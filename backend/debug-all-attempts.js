const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function debugAllAttempts() {
  console.log('🔍 Debugging all exam attempts...\n');
  
  try {
    // Get all recent attempts
    const attemptsQuery = `
      SELECT 
        a.id,
        a.answers,
        a.exam_id,
        a.user_id,
        a.status,
        a.score,
        a.submitted_at,
        e.title,
        e.type,
        u.name as student_name,
        u.email as student_email
      FROM exam_attempts a
      JOIN exams e ON a.exam_id = e.id
      JOIN users u ON a.user_id = u.id
      ORDER BY a.submitted_at DESC
      LIMIT 5
    `;
    
    const attemptsResult = await pool.query(attemptsQuery);
    
    if (attemptsResult.rows.length === 0) {
      console.log('❌ No exam attempts found');
      
      // Check if there are any exams at all
      const examsQuery = 'SELECT id, title, type FROM exams ORDER BY created_at DESC LIMIT 5';
      const examsResult = await pool.query(examsQuery);
      
      console.log('\n📚 Available exams:');
      if (examsResult.rows.length === 0) {
        console.log('   No exams found');
      } else {
        examsResult.rows.forEach((exam, index) => {
          console.log(`   ${index + 1}. ${exam.title} (${exam.type})`);
        });
      }
      
      return;
    }
    
    console.log(`✅ Found ${attemptsResult.rows.length} recent attempts:\n`);
    
    attemptsResult.rows.forEach((attempt, index) => {
      console.log(`${index + 1}. Attempt: ${attempt.id}`);
      console.log(`   Student: ${attempt.student_name} (${attempt.student_email})`);
      console.log(`   Exam: ${attempt.title} (${attempt.type})`);
      console.log(`   Status: ${attempt.status}`);
      console.log(`   Score: ${attempt.score || 'Not graded'}`);
      console.log(`   Submitted: ${attempt.submitted_at}`);
      
      console.log('\n   Answers data:');
      console.log(`   Type: ${typeof attempt.answers}`);
      console.log(`   Value: ${attempt.answers}`);
      
      if (attempt.answers) {
        try {
          const parsedAnswers = typeof attempt.answers === 'string' 
            ? JSON.parse(attempt.answers) 
            : attempt.answers;
          
          console.log(`   Parsed type: ${typeof parsedAnswers}`);
          console.log(`   Keys: ${Object.keys(parsedAnswers).join(', ')}`);
          
          // Show first few answers
          Object.entries(parsedAnswers).slice(0, 3).forEach(([key, value]) => {
            console.log(`   ${key}: ${typeof value === 'string' ? value.substring(0, 50) + '...' : JSON.stringify(value).substring(0, 50) + '...'}`);
          });
        } catch (parseError) {
          console.log(`   Parse error: ${parseError.message}`);
        }
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    });
    
    // Now let's create a test attempt with answers if needed
    if (attemptsResult.rows.length === 0 || !attemptsResult.rows[0].answers) {
      console.log('🔧 Creating test data to verify answer display...');
      
      // Find a writing exam
      const writingExamQuery = `
        SELECT id, title, type 
        FROM exams 
        WHERE type = 'writing' 
        LIMIT 1
      `;
      
      const writingExamResult = await pool.query(writingExamQuery);
      
      if (writingExamResult.rows.length > 0) {
        const exam = writingExamResult.rows[0];
        console.log(`   Found writing exam: ${exam.title}`);
        
        // Get questions for this exam
        const questionsQuery = 'SELECT id, question_text FROM questions WHERE exam_id = $1';
        const questionsResult = await pool.query(questionsQuery, [exam.id]);
        
        if (questionsResult.rows.length > 0) {
          console.log(`   Found ${questionsResult.rows.length} questions`);
          
          // Create sample answers
          const sampleAnswers = {};
          questionsResult.rows.forEach((question, index) => {
            sampleAnswers[question.id] = `This is my answer to question ${index + 1}. I think this demonstrates my understanding of the topic.`;
          });
          
          console.log('   Sample answers created:', Object.keys(sampleAnswers).length, 'answers');
          console.log('   Sample answer preview:', Object.values(sampleAnswers)[0]?.substring(0, 50) + '...');
        } else {
          console.log('   No questions found for this exam');
        }
      } else {
        console.log('   No writing exams found');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugAllAttempts().catch(console.error);
