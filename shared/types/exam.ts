// Shared TypeScript interface for exam data
// This ensures consistency between backend and frontend

export interface Exam {
  id: string
  title: string
  description?: string
  durationMinutes: number
  questionCount: number
  startTime: string
  endTime: string
  status: 'draft' | 'published' | 'ongoing' | 'completed'
  isPublished: boolean
  courseId?: string
  courseName?: string
  teacherId?: string
  teacherName?: string
  createdAt?: string
  updatedAt?: string
  // Additional fields for frontend compatibility
  scheduledAt?: string // deprecated, use startTime
  completed?: boolean // for student view
  attemptId?: string // for student view
  attemptCount?: number // for teacher view
}

export interface ExamQuestion {
  id: string
  question_text: string
  type: 'mcq' | 'short_answer' | 'long_answer' | 'coding'
  options?: string[]
  correct_answer?: string
  points: number
  language?: string
  starter_code?: string
  test_cases?: any
}

export interface ExamAttempt {
  id: string
  exam_id: string
  user_id: string
  status: 'in_progress' | 'submitted' | 'graded'
  started_at: string
  submitted_at?: string
  score?: number
  total_points?: number
  percentage?: number
  answers?: any
}

export interface ExamResponse {
  success: boolean
  data?: {
    attemptId: string
    examId: string
    userId: string
    status: string
    startedAt: string
    exam: Exam
  }
  error?: string
  reason?: string
  message?: string
}

export interface ExamError {
  error: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_ERROR'
  reason: string
  details?: any
}
