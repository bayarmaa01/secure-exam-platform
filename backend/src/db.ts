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
        type VARCHAR(20) DEFAULT 'mcq' CHECK (type IN ('mcq', 'written', 'coding', 'mixed', 'ai_proctored')),
        duration_minutes INT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
        total_marks INT DEFAULT 100,
        passing_marks INT DEFAULT 50,
        is_published BOOLEAN DEFAULT false,
        teacher_id UUID REFERENCES users(id),
        
        -- Security settings
        fullscreen_required BOOLEAN DEFAULT false,
        tab_switch_detection BOOLEAN DEFAULT false,
        copy_paste_blocked BOOLEAN DEFAULT false,
        camera_required BOOLEAN DEFAULT false,
        face_detection_enabled BOOLEAN DEFAULT false,
        
        -- Randomization settings
        shuffle_questions BOOLEAN DEFAULT false,
        shuffle_options BOOLEAN DEFAULT false,
        
        -- Assignment settings
        assign_to_all BOOLEAN DEFAULT true,
        assigned_groups JSONB DEFAULT '[]'::jsonb,
        
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
        topic VARCHAR(100) NOT NULL,
        options JSONB,
        correct_answer TEXT,
        type VARCHAR(20) DEFAULT 'mcq' CHECK (type IN ('mcq', 'written', 'coding')),
        points INT DEFAULT 1,
        
        -- Coding question specific fields
        languages JSONB DEFAULT '["python", "javascript", "cpp"]'::jsonb,
        test_cases JSONB DEFAULT '[]'::jsonb,
        template_code JSONB DEFAULT '{}'::jsonb,
        
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
        cheating_score DECIMAL(5,4),
        tab_switch_count INT DEFAULT 0,
        fullscreen_violations INT DEFAULT 0,
        camera_violations INT DEFAULT 0,
        copy_paste_violations INT DEFAULT 0,
        total_violations INT DEFAULT 0
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_violations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id UUID REFERENCES exam_attempts(id),
        violation_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        timestamp TIMESTAMP DEFAULT NOW(),
        details JSONB DEFAULT '{}'::jsonb
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id UUID REFERENCES exam_attempts(id),
        question_id UUID REFERENCES questions(id),
        answer TEXT,
        is_correct BOOLEAN,
        score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        exam_id UUID REFERENCES exams(id),
        score DECIMAL(5,2),
        total_points DECIMAL(5,2),
        percentage DECIMAL(5,2),
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed')),
        ai_insights JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        exam_id UUID REFERENCES exams(id),
        topic VARCHAR(100) NOT NULL,
        total_questions INT DEFAULT 0,
        correct_answers INT DEFAULT 0,
        accuracy DECIMAL(5,2),
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        total_score DECIMAL(10,2) DEFAULT 0,
        exams_attempted INT DEFAULT 0,
        average_score DECIMAL(5,2) DEFAULT 0,
        rank INT,
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
  } finally {
    client.release()
  }
}

export { pool }
