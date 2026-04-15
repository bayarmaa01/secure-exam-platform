import { Pool, PoolClient } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

async function ensureTablesExist(client: PoolClient) {
  console.log('Ensuring basic tables exist...')
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
      student_id VARCHAR(50),
      teacher_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      token VARCHAR(500) PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS exams (
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
      fullscreen_required BOOLEAN DEFAULT false,
      tab_switch_detection BOOLEAN DEFAULT false,
      copy_paste_blocked BOOLEAN DEFAULT false,
      camera_required BOOLEAN DEFAULT false,
      face_detection_enabled BOOLEAN DEFAULT false,
      shuffle_questions BOOLEAN DEFAULT false,
      shuffle_options BOOLEAN DEFAULT false,
      assign_to_all BOOLEAN DEFAULT true,
      assigned_groups JSONB DEFAULT '[]'::jsonb,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      options JSONB,
      correct_answer TEXT,
      type VARCHAR(20) DEFAULT 'mcq' CHECK (type IN ('mcq', 'text', 'coding')),
      points INT DEFAULT 1,
      topic VARCHAR(100),
      difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
      explanation TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS exam_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id UUID REFERENCES exams(id),
      user_id UUID REFERENCES users(id),
      started_at TIMESTAMP DEFAULT NOW(),
      submitted_at TIMESTAMP,
      score DECIMAL(5,2),
      total_points INT DEFAULT 0,
      percentage DECIMAL(5,2),
      status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
      proctoring_session_id VARCHAR(255),
      risk_score INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS answers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
      question_id UUID REFERENCES questions(id),
      answer TEXT,
      is_correct BOOLEAN,
      points_earned DECIMAL(5,2) DEFAULT 0,
      time_taken INT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(attempt_id, question_id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES users(id),
      exam_id UUID REFERENCES exams(id),
      attempt_id UUID REFERENCES exam_attempts(id),
      score DECIMAL(5,2) NOT NULL,
      total_points INT NOT NULL,
      percentage DECIMAL(5,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'passed')),
      graded_at TIMESTAMP DEFAULT NOW(),
      graded_by UUID REFERENCES users(id),
      feedback TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS proctoring_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID REFERENCES exam_attempts(id),
      event_type VARCHAR(50) NOT NULL,
      event_data JSONB,
      risk_score INT DEFAULT 0,
      timestamp TIMESTAMP DEFAULT NOW(),
      session_id VARCHAR(255)
    )`,
    
    `CREATE TABLE IF NOT EXISTS analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES users(id),
      exam_id UUID REFERENCES exams(id),
      topic VARCHAR(100),
      total_questions INT DEFAULT 0,
      correct_answers INT DEFAULT 0,
      accuracy DECIMAL(5,2) DEFAULT 0,
      avg_time_per_question INT DEFAULT 0,
      difficulty VARCHAR(10),
      last_updated TIMESTAMP DEFAULT NOW(),
      UNIQUE(student_id, exam_id, topic)
    )`,
    
    `CREATE TABLE IF NOT EXISTS leaderboard (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES users(id) UNIQUE,
      total_score DECIMAL(10,2) DEFAULT 0,
      exams_attempted INT DEFAULT 0,
      average_score DECIMAL(5,2) DEFAULT 0,
      rank INT DEFAULT 0,
      last_updated TIMESTAMP DEFAULT NOW()
    )`,
    
    `CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      read BOOLEAN DEFAULT false,
      data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )`
  ]
  
  for (const table of tables) {
    await client.query(table)
  }
  
  console.log('Basic tables ensured')
  
  // Create indexes for better performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id)',
    'CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status)',
    'CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id)',
    'CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic)',
    'CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id)',
    'CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id)',
    'CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id)',
    'CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_results_exam_id ON results(exam_id)',
    'CREATE INDEX IF NOT EXISTS idx_proctoring_logs_attempt_id ON proctoring_logs(attempt_id)',
    'CREATE INDEX IF NOT EXISTS idx_analytics_student_id ON analytics(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_analytics_exam_id ON analytics(exam_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_leaderboard_student_id ON leaderboard(student_id)'
  ]
  
  for (const index of indexes) {
    try {
      await client.query(index)
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.warn('Index creation warning:', error.message)
      }
    }
  }
  
  console.log('Database indexes created')
}

async function runMigrations(client: PoolClient) {
  console.log('Running database migrations...')
  
  // Add any missing columns to existing tables
  const migrations = [
    // Exams table migrations
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'mcq' CHECK (type IN ('mcq', 'written', 'coding', 'mixed', 'ai_proctored'))`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'))`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS total_marks INT DEFAULT 100`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS passing_marks INT DEFAULT 50`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS fullscreen_required BOOLEAN DEFAULT false`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS tab_switch_detection BOOLEAN DEFAULT false`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS copy_paste_blocked BOOLEAN DEFAULT false`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS camera_required BOOLEAN DEFAULT false`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS face_detection_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT false`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS assign_to_all BOOLEAN DEFAULT true`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS assigned_groups JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed'))`,
    `ALTER TABLE exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`
  ]
  
  for (const migration of migrations) {
    try {
      await client.query(migration)
      console.log('Migration applied:', migration.split('ADD COLUMN IF NOT EXISTS')[1]?.trim() || migration)
    } catch (error) {
      // Ignore errors for columns that already exist
      if (!error.message.includes('already exists') && !error.message.includes('duplicate column')) {
        console.warn('Migration failed:', error.message)
      }
    }
  }
  
  // Create exam_user role if it doesn't exist
  try {
    await client.query('CREATE ROLE exam_user')
    console.log('Created exam_user role')
  } catch (error) {
    if (!error.message.includes('already exists')) {
      console.warn('Failed to create exam_user role:', error.message)
    }
  }

  // Grant permissions
  await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO exam_user')
  await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO exam_user')
  await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO exam_user')
  await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO exam_user')
  
  console.log('Migrations completed')
}

export async function initDb() {
  const maxRetries = parseInt(process.env.DB_RETRY_ATTEMPTS || '10', 10)
  const retryDelay = parseInt(process.env.DB_RETRY_DELAY || '3000', 10)
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Database initialization attempt ${attempt}/${maxRetries}`)
      const client = await pool.connect()
      try {
        // First ensure basic tables exist
        await ensureTablesExist(client)
        // Then run migrations
        await runMigrations(client)
        console.log('Database initialization completed successfully')
        return true
      } finally {
        client.release()
      }
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`, error)
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      } else {
        console.error('Database initialization failed after all attempts')
        throw error
      }
    }
  }
}

export { pool }
