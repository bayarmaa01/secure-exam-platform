#!/usr/bin/env node

/**
 * Script to publish an exam
 * Usage: node publish-exam.js <exam-id>
 * This script sets is_published=true and status='published' for the specified exam
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/exam_platform'
});

async function publishExam(examId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if exam exists
    const examCheck = await client.query(
      'SELECT id, title, status, is_published FROM exams WHERE id = $1',
      [examId]
    );
    
    if (examCheck.rows.length === 0) {
      console.error(`❌ Exam ${examId} not found`);
      process.exit(1);
    }
    
    const exam = examCheck.rows[0];
    console.log(`📋 Found exam: ${exam.title} (status: ${exam.status}, published: ${exam.is_published})`);
    
    // Publish the exam
    const result = await client.query(
      `UPDATE exams 
       SET is_published = true, status = 'published', updated_at = NOW()
       WHERE id = $1 
       RETURNING id, title, status, is_published, updated_at`,
      [examId]
    );
    
    await client.query('COMMIT');
    
    const updatedExam = result.rows[0];
    console.log(`✅ Exam published successfully!`);
    console.log(`   ID: ${updatedExam.id}`);
    console.log(`   Title: ${updatedExam.title}`);
    console.log(`   Status: ${updatedExam.status}`);
    console.log(`   Published: ${updatedExam.is_published}`);
    console.log(`   Updated at: ${updatedExam.updated_at}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error publishing exam:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// List all exams if no ID provided
async function listExams() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT id, title, status, is_published, created_at 
       FROM exams 
       ORDER BY created_at DESC`
    );
    
    console.log('\n📚 Available Exams:');
    console.log('ID\t\t\t\tStatus\t\tPublished\tTitle');
    console.log('─'.repeat(80));
    
    result.rows.forEach(exam => {
      const published = exam.is_published ? '✅' : '❌';
      console.log(`${exam.id.substring(0, 8)}...\t${exam.status}\t\t${published}\t\t${exam.title}`);
    });
    
    console.log('\nUsage: node publish-exam.js <exam-id>');
    
  } catch (error) {
    console.error('❌ Error listing exams:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Main execution
const examId = process.argv[2];

if (!examId) {
  console.log('🔍 No exam ID provided. Listing available exams...\n');
  listExams();
} else {
  publishExam(examId);
}
