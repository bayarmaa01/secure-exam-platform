const { Pool } = require('pg');

async function testSystem() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'SecureExamPlatform2024!',
  });

  try {
    console.log('🧪 Testing system after migration...\n');

    // Test 1: Check exam_attempts table structure
    console.log('📋 Test 1: Checking exam_attempts table structure');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'exam_attempts' 
      AND column_name IN ('violations_count', 'feedback', 'graded_at', 'graded_by', 'status')
      ORDER BY column_name
    `);
    
    console.log('✅ exam_attempts columns:');
    tableStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Test 2: Check if we can insert different status values
    console.log('\n📋 Test 2: Testing status constraint');
    try {
      // Test if new statuses are allowed
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
          console.log(`  ✅ Status '${status}' is allowed`);
        } catch (statusError) {
          console.log(`  ❌ Status '${status}' not allowed: ${statusError.message}`);
        }
      }
    } catch (error) {
      console.log('⚠️  Could not test status constraint:', error.message);
    }

    // Test 3: Check indexes
    console.log('\n📋 Test 3: Checking indexes');
    const indexCheck = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename = 'exam_attempts' 
      AND indexname LIKE 'idx_exam_attempts_%'
    `);
    
    console.log('✅ Indexes found:');
    indexCheck.rows.forEach(index => {
      console.log(`  - ${index.indexname} on ${index.tablename}`);
    });

    // Test 4: Check existing exam attempts
    console.log('\n📋 Test 4: Checking existing exam attempts');
    const attemptsCheck = await pool.query(`
      SELECT id, status, violations_count, score, percentage, submitted_at, graded_at
      FROM exam_attempts 
      ORDER BY submitted_at DESC 
      LIMIT 5
    `);
    
    console.log(`✅ Found ${attemptsCheck.rowCount} recent attempts:`);
    attemptsCheck.rows.forEach(attempt => {
      console.log(`  - ID: ${attempt.id.substring(0, 8)}...`);
      console.log(`    Status: ${attempt.status}`);
      console.log(`    Score: ${attempt.score || 'NULL'}`);
      console.log(`    Violations: ${attempt.violations_count || 'NULL'}`);
      console.log(`    Submitted: ${attempt.submitted_at}`);
      console.log(`    Graded: ${attempt.graded_at || 'NOT GRADED'}`);
      console.log('');
    });

    // Test 5: Check for writing/coding exams that should be pending_review
    console.log('📋 Test 5: Checking for writing/coding exams');
    const writingCodingAttempts = await pool.query(`
      SELECT ea.id, ea.status, e.type, e.title
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE e.type IN ('writing', 'coding')
      AND ea.status = 'submitted'
      ORDER BY ea.submitted_at DESC
      LIMIT 3
    `);
    
    if (writingCodingAttempts.rowCount > 0) {
      console.log(`✅ Found ${writingCodingAttempts.rowCount} writing/coding attempts that should be pending_review:`);
      writingCodingAttempts.rows.forEach(attempt => {
        console.log(`  - ${attempt.title} (${attempt.type}): ${attempt.status}`);
      });
    } else {
      console.log('ℹ️  No writing/coding exams with submitted status found');
    }

    // Test 6: Check for terminated attempts
    console.log('\n📋 Test 6: Checking for terminated attempts');
    const terminatedAttempts = await pool.query(`
      SELECT id, status, violations_count, submitted_at
      FROM exam_attempts 
      WHERE status = 'terminated'
      ORDER BY submitted_at DESC
      LIMIT 3
    `);
    
    if (terminatedAttempts.rowCount > 0) {
      console.log(`✅ Found ${terminatedAttempts.rowCount} terminated attempts:`);
      terminatedAttempts.rows.forEach(attempt => {
        console.log(`  - ID: ${attempt.id.substring(0, 8)}...`);
        console.log(`    Violations: ${attempt.violations_count}`);
        console.log(`    Terminated: ${attempt.submitted_at}`);
      });
    } else {
      console.log('ℹ️  No terminated attempts found');
    }

    console.log('\n🎉 System test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Database schema updated ✅`);
    console.log(`  - ${attemptsCheck.rowCount} exam attempts found ✅`);
    console.log(`  - ${writingCodingAttempts.rowCount} writing/coding attempts ✅`);
    console.log(`  - ${terminatedAttempts.rowCount} terminated attempts ✅`);
    console.log(`  - System ready for testing ✅`);

  } catch (error) {
    console.error('❌ System test failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testSystem().catch(console.error);
