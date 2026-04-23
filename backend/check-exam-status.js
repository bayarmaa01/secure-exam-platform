const { pool } = require('./dist/db');

async function checkExamStatus() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, title, status, is_published FROM exams WHERE id = $1',
      ['c2c791e7-224f-4627-acb6-cee9ca9ab5b5']
    );
    if (result.rows.length > 0) {
      console.log('📋 Exam Status:', result.rows[0]);
    } else {
      console.log('❌ Exam not found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
}

checkExamStatus();
