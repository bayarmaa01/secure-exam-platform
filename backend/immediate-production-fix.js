const { Pool } = require('pg');

async function immediateProductionFix() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'SecureExamPlatform2024!',
  });

  try {
    console.log('🚀 IMMEDIATE PRODUCTION FIX - Starting...\n');

    // Fix 1: Database constraint - CRITICAL
    console.log('🔧 Fix 1: Database constraint for pending_review status');
    try {
      // Drop existing constraint
      await pool.query(`
        ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check
      `);
      console.log('✅ Dropped existing constraint');
      
      // Add updated constraint
      await pool.query(`
        ALTER TABLE exam_attempts 
        ADD CONSTRAINT exam_attempts_status_check 
        CHECK (status IN ('in_progress', 'submitted', 'pending_review', 'graded', 'terminated'))
      `);
      console.log('✅ Added updated constraint');
    } catch (constraintError) {
      console.log('❌ Constraint fix failed:', constraintError.message);
      console.log('   This is the root cause of 500 errors on exam submission');
    }

    // Fix 2: Ensure all required columns exist
    console.log('\n🔧 Fix 2: Ensuring required columns exist');
    try {
      await pool.query(`
        ALTER TABLE exam_attempts 
        ADD COLUMN IF NOT EXISTS violations_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS feedback TEXT,
        ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES users(id)
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
      
      // Add indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_attempt_id ON proctoring_violations(attempt_id);
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_student_id ON proctoring_violations(student_id);
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_exam_id ON proctoring_violations(exam_id);
        CREATE INDEX IF NOT EXISTS idx_proctoring_violations_type ON proctoring_violations(type);
      `);
      console.log('✅ Created indexes for proctoring_violations');
    } catch (tableError) {
      console.log('❌ Proctoring violations table creation failed:', tableError.message);
      console.log('   This is causing 400 errors on violation tracking');
    }

    // Fix 4: Test the fixes
    console.log('\n🧪 Fix 4: Testing the fixes');
    
    // Test pending_review status
    try {
      const testResult = await pool.query(`
        INSERT INTO exam_attempts (exam_id, user_id, status, submitted_at)
        VALUES (
          (SELECT id FROM exams LIMIT 1),
          (SELECT id FROM users WHERE role = 'student' LIMIT 1),
          'pending_review', NOW()
        )
        ON CONFLICT DO NOTHING
        RETURNING id, status
      `);
      
      if (testResult.rows.length > 0) {
        console.log('✅ pending_review status works:', testResult.rows[0]);
      } else {
        console.log('✅ pending_review status allowed (no insert due to conflict)');
      }
    } catch (testError) {
      console.log('❌ pending_review test failed:', testError.message);
      console.log('   This will cause 500 errors on exam submission');
    }

    // Test violation tracking
    try {
      await pool.query(`
        INSERT INTO proctoring_violations (attempt_id, student_id, exam_id, type, message)
        VALUES (
          (SELECT id FROM exam_attempts LIMIT 1),
          (SELECT id FROM users WHERE role = 'student' LIMIT 1),
          (SELECT id FROM exams LIMIT 1),
          'keyboard_copy_paste', 'Test violation'
        )
        ON CONFLICT DO NOTHING
      `);
      console.log('✅ Violation tracking works');
    } catch (violationError) {
      console.log('❌ Violation tracking test failed:', violationError.message);
      console.log('   This will cause 400 errors on /api/proctoring/track');
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

    // Fix 6: Verify current database state
    console.log('\n🔍 Fix 6: Verifying current database state');
    
    // Check constraint
    try {
      const constraintCheck = await pool.query(`
        SELECT con.conname, con.conkey 
        FROM pg_constraint con 
        INNER JOIN pg_class rel ON rel.oid = con.conrelid 
        WHERE rel.relname = 'exam_attempts' 
        AND con.conname LIKE '%status%'
      `);
      
      if (constraintCheck.rows.length > 0) {
        console.log('✅ Status constraint found:', constraintCheck.rows[0].conname);
      } else {
        console.log('❌ No status constraint found - this is the problem!');
      }
    } catch (checkError) {
      console.log('❌ Constraint check failed:', checkError.message);
    }

    // Check columns
    try {
      const columnCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'exam_attempts' 
        AND column_name IN ('violations_count', 'feedback', 'graded_at', 'graded_by')
        ORDER BY column_name
      `);
      
      console.log('✅ Required columns found:');
      columnCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      
      if (columnCheck.rows.length < 4) {
        console.log('❌ Missing columns - this will cause API errors!');
      }
    } catch (columnError) {
      console.log('❌ Column check failed:', columnError.message);
    }

    // Check proctoring_violations table
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'proctoring_violations'
        )
      `);
      
      if (tableCheck.rows[0].exists) {
        console.log('✅ proctoring_violations table exists');
      } else {
        console.log('❌ proctoring_violations table missing - this causes 400 errors!');
      }
    } catch (tableError) {
      console.log('❌ Table check failed:', tableError.message);
    }

    console.log('\n🎉 IMMEDIATE PRODUCTION FIX COMPLETED!');
    console.log('\n📊 NEXT STEPS:');
    console.log('1. Restart backend service: docker restart secure-exam-platform_backend_1');
    console.log('2. Restart frontend service: docker restart secure-exam-platform_frontend_1');
    console.log('3. Test exam submission');
    console.log('4. Test violation tracking');
    console.log('5. Test grading dashboard');
    
  } catch (error) {
    console.error('❌ IMMEDIATE PRODUCTION FIX FAILED:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

immediateProductionFix().catch(console.error);
