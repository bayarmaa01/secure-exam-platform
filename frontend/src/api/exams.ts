import api from './index'

export interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  startTime: string
  endTime: string
  status: 'draft' | 'published' | 'ongoing' | 'completed'
  courseName: string
  courseId: string
  questionCount: number
  createdAt: string
}

export interface CreateExamRequest {
  title: string
  description?: string
  course_id: string
  type?: string
  duration_minutes: number
  start_time: string
  end_time?: string
  difficulty?: string
  total_marks?: number
  passing_marks?: number
  fullscreen_required?: boolean
  tab_switch_detection?: boolean
  copy_paste_blocked?: boolean
  camera_required?: boolean
  face_detection_enabled?: boolean
  shuffle_questions?: boolean
  shuffle_options?: boolean
  assign_to_all?: boolean
  assigned_groups?: string[]
}

export interface Student {
  id: string
  email: string
  name: string
  registration_number?: string
  createdAt: string
}

export interface Result {
  id: string
  score: number
  totalPoints: number
  percentage: number
  status: string
  studentName: string
  examTitle: string
  createdAt: string
}

export interface SubmitExamRequest {
  examId: string
  answers: Array<{
    questionId: string
    answer: string | string[]
  }>
}

export const examService = {
  // Student routes
  getAvailableExams: async (): Promise<Exam[]> => {
    const response = await api.get<Exam[]>('/student/exams')
    return response.data
  },

  submitExam: async (data: SubmitExamRequest) => {
    const response = await api.post('/student/submit', data)
    return response.data
  },

  // Teacher routes
  getTeacherExams: async (): Promise<Exam[]> => {
    const response = await api.get<Exam[]>('/teacher/exams')
    return response.data
  },

  createExam: async (data: CreateExamRequest): Promise<Exam> => {
    const response = await api.post<Exam>('/exams', data)
    return response.data
  },

  getStudents: async (): Promise<Student[]> => {
    const response = await api.get<Student[]>('/teacher/students')
    return response.data
  },

  getResults: async (): Promise<Result[]> => {
    const response = await api.get<Result[]>('/teacher/results')
    return response.data
  },

  // Common routes
  getExamById: async (id: string): Promise<Exam> => {
    const response = await api.get<Exam>(`/exams/${id}`)
    return response.data
  },

  deleteExam: async (id: string): Promise<void> => {
    await api.delete(`/exams/${id}`)
  }
}
