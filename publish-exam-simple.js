const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/exam_platform'
});

async function publishExam() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE exams 
       SET is_published = true, status = 'published', updated_at = NOW()
       WHERE id = $1 
       RETURNING id, title, status, is_published`,
      ['8b847ffe-f9c0-471f-93f3-d254c199b9da']
    );
    await client.query('COMMIT');
    console.log('✅ Exam published:', result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

publishExam();
