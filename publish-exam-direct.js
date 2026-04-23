const { Pool } = require('pg');

// Use same connection as backend
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
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
    console.log('✅ Exam published successfully:', result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error publishing exam:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

publishExam();
