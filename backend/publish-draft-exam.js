const { pool } = require('./dist/db');

async function publishDraftExam() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE exams 
       SET is_published = true, status = 'published', updated_at = NOW()
       WHERE id = $1 
       RETURNING id, title, status, is_published`,
      ['c2c791e7-224f-4627-acb6-cee9ca9ab5b5'] 
    );
    await client.query('COMMIT');
    console.log('✅ Draft exam published:', result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
}

publishDraftExam();
