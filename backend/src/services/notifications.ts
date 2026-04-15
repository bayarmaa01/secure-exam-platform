import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { pool } from '../db'

let io: SocketIOServer

export interface NotificationData {
  type: 'new_exam' | 'exam_updated' | 'exam_published' | 'exam_completed' | 'exam_started' | 'proctoring_alert'
  examId?: string
  examTitle?: string
  teacherName?: string
  studentId?: string
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}

export function initializeSocketIO(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"]
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Join role-based rooms
    socket.on('join-role', (role: string) => {
      socket.join(`role-${role}`)
      console.log(`User ${socket.id} joined role-${role}`)
    })

    // Join exam-specific rooms
    socket.on('join-exam', (examId: string) => {
      socket.join(`exam-${examId}`)
      console.log(`User ${socket.id} joined exam-${examId}`)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })
}

export function notifyStudents(notification: NotificationData) {
  if (io) {
    io.to('role-student').emit('notification', notification)
    console.log('Notification sent to students:', notification)
  }
}

export function notifyTeachers(notification: NotificationData) {
  if (io) {
    io.to('role-teacher').emit('notification', notification)
    console.log('Notification sent to teachers:', notification)
  }
}

export function notifyAll(notification: NotificationData) {
  if (io) {
    io.emit('notification', notification)
    console.log('Notification sent to all:', notification)
  }
}

export function notifyExamParticipants(examId: string, notification: NotificationData) {
  if (io) {
    io.to(`exam-${examId}`).emit('notification', notification)
    console.log(`Notification sent to exam-${examId} participants:`, notification)
  }
}

export function notifyUser(userId: string, notification: NotificationData) {
  if (io) {
    io.to(`user_${userId}`).emit('notification', notification)
    console.log(`Notification sent to user ${userId}:`, notification)
  }
}

// Store notification in database
export async function storeNotification(userId: string, notification: NotificationData) {
  try {
    await pool.query(`
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId,
      notification.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      notification.message,
      notification.type,
      JSON.stringify(notification.data || {})
    ])
  } catch (error) {
    console.error('Error storing notification:', error)
  }
}

// Get notifications for a user
export async function getUserNotifications(userId: string, limit = 10) {
  try {
    const result = await pool.query(`
      SELECT id, title, message, type, read, data, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit])
    
    return result.rows
  } catch (error) {
    console.error('Error getting notifications:', error)
    return []
  }
}

// Mark notification as read
export async function markNotificationRead(notificationId: string, userId: string) {
  try {
    await pool.query(`
      UPDATE notifications
      SET read = true
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId])
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}

// Helper function to send notifications when exam is created
export async function notifyNewExam(examId: string, teacherId: string) {
  try {
    const result = await pool.query(
      `SELECT e.title, u.name as teacher_name 
       FROM exams e 
       JOIN users u ON e.teacher_id = u.id 
       WHERE e.id = $1`,
      [examId]
    )
    
    if (result && result.rows && result.rows.length > 0) {
      const exam = result.rows[0]
      const notification: NotificationData = {
        type: 'new_exam',
        examId,
        examTitle: exam.title,
        teacherName: exam.teacher_name,
        message: `New exam "${exam.title}" created by ${exam.teacher_name}`,
        timestamp: new Date(),
        data: { examId, teacherId }
      }
      
      // Get all students enrolled in course and store notifications
      const students = await pool.query(
        `SELECT u.id FROM users u
         JOIN enrollments en ON u.id = en.student_id
         WHERE en.course_id = (
           SELECT course_id FROM exams WHERE id = $1
         ) AND u.role = 'student'`,
        [examId]
      )
      
      for (const student of students.rows) {
        await storeNotification(student.id, notification)
      }
      
      notifyStudents(notification)
    }
  } catch (error) {
    console.error('Error sending new exam notification:', error)
  }
}

// Helper function to send notifications when exam is published
export async function notifyExamPublished(examId: string) {
  try {
    const result = await pool.query(
      `SELECT e.title, u.name as teacher_name 
       FROM exams e 
       JOIN users u ON e.teacher_id = u.id 
       WHERE e.id = $1`,
      [examId]
    )
    
    if (result.rows.length > 0) {
      const exam = result.rows[0]
      const notification: NotificationData = {
        type: 'exam_published',
        examId,
        examTitle: exam.title,
        teacherName: exam.teacher_name,
        message: `Exam "${exam.title}" is now available!`,
        timestamp: new Date(),
        data: { examId }
      }
      
      // Get all students enrolled in course and store notifications
      const students = await pool.query(
        `SELECT u.id FROM users u
         JOIN enrollments en ON u.id = en.student_id
         WHERE en.course_id = (
           SELECT course_id FROM exams WHERE id = $1
         ) AND u.role = 'student'`,
        [examId]
      )
      
      for (const student of students.rows) {
        await storeNotification(student.id, notification)
      }
      
      notifyStudents(notification)
    }
  } catch (error) {
    console.error('Error sending exam published notification:', error)
  }
}

// Helper function to send notifications when exam is started
export async function notifyExamStarted(examId: string, studentId: string) {
  try {
    const result = await pool.query(
      `SELECT e.title, u.name as student_name
       FROM exams e 
       JOIN users u ON u.id = $1
       WHERE e.id = $2`,
      [studentId, examId]
    )
    
    if (result.rows.length > 0) {
      const exam = result.rows[0]
      const notification: NotificationData = {
        type: 'exam_started',
        examId,
        examTitle: exam.title,
        studentId,
        message: `${exam.student_name} started exam "${exam.title}"`,
        timestamp: new Date(),
        data: { examId, studentId }
      }
      
      // Notify teachers
      notifyTeachers(notification)
      
      // Store notification for teachers
      const teachers = await pool.query(
        'SELECT id FROM users WHERE role = \'teacher\''
      )
      
      for (const teacher of teachers.rows) {
        await storeNotification(teacher.id, notification)
      }
    }
  } catch (error) {
    console.error('Error sending exam started notification:', error)
  }
}

// Helper function to send proctoring alerts
export async function notifyProctoringAlert(attemptId: string, riskScore: number, alertType: string) {
  try {
    const result = await pool.query(
      `SELECT ea.user_id, e.title, u.name as student_name
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       JOIN users u ON ea.user_id = u.id
       WHERE ea.id = $1`,
      [attemptId]
    )
    
    if (result.rows.length > 0) {
      const attempt = result.rows[0]
      const notification: NotificationData = {
        type: 'proctoring_alert',
        examId: attemptId,
        examTitle: attempt.title,
        studentId: attempt.user_id,
        message: `Proctoring alert: ${alertType} detected for ${attempt.student_name} (Risk: ${riskScore})`,
        timestamp: new Date(),
        data: { attemptId, riskScore, alertType }
      }
      
      // Notify teachers immediately
      notifyTeachers(notification)
    }
  } catch (error) {
    console.error('Error sending proctoring alert:', error)
  }
}
