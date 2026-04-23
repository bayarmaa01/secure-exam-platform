const { pool } = require('./dist/db');

async function getDraftExamId() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, title FROM exams WHERE status = 'draft' LIMIT 1"
    );
    if (result.rows.length > 0) {
      console.log('📝 Draft exam found:', result.rows[0]);
      console.log('Full ID:', result.rows[0].id);
    } else {
      console.log('❌ No draft exams found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
}

getDraftExamId();
