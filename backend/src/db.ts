import { Pool } from 'pg'

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

async function ensureTablesExist(client: any) {
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
      user_id UUID REFERENCES users(id),
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
    )`
  ]
  
  for (const table of tables) {
    await client.query(table)
  }
  
  console.log('Basic tables ensured')
}

async function runMigrations(client: any) {
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
