import { Pool, PoolClient } from 'pg'
// Migration manager for database schema

interface Migration {
  id: string
  name: string
  sql: string
  rollback?: string
}

interface MigrationRecord {
  id: string
  executed_at: string
}

// Comprehensive migration definitions
const MIGRATIONS: Migration[] = [
  {
    id: '001_create_core_tables',
    name: 'Create core database tables',
    sql: `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
        registration_number VARCHAR(20) UNIQUE,
        student_id VARCHAR(50),
        teacher_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Courses table
      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Enrollments table
      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(course_id, student_id)
      );

      -- Exams table
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
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
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
      );

      -- Questions table
      CREATE TABLE IF NOT EXISTS questions (
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
      );

      -- Exam Attempts table
      CREATE TABLE IF NOT EXISTS exam_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exam_id UUID REFERENCES exams(id),
        user_id UUID REFERENCES users(id),
        answers JSONB DEFAULT '{}'::jsonb,
        started_at TIMESTAMP DEFAULT NOW(),
        submitted_at TIMESTAMP,
        score DECIMAL(5,2),
        total_points INT DEFAULT 0,
        percentage DECIMAL(5,2),
        status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
        proctoring_session_id VARCHAR(255),
        risk_score INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Answers table
      CREATE TABLE IF NOT EXISTS answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
        question_id UUID REFERENCES questions(id),
        answer TEXT,
        is_correct BOOLEAN,
        points_earned DECIMAL(5,2) DEFAULT 0,
        time_taken INT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(attempt_id, question_id)
      );

      -- Results table
      CREATE TABLE IF NOT EXISTS results (
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
      );

      -- Warnings table for proctoring
      CREATE TABLE IF NOT EXISTS warnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Proctoring Logs table
      CREATE TABLE IF NOT EXISTS proctoring_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id UUID REFERENCES exam_attempts(id),
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        risk_score INT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT NOW(),
        session_id VARCHAR(255)
      );

      -- Analytics table
      CREATE TABLE IF NOT EXISTS analytics (
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
      );

      -- Leaderboard table
      CREATE TABLE IF NOT EXISTS leaderboard (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id) UNIQUE,
        total_score DECIMAL(10,2) DEFAULT 0,
        exams_attempted INT DEFAULT 0,
        average_score DECIMAL(5,2) DEFAULT 0,
        rank INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW()
      );

      -- Notifications table
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        read BOOLEAN DEFAULT false,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Refresh tokens table
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token VARCHAR(500) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      );
    `,
    rollback: `
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS leaderboard CASCADE;
      DROP TABLE IF EXISTS analytics CASCADE;
      DROP TABLE IF EXISTS proctoring_logs CASCADE;
      DROP TABLE IF EXISTS warnings CASCADE;
      DROP TABLE IF EXISTS answers CASCADE;
      DROP TABLE IF EXISTS exam_attempts CASCADE;
      DROP TABLE IF EXISTS questions CASCADE;
      DROP TABLE IF EXISTS exams CASCADE;
      DROP TABLE IF EXISTS enrollments CASCADE;
      DROP TABLE IF EXISTS courses CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `
  },
  {
    id: '002_create_indexes',
    name: 'Create performance indexes',
    sql: `
      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
      CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
      CREATE INDEX IF NOT EXISTS idx_exams_course_id ON exams(course_id);
      CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
      CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
      CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);
      CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id);
      CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);
      CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);
      CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
      CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id);
      CREATE INDEX IF NOT EXISTS idx_results_exam_id ON results(exam_id);
      CREATE INDEX IF NOT EXISTS idx_proctoring_logs_attempt_id ON proctoring_logs(attempt_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_student_id ON analytics(student_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_exam_id ON analytics(exam_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_student_id ON leaderboard(student_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_user_id ON warnings(user_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_exam_id ON warnings(exam_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at);
    `
  }
]

// Migration tracking table
const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(255) PRIMARY KEY,
    name TEXT NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW(),
    checksum VARCHAR(64)
  );
`

class MigrationManager {
  private client: PoolClient | null = null

  constructor(private pool: Pool) {}

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Migration Manager...')
    
    // Ensure migration tracking table exists
    const client = await this.pool.connect()
    try {
      await client.query(MIGRATION_TABLE_SQL)
      console.log('✅ Migration tracking table ensured')
    } finally {
      client.release()
    }

    // Run pending migrations
    await this.runMigrations()
  }

  private async runMigrations(): Promise<void> {
    const client = await this.pool.connect()
    try {
      // Get executed migrations
      const executedResult = await client.query<MigrationRecord>(
        'SELECT id, name, executed_at FROM schema_migrations ORDER BY executed_at'
      )
      const executedMigrations = new Set(executedResult.rows.map(m => m.id))

      // Run pending migrations
      for (const migration of MIGRATIONS) {
        if (!executedMigrations.has(migration.id)) {
          console.log(`🚀 Running migration: ${migration.name}`)
          
          try {
            await client.query('BEGIN')
            await client.query(migration.sql)
            
            // Record migration
            await client.query(
              'INSERT INTO schema_migrations (id, name, checksum) VALUES ($1, $2, $3)',
              [migration.id, migration.name, this.calculateChecksum(migration.sql)]
            )
            
            await client.query('COMMIT')
            console.log(`✅ Migration completed: ${migration.name}`)
          } catch (error) {
            await client.query('ROLLBACK')
            console.error(`❌ Migration failed: ${migration.name}`, error)
            throw error
          }
        } else {
          console.log(`⏭ Skipping migration (already executed): ${migration.name}`)
        }
      }

      console.log('🎉 All migrations completed successfully')
    } finally {
      client.release()
    }
  }

  private calculateChecksum(sql: string): string {
    // Simple checksum for migration SQL
    const crypto = require('crypto')
    return crypto.createHash('md5').update(sql.replace(/\s+/g, ' ').trim()).digest('hex')
  }

  async rollback(migrationId: string): Promise<void> {
    const migration = MIGRATIONS.find(m => m.id === migrationId)
    if (!migration?.rollback) {
      throw new Error(`No rollback script available for migration: ${migrationId}`)
    }

    const client = await this.pool.connect()
    try {
      console.log(`⏪ Rolling back migration: ${migration.name}`)
      await client.query('BEGIN')
      await client.query(migration.rollback)
      
      // Remove migration record
      await client.query('DELETE FROM schema_migrations WHERE id = $1', [migrationId])
      
      await client.query('COMMIT')
      console.log(`✅ Rollback completed: ${migration.name}`)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`❌ Rollback failed: ${migration.name}`, error)
      throw error
    } finally {
      client.release()
    }
  }

  async getMigrationStatus(): Promise<MigrationRecord[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query<MigrationRecord>(
        'SELECT id, name, executed_at FROM schema_migrations ORDER BY executed_at DESC'
      )
      return result.rows
    } finally {
      client.release()
    }
  }
}

export { MigrationManager }
