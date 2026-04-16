const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function comprehensiveDBCheck() {
  console.log('🔍 COMPREHENSIVE DATABASE VERIFICATION');
  console.log('='.repeat(60));
  
  try {
    const client = await pool.connect();
    
    // 1. USERS TABLE
    console.log('\n📋 1. USERS TABLE');
    console.log('-'.repeat(40));
    const users = await client.query('SELECT * FROM users ORDER BY created_at');
    console.log(`Total users: ${users.rows.length}`);
    users.rows.forEach((user, index) => {
      console.log(`User ${index + 1}:`, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        registration_number: user.registration_number,
        student_id: user.student_id,
        created_at: user.created_at
      });
    });
    
    // 2. COURSES TABLE
    console.log('\n📚 2. COURSES TABLE');
    console.log('-'.repeat(40));
    const courses = await client.query('SELECT * FROM courses ORDER BY created_at');
    console.log(`Total courses: ${courses.rows.length}`);
    courses.rows.forEach((course, index) => {
      console.log(`Course ${index + 1}:`, {
        id: course.id,
        name: course.name,
        description: course.description,
        teacher_id: course.teacher_id,
        created_at: course.created_at
      });
    });
    
    // 3. ENROLLMENTS TABLE
    console.log('\n👥 3. ENROLLMENTS TABLE');
    console.log('-'.repeat(40));
    const enrollments = await client.query(`
      SELECT en.*, u.name as student_name, u.email as student_email, u.registration_number as student_reg, 
             c.name as course_name, t.name as teacher_name
      FROM enrollments en 
      JOIN users u ON en.student_id = u.id 
      JOIN courses c ON en.course_id = c.id 
      JOIN users t ON c.teacher_id = t.id 
      ORDER BY en.enrolled_at
    `);
    console.log(`Total enrollments: ${enrollments.rows.length}`);
    enrollments.rows.forEach((enrollment, index) => {
      console.log(`Enrollment ${index + 1}:`, {
        id: enrollment.id,
        course_id: enrollment.course_id,
        course_name: enrollment.course_name,
        student_id: enrollment.student_id,
        student_name: enrollment.student_name,
        student_email: enrollment.student_email,
        student_reg: enrollment.student_reg,
        teacher_name: enrollment.teacher_name,
        enrolled_at: enrollment.enrolled_at
      });
    });
    
    // 4. EXAMS TABLE
    console.log('\n📝 4. EXAMS TABLE');
    console.log('-'.repeat(40));
    const exams = await client.query(`
      SELECT e.*, c.name as course_name, t.name as teacher_name
      FROM exams e 
      LEFT JOIN courses c ON e.course_id = c.id 
      LEFT JOIN users t ON e.teacher_id = t.id 
      ORDER BY e.created_at
    `);
    console.log(`Total exams: ${exams.rows.length}`);
    exams.rows.forEach((exam, index) => {
      console.log(`Exam ${index + 1}:`, {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        course_id: exam.course_id,
        course_name: exam.course_name,
        teacher_id: exam.teacher_id,
        teacher_name: exam.teacher_name,
        duration_minutes: exam.duration_minutes,
        start_time: exam.start_time,
        end_time: exam.end_time,
        status: exam.status,
        created_at: exam.created_at
      });
    });
    
    // 5. QUESTIONS TABLE
    console.log('\n❓ 5. QUESTIONS TABLE');
    console.log('-'.repeat(40));
    const questions = await client.query(`
      SELECT q.*, e.title as exam_title, c.name as course_name
      FROM questions q 
      LEFT JOIN exams e ON q.exam_id = e.id 
      LEFT JOIN courses c ON e.course_id = c.id 
      ORDER BY q.created_at
    `);
    console.log(`Total questions: ${questions.rows.length}`);
    questions.rows.forEach((question, index) => {
      console.log(`Question ${index + 1}:`, {
        id: question.id,
        exam_id: question.exam_id,
        exam_title: question.exam_title,
        course_name: question.course_name,
        question_text: question.question_text,
        type: question.type,
        points: question.points,
        created_at: question.created_at
      });
    });
    
    // 6. NOTIFICATIONS TABLE
    console.log('\n🔔 6. NOTIFICATIONS TABLE');
    console.log('-'.repeat(40));
    const notifications = await client.query(`
      SELECT n.*, u.name as user_name, c.name as course_name
      FROM notifications n 
      LEFT JOIN users u ON n.user_id = u.id 
      LEFT JOIN courses c ON n.course_id = c.id 
      ORDER BY n.created_at DESC
    `);
    console.log(`Total notifications: ${notifications.rows.length}`);
    notifications.rows.forEach((notification, index) => {
      console.log(`Notification ${index + 1}:`, {
        id: notification.id,
        user_id: notification.user_id,
        user_name: notification.user_name,
        course_id: notification.course_id,
        course_name: notification.course_name,
        message: notification.message,
        type: notification.type,
        is_read: notification.is_read,
        created_at: notification.created_at
      });
    });
    
    // 7. DATA CONSISTENCY CHECKS
    console.log('\n🔍 7. DATA CONSISTENCY CHECKS');
    console.log('-'.repeat(40));
    
    // Check enrollment foreign key consistency
    const enrollmentFKCheck = await client.query(`
      SELECT en.id, en.course_id, en.student_id
      FROM enrollments en 
      LEFT JOIN courses c ON en.course_id = c.id 
      LEFT JOIN users u ON en.student_id = u.id 
      WHERE c.id IS NULL OR u.id IS NULL
    `);
    console.log(`Orphaned enrollments: ${enrollmentFKCheck.rows.length}`);
    
    // Check exam foreign key consistency
    const examFKCheck = await client.query(`
      SELECT e.id, e.course_id, e.teacher_id
      FROM exams e 
      LEFT JOIN courses c ON e.course_id = c.id 
      LEFT JOIN users u ON e.teacher_id = u.id 
      WHERE c.id IS NULL OR u.id IS NULL
    `);
    console.log(`Orphaned exams: ${examFKCheck.rows.length}`);
    
    // Check question foreign key consistency
    const questionFKCheck = await client.query(`
      SELECT q.id, q.exam_id
      FROM questions q 
      LEFT JOIN exams e ON q.exam_id = e.id 
      WHERE e.id IS NULL
    `);
    console.log(`Orphaned questions: ${questionFKCheck.rows.length}`);
    
    client.release();
  } catch (error) {
    console.error('Database verification error:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 DATABASE VERIFICATION COMPLETE');
  await pool.end();
}

comprehensiveDBCheck();
