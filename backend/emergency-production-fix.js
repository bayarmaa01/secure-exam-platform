const { Pool } = require('pg');

async function emergencyProductionFix() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'SecureExamPlatform2024!',
  });

  try {
    console.log('🚨 EMERGENCY PRODUCTION FIX - Starting...\n');

    // Fix 1: Database constraint - CRITICAL for exam submission
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
    }

    // Fix 4: Test grading API query that's causing 500 errors
    console.log('\n🧪 Fix 4: Testing grading API query');
    try {
      const gradingTest = await pool.query(`
        SELECT 
          ea.id as attempt_id,
          ea.exam_id,
          ea.user_id as student_id,
          COALESCE(ea.answers, '[]') as answers,
          ea.submitted_at,
          ea.status,
          COALESCE(ea.score, 0) as score,
          COALESCE(ea.percentage, 0) as percentage,
          0 as violations_count,
          COALESCE(ea.started_at, ea.submitted_at) as started_at,
          COALESCE(e.title, 'Unknown Exam') as exam_title,
          COALESCE(e.type, 'unknown') as exam_type,
          COALESCE(e.total_marks, 100) as total_marks,
          COALESCE(e.passing_marks, 50) as passing_marks,
          COALESCE(e.description, '') as exam_description,
          COALESCE(u.name, 'Unknown Student') as student_name,
          COALESCE(u.email, 'unknown@example.com') as student_email,
          COALESCE(u.student_id, '') as student_roll_number
        FROM exam_attempts ea
        LEFT JOIN exams e ON ea.exam_id = e.id
        LEFT JOIN users u ON ea.user_id = u.id
        WHERE ea.id = $1
        LIMIT 1
      `, ['00000000-0000-0000-0000-000000000000']);
      
      console.log('✅ Grading API query works (no results expected for test)');
    } catch (gradingError) {
      console.log('❌ Grading API query failed:', gradingError.message);
      console.log('   This will cause 500 errors on attempt details');
      
      // Try a simpler query to identify the issue
      try {
        const simpleTest = await pool.query(`
          SELECT id, status, submitted_at FROM exam_attempts WHERE id = $1 LIMIT 1
        `, ['00000000-0000-0000-0000-000000000000']);
        console.log('✅ Simple query works, issue is with JOINs or column references');
      } catch (simpleError) {
        console.log('❌ Even simple query failed:', simpleError.message);
      }
    }

    // Fix 5: Test exam submission query
    console.log('\n🧪 Fix 5: Testing exam submission query');
    try {
      const submitTest = await pool.query(`
        UPDATE exam_attempts 
        SET status = $1, submitted_at = NOW(), score = $2, total_points = $3, percentage = $4
        WHERE id = $5
      `, ['submitted', 0, 100, 0, '00000000-0000-0000-0000-000000000000']);
      
      console.log('✅ Exam submission query works');
    } catch (submitError) {
      console.log('❌ Exam submission query failed:', submitError.message);
      console.log('   This will cause 500 errors on exam submission');
    }

    // Fix 6: Update existing records
    console.log('\n🔄 Fix 6: Updating existing records');
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

    // Fix 7: Verify current database state
    console.log('\n🔍 Fix 7: Verifying current database state');
    
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
        AND column_name IN ('violations_count', 'feedback', 'graded_at', 'graded_by', 'started_at', 'total_points', 'passing_threshold')
        ORDER BY column_name
      `);
      
      console.log('✅ Required columns found:');
      columnCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      
      if (columnCheck.rows.length < 7) {
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

    // Fix 8: Check actual exam attempts for debugging
    console.log('\n🔍 Fix 8: Checking actual exam attempts');
    try {
      const attemptsCheck = await pool.query(`
        SELECT id, status, submitted_at, score, percentage 
        FROM exam_attempts 
        ORDER BY submitted_at DESC 
        LIMIT 5
      `);
      
      console.log('✅ Recent exam attempts:');
      attemptsCheck.rows.forEach(attempt => {
        console.log(`  - ${attempt.id.substring(0, 8)}... Status: ${attempt.status}, Score: ${attempt.score}`);
      });
    } catch (attemptsError) {
      console.log('❌ Attempts check failed:', attemptsError.message);
    }

    console.log('\n🎉 EMERGENCY PRODUCTION FIX COMPLETED!');
    console.log('\n📊 NEXT STEPS:');
    console.log('1. Restart backend service: docker restart secure-exam-platform_backend_1');
    console.log('2. Restart frontend service: docker restart secure-exam-platform_frontend_1');
    console.log('3. Test exam submission (should work without 500 errors)');
    console.log('4. Test grading dashboard (should load without 500 errors)');
    console.log('5. Test violation tracking (should work without 400 errors)');
    
  } catch (error) {
    console.error('❌ EMERGENCY PRODUCTION FIX FAILED:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

emergencyProductionFix().catch(console.error);
