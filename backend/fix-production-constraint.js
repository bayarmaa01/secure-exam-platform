const { Pool } = require('pg');

async function fixProductionConstraint() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'SecureExamPlatform2024!',
  });

  try {
    console.log('🔧 Fixing production database constraint...');
    
    // Step 1: Drop the existing constraint
    console.log('🗑️  Dropping existing status constraint...');
    try {
      await pool.query(`
        ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check
      `);
      console.log('✅ Existing constraint dropped');
    } catch (dropError) {
      console.log('⚠️  Could not drop constraint (may not exist):', dropError.message);
    }

    // Step 2: Add the updated constraint with all statuses
    console.log('➕ Adding updated status constraint...');
    await pool.query(`
      ALTER TABLE exam_attempts 
      ADD CONSTRAINT exam_attempts_status_check 
      CHECK (status IN ('in_progress', 'submitted', 'pending_review', 'graded', 'terminated'))
    `);
    console.log('✅ Updated constraint added successfully');

    // Step 3: Verify the constraint works
    console.log('🧪 Testing constraint with new statuses...');
    const testStatuses = ['pending_review', 'graded', 'terminated'];
    
    for (const status of testStatuses) {
      try {
        await pool.query(`
          INSERT INTO exam_attempts (exam_id, user_id, status, submitted_at)
          VALUES (
            (SELECT id FROM exams LIMIT 1),
            (SELECT id FROM users WHERE role = 'student' LIMIT 1),
            $1, NOW()
          )
          ON CONFLICT DO NOTHING
        `, [status]);
        console.log(`✅ Status '${status}' is now allowed`);
      } catch (statusError) {
        console.log(`❌ Status '${status}' still not allowed: ${statusError.message}`);
      }
    }

    // Step 4: Check current constraint
    console.log('🔍 Verifying current constraint...');
    const constraintCheck = await pool.query(`
      SELECT con.conname, con.conkey 
      FROM pg_constraint con 
      INNER JOIN pg_class rel ON rel.oid = con.conrelid 
      WHERE rel.relname = 'exam_attempts' 
      AND con.conname LIKE '%status%'
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log('✅ Status constraint found:');
      constraintCheck.rows.forEach(constraint => {
        console.log(`  - ${constraint.conname}`);
      });
    } else {
      console.log('⚠️  No status constraint found');
    }

    console.log('🎉 Production constraint fix completed!');
    
  } catch (error) {
    console.error('❌ Constraint fix failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixProductionConstraint().catch(console.error);
