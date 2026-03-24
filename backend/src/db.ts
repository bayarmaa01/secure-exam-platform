import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 50,
  idleTimeoutMillis: 30000
})

export async function initDb() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
        student_id VARCHAR(50),
        teacher_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token VARCHAR(500) PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        duration_minutes INT NOT NULL,
        teacher_id UUID REFERENCES users(id),
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exam_id UUID REFERENCES exams(id),
        question_text TEXT NOT NULL,
        options JSONB,
        correct_answer TEXT,
        type VARCHAR(20) DEFAULT 'mcq' CHECK (type IN ('mcq', 'text')),
        points INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exam_id UUID REFERENCES exams(id),
        user_id UUID REFERENCES users(id),
        started_at TIMESTAMP DEFAULT NOW(),
        submitted_at TIMESTAMP,
        cheating_score DECIMAL(5,4)
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id UUID REFERENCES exam_attempts(id),
        question_id UUID REFERENCES questions(id),
        answer TEXT
      )
    `)
  } finally {
    client.release()
  }
}

export { pool }
