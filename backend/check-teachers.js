const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkTeachers() {
  console.log('🔍 Checking teachers in database...\n');
  
  try {
    // Get all teachers
    const teachersQuery = 'SELECT id, name, email, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC';
    const teachersResult = await pool.query(teachersQuery, ['teacher']);
    
    console.log(`✅ Found ${teachersResult.rows.length} teachers:\n`);
    
    if (teachersResult.rows.length === 0) {
      console.log('❌ No teachers found in database');
      
      // Check all users
      const allUsersQuery = 'SELECT id, name, email, role FROM users ORDER BY created_at DESC';
      const allUsersResult = await pool.query(allUsersQuery);
      
      console.log(`📊 Total users: ${allUsersResult.rows.length}`);
      allUsersResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
      });
      
      return;
    }
    
    teachersResult.rows.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.name} (${teacher.email})`);
      console.log(`   ID: ${teacher.id}`);
      console.log(`   Created: ${teacher.created_at}`);
      console.log('');
    });
    
    // Check exams for each teacher
    for (const teacher of teachersResult.rows) {
      const examsQuery = `
        SELECT COUNT(*) as count
        FROM exams 
        WHERE teacher_id = $1
      `;
      const examsResult = await pool.query(examsQuery, [teacher.id]);
      
      console.log(`📚 ${teacher.name}: ${examsResult.rows[0].count} exams`);
    }
    
    // Check the specific teacher ID from logs
    const logTeacherId = '83035217-e1cb-42fb-b83d-7b646e92b2f9';
    console.log(`\n🔍 Checking teacher ID from logs: ${logTeacherId}`);
    
    const specificTeacherQuery = 'SELECT * FROM users WHERE id = $1';
    const specificResult = await pool.query(specificTeacherQuery, [logTeacherId]);
    
    if (specificResult.rows.length === 0) {
      console.log('❌ Teacher ID from logs not found in database');
      console.log('   This suggests a database sync issue or different environment');
      
      // Check if there's a teacher with similar email
      const emailQuery = "SELECT * FROM users WHERE email LIKE '%Teacher@test.com%' OR email LIKE '%teacher%'";
      const emailResult = await pool.query(emailQuery);
      
      if (emailResult.rows.length > 0) {
        console.log('📧 Found similar teacher accounts:');
        emailResult.rows.forEach(user => {
          console.log(`   ${user.name} (${user.email}) - ID: ${user.id}`);
        });
      }
    } else {
      console.log('✅ Teacher found:', specificResult.rows[0].name);
    }
    
    // Check for any exams at all
    const allExamsQuery = 'SELECT COUNT(*) as count FROM exams';
    const allExamsResult = await pool.query(allExamsQuery);
    console.log(`\n📊 Total exams in database: ${allExamsResult.rows[0].count}`);
    
    if (allExamsResult.rows[0].count > 0) {
      const recentExamsQuery = `
        SELECT e.title, u.name as teacher_name, u.email as teacher_email, e.created_at
        FROM exams e
        JOIN users u ON e.teacher_id = u.id
        ORDER BY e.created_at DESC
        LIMIT 5
      `;
      const recentExamsResult = await pool.query(recentExamsQuery);
      
      console.log('\n📋 Recent exams:');
      recentExamsResult.rows.forEach((exam, index) => {
        console.log(`   ${index + 1}. ${exam.title} by ${exam.teacher_name} (${exam.teacher_email})`);
        console.log(`      Created: ${exam.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkTeachers().catch(console.error);
