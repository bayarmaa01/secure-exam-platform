const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'SecureExamPlatform2024!',
  });

  try {
    console.log('🔄 Running exam_attempts schema update...');
    
    // Add new columns if they don't exist
    console.log('📝 Adding new columns...');
    await pool.query(`
      ALTER TABLE exam_attempts 
      ADD COLUMN IF NOT EXISTS violations_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS feedback TEXT,
      ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES users(id)
    `);
    console.log('✅ Columns added successfully');

    // Update the status constraint to include new statuses
    console.log('🔄 Updating status constraint...');
    try {
      await pool.query(`
        DO $$ 
        BEGIN
            ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check;
        EXCEPTION
            WHEN undefined_object THEN
                NULL; -- Constraint doesn't exist, that's fine
        END $$
      `);
      
      await pool.query(`
        ALTER TABLE exam_attempts 
        ADD CONSTRAINT exam_attempts_status_check 
        CHECK (status IN ('in_progress', 'submitted', 'pending_review', 'graded', 'terminated'))
      `);
      console.log('✅ Status constraint updated successfully');
    } catch (constraintError) {
      console.log('⚠️  Status constraint update failed (may already exist):', constraintError.message);
    }

    // Create indexes for better performance
    console.log('📊 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exam_attempts_graded_by ON exam_attempts(graded_by);
      CREATE INDEX IF NOT EXISTS idx_exam_attempts_graded_at ON exam_attempts(graded_at);
      CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);
    `);
    console.log('✅ Indexes created successfully');

    // Update any existing records that might need status updates
    console.log('🔄 Updating existing records...');
    const updateResult = await pool.query(`
      UPDATE exam_attempts 
      SET status = 'pending_review' 
      WHERE status IN ('submitted') 
      AND exam_id IN (
          SELECT id FROM exams 
          WHERE type IN ('writing', 'coding')
      )
      RETURNING id
    `);
    console.log(`✅ Updated ${updateResult.rowCount} records to 'pending_review'`);

    // Verify the changes
    console.log('🔍 Verifying changes...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'exam_attempts' 
      AND column_name IN ('violations_count', 'feedback', 'graded_at', 'graded_by')
      ORDER BY column_name
    `);
    
    console.log('📊 Updated columns:');
    if (result.rows.length === 0) {
      console.log('  No new columns found (they may already exist)');
    } else {
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
