const { pool } = require('./dist/db');

async function listExams() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, title, status, is_published, created_at FROM exams ORDER BY created_at DESC LIMIT 5'
    );
    console.log('📚 Available Exams:');
    console.log('ID\t\t\t\t\tStatus\t\tPublished\tTitle');
    console.log('─'.repeat(80));
    
    result.rows.forEach(exam => {
      const published = exam.is_published ? '✅' : '❌';
      const shortId = exam.id.substring(0, 8) + '...';
      console.log(`${shortId}\t${exam.status}\t\t${published}\t\t${exam.title}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
}

listExams();
