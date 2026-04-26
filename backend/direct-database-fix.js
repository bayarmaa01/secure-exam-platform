const { Pool } = require('pg');

async function directDatabaseFix() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'SecureExamPlatform2024!',
  });

  try {
    console.log('🚨 DIRECT DATABASE FIX - Starting...\n');

    // Fix 1: Database constraint - CRITICAL for exam submission
    console.log('🔧 Fix 1: Database constraint for pending_review status');
    try {
      await pool.query(`
        ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check
      `);
      console.log('✅ Dropped existing constraint');
      
      await pool.query(`
        ALTER TABLE exam_attempts 
        ADD CONSTRAINT exam_attempts_status_check 
        CHECK (status IN ('in_progress', 'submitted', 'pending_review', 'graded', 'terminated'))
      `);
      console.log('✅ Added updated constraint');
    } catch (constraintError) {
      console.log('❌ Constraint fix failed:', constraintError.message);
    }

    // Fix 2: Ensure all required columns exist
    console.log('\n🔧 Fix 2: Ensuring required columns exist');
    try {
      await pool.query(`
        ALTER TABLE exam_attempts 
        ADD COLUMN IF NOT EXISTS violations_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS feedback TEXT,
        ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS passing_threshold INTEGER DEFAULT 50
      `);
      console.log('✅ All required columns ensured');
    } catch (columnError) {
      console.log('❌ Column fix failed:', columnError.message);
    }

    // Fix 3: Create proctoring_violations table if missing
    console.log('\n🔧 Fix 3: Creating proctoring_violations table');
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS proctoring_violations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
          student_id UUID REFERENCES users(id) ON DELETE CASCADE,
          exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          message TEXT,
          timestamp TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Created proctoring_violations table');
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_attempt_id ON proctoring_violations(attempt_id);
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_student_id ON proctoring_violations(student_id);
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_exam_id ON proctoring_violations(exam_id);
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_type ON proctoring_violations(type);
      `);
      console.log('✅ Created indexes for proctoring_violations');
    } catch (tableError) {
      console.log('❌ Proctoring violations table creation failed:', tableError.message);
    }

    // Fix 4: Test exam submission query
    console.log('\n🧪 Fix 4: Testing exam submission query');
    try {
      await pool.query(`
        UPDATE exam_attempts 
        SET status = $1, submitted_at = NOW(), score = $2, total_points = $3, percentage = $4
        WHERE id = $5
      `, ['submitted', 0, 100, 0, '00000000-0000-0000-0000-000000000000']);
      console.log('✅ Exam submission query works');
    } catch (submitError) {
      console.log('❌ Exam submission query failed:', submitError.message);
    }

    // Fix 5: Update existing records
    console.log('\n🔄 Fix 5: Updating existing records');
    try {
      const updateResult = await pool.query(`
        UPDATE exam_attempts 
        SET status = 'pending_review' 
        WHERE status IN ('submitted') 
        AND exam_id IN (
          SELECT id FROM exams 
          WHERE type IN ('writing', 'coding')
        )
        RETURNING id, status
      `);
      console.log(`✅ Updated ${updateResult.rowCount} records to pending_review`);
    } catch (updateError) {
      console.log('⚠️  Update failed:', updateError.message);
    }

    console.log('\n🎉 DIRECT DATABASE FIX COMPLETED!');
    console.log('\n📊 NEXT STEPS:');
    console.log('1. Restart backend service: docker restart secure-exam-platform_backend_1');
    console.log('2. Restart frontend service: docker restart secure-exam-platform_frontend_1');
    console.log('3. Test exam submission (should work without 500 errors)');
    
  } catch (error) {
    console.error('❌ DIRECT DATABASE FIX FAILED:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

directDatabaseFix().catch(console.error);
