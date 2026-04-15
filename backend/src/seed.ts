import bcrypt from 'bcrypt'
import { pool } from './db'
import fs from 'fs'
import path from 'path'

interface User {
  username: string
  name: string
  email: string
  password: string
  role: string
  student_id?: string
  id?: string
}

interface Course {
  name: string
  description: string
  teacher_id: string
  id?: string
}

interface Enrollment {
  course_id: string
  student_id: string
}

export async function seedDatabase() {
  console.log('Starting database seeding...')
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // 1. Create Teacher
    const teacherPassword = await bcrypt.hash('Test1234', 10)
    const teacherResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO NOTHING 
       RETURNING id`,
      ['Teacher One', 'teacher@test.com', teacherPassword, 'teacher']
    )
    
    const teacherId = teacherResult.rows[0]?.id
    if (!teacherId) {
      console.log('Teacher already exists, fetching ID...')
      const existingTeacher = await client.query(
        'SELECT id FROM users WHERE email = $1',
        ['teacher@test.com']
      )
      if (existingTeacher.rows.length === 0) {
        throw new Error('Failed to create or find teacher')
      }
    }
    
    console.log('Teacher created/verified:', teacherId || 'existing')
    
    // 2. Create 10 Students
    const students: User[] = []
    const studentPassword = await bcrypt.hash('Test1234', 10)
    
    for (let i = 1; i <= 10; i++) {
      const studentId = `STU${String(i).padStart(3, '0')}`
      const username = `student${i}`
      const name = `Student ${i}`
      const email = `student${i}@test.com`
      
      const studentResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role, student_id) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (email) DO NOTHING 
         RETURNING id`,
        [name, email, studentPassword, 'student', studentId]
      )
      
      const studentUuid = studentResult.rows[0]?.id
      if (!studentUuid) {
        console.log(`Student ${username} already exists, fetching ID...`)
        const existingStudent = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        )
        if (existingStudent.rows.length === 0) {
          throw new Error(`Failed to create or find student ${username}`)
        }
      }
      
      students.push({
        username,
        name,
        email,
        password: 'Test1234',
        role: 'student',
        student_id: studentId,
        id: studentUuid
      })
      
      console.log(`Student ${username} created/verified:`, studentUuid || 'existing')
    }
    
    // 3. Create 2 Courses
    const courses: Course[] = [
      { name: 'DevOps', description: 'DevOps Fundamentals and Practices', teacher_id: teacherId },
      { name: 'Web Engineering', description: 'Modern Web Development', teacher_id: teacherId }
    ]
    
    for (const course of courses) {
      const courseResult = await client.query(
        `INSERT INTO courses (name, description, teacher_id) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name, teacher_id) DO NOTHING 
         RETURNING id`,
        [course.name, course.description, course.teacher_id]
      )
      
      const courseId = courseResult.rows[0]?.id
      if (!courseId) {
        console.log(`Course ${course.name} already exists, fetching ID...`)
        const existingCourse = await client.query(
          'SELECT id FROM courses WHERE name = $1 AND teacher_id = $2',
          [course.name, course.teacher_id]
        )
        if (existingCourse.rows.length === 0) {
          throw new Error(`Failed to create or find course ${course.name}`)
        }
        course.id = existingCourse.rows[0].id
      } else {
        course.id = courseId
      }
      
      console.log(`Course ${course.name} created/verified:`, course.id || 'existing')
    }
    
    // 4. Enroll Students into Courses
    const devOpsCourse = courses.find(c => c.name === 'DevOps')
    const webCourse = courses.find(c => c.name === 'Web Engineering')
    
    if (!devOpsCourse?.id || !webCourse?.id) {
      throw new Error('Failed to find course IDs')
    }
    
    // Enroll students 1-5 in DevOps
    for (let i = 0; i < 5; i++) {
      const student = students[i]
      if (!student.id) continue
      
      await client.query(
        `INSERT INTO enrollments (course_id, student_id) 
         VALUES ($1, $2) 
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [devOpsCourse.id, student.id]
      )
      
      console.log(`Enrolled ${student.username} in DevOps course`)
    }
    
    // Enroll students 6-10 in Web Engineering
    for (let i = 5; i < 10; i++) {
      const student = students[i]
      if (!student.id) continue
      
      await client.query(
        `INSERT INTO enrollments (course_id, student_id) 
         VALUES ($1, $2) 
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [webCourse.id, student.id]
      )
      
      console.log(`Enrolled ${student.username} in Web Engineering course`)
    }
    
    await client.query('COMMIT')
    
    // 5. Generate Credentials File
    await generateCredentialsFile(students)
    
    console.log('Database seeding completed successfully!')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Database seeding failed:', error)
    throw error
  } finally {
    client.release()
  }
}

async function generateCredentialsFile(students: User[]) {
  const credentialsPath = path.join(process.cwd(), 'users_credentials.txt')
  
  let content = '===== TEACHER =====\n'
  content += 'Username: teacher1\n'
  content += 'Email: teacher@test.com\n'
  content += 'Password: Test1234\n\n'
  
  content += '===== STUDENTS =====\n'
  for (const student of students) {
    content += `Username: ${student.username} | Email: ${student.email} | Password: ${student.password} | StudentID: ${student.student_id}\n`
  }
  
  fs.writeFileSync(credentialsPath, content, 'utf-8')
  console.log(`Credentials file generated at: ${credentialsPath}`)
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seeding completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Seeding failed:', error)
      process.exit(1)
    })
}
