import api from './index'

export interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  scheduledAt: string
  status: 'draft' | 'published' | 'ongoing' | 'completed'
  createdAt: string
}

export interface CreateExamRequest {
  title: string
  description?: string
  durationMinutes: number
  scheduledAt: string
}

export interface Student {
  id: string
  email: string
  name: string
  studentId?: string
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
    const response = await api.get<Exam[]>('/exams')
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
    const response = await api.post<Exam>('/teacher/exams', data)
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
  }
}
