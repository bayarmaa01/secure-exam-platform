import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { pool } from '../db'

let io: SocketIOServer

export interface NotificationData {
  type: 'new_exam' | 'exam_updated' | 'exam_published' | 'exam_completed'
  examId?: string
  examTitle?: string
  teacherName?: string
  message: string
  timestamp: Date
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
    
    if (result.rows.length > 0) {
      const exam = result.rows[0]
      const notification: NotificationData = {
        type: 'new_exam',
        examId,
        examTitle: exam.title,
        teacherName: exam.teacher_name,
        message: `New exam "${exam.title}" created by ${exam.teacher_name}`,
        timestamp: new Date()
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
        timestamp: new Date()
      }
      
      notifyStudents(notification)
    }
  } catch (error) {
    console.error('Error sending exam published notification:', error)
  }
}
