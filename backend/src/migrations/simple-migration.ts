import { Pool, PoolClient } from 'pg'
import { pool } from '../db'

// Simple migration system without TypeScript export issues
export async function initializeDatabase(): Promise<void> {
  console.log('🔄 Initializing database with comprehensive migration system...')
  
  const client = await pool.connect()
  
  try {
    // Create migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `)
    
    // Core tables with all required fields
    await client.query(`
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
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(course_id, student_id)
      );
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
    `)
    
    await client.query(`
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
    `)
    
    await client.query(`
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
    `)
    
    await client.query(`
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
    `)
    
    await client.query(`
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
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS warnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS proctoring_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id UUID REFERENCES exam_attempts(id),
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        risk_score INT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT NOW(),
        session_id VARCHAR(255)
      );
    `)
    
    await client.query(`
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
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token VARCHAR(500) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      );
    `)
    
    // Create performance indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
      'CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id)',
      'CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id)',
      'CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status)',
      'CREATE INDEX IF NOT EXISTS idx_exams_course_id ON exams(course_id)',
      'CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id)',
      'CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic)',
      'CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id)',
      'CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status)',
      'CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id)',
      'CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id)',
      'CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id)',
      'CREATE INDEX IF NOT EXISTS idx_results_exam_id ON results(exam_id)',
      'CREATE INDEX IF NOT EXISTS idx_proctoring_logs_attempt_id ON proctoring_logs(attempt_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_warnings_user_id ON warnings(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_warnings_exam_id ON warnings(exam_id)',
      'CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at)'
    ]
    
    for (const index of indexes) {
      try {
        await client.query(index)
        console.log(`✅ Created index: ${index}`)
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn(`⚠️ Index creation warning: ${error.message}`)
        }
      }
    }
    
    console.log('✅ Database initialization completed successfully')
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  } finally {
    client.release()
  }
}
