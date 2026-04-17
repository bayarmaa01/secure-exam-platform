import api from '../api'

export interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  startTime: string
  endTime: string
  status: string
  courseName: string
  courseDescription: string
  questionCount: number
}

export interface Attempt {
  id: string
  examId: string
  userId: string
  status: string
  startedAt: string
  submittedAt?: string
  score?: number
  totalPoints?: number
  percentage?: number
}

export interface Answer {
  questionId: string
  answer: string
}

export interface ExamSubmission {
  attemptId: string
  answers: Answer[]
}

export interface ExamResult {
  id: string
  examTitle: string
  score: number
  totalPoints: number
  percentage: number
  status: string
  submittedAt: string
  courseName?: string
  durationMinutes?: number
}

export interface Warning {
  id: string
  userId: string
  examId: string
  type: string
  message: string
  createdAt: string
}

export interface WarningStats {
  type: string
  count: number
  totalCount: number
  suspicious: boolean
  autoSubmitted?: boolean
  cheating?: boolean
}

class ExamApi {
  // Start exam attempt
  async startExam(examId: string): Promise<{ success: boolean; data?: Attempt; message?: string }> {
    try {
      console.log(`Starting exam: ${examId}`)
      const response = await api.post(`/exams/${examId}/start`)
      console.log('Start exam response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to start exam:', error.response?.data || error.message)
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to start exam'
      }
    }
  }

  // Submit exam answers
  async submitExam(examId: string, submission: ExamSubmission): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      console.log(`Submitting exam: ${examId}`, submission)
      const response = await api.post(`/exams/${examId}/submit`, submission)
      console.log('Submit exam response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to submit exam:', error.response?.data || error.message)
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to submit exam'
      }
    }
  }

  // Get student results
  async getStudentResults(): Promise<{ success: boolean; data?: ExamResult[]; message?: string }> {
    try {
      console.log('Fetching student results')
      const response = await api.get('/student/results')
      console.log('Student results response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to fetch student results:', error.response?.data || error.message)
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch results'
      }
    }
  }

  // Get teacher results
  async getTeacherResults(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log('Fetching teacher results')
      const response = await api.get('/teacher/results')
      console.log('Teacher results response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to fetch teacher results:', error.response?.data || error.message)
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch results'
      }
    }
  }

  // Create warning
  async createWarning(userId: string, examId: string, type: string, message: string): Promise<{ success: boolean; data?: WarningStats; message?: string }> {
    try {
      console.log(`Creating warning: ${type} for user ${userId}`)
      const response = await api.post('/warnings', {
        userId,
        examId,
        type,
        message
      })
      console.log('Create warning response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to create warning:', error.response?.data || error.message)
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create warning'
      }
    }
  }

  // Get warnings
  async getWarnings(userId?: string, examId?: string): Promise<{ success: boolean; data?: Warning[]; message?: string }> {
    try {
      console.log('Fetching warnings', { userId, examId })
      const params = new URLSearchParams()
      if (userId) params.append('userId', userId)
      if (examId) params.append('examId', examId)
      
      const response = await api.get(`/warnings?${params.toString()}`)
      console.log('Warnings response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to fetch warnings:', error.response?.data || error.message)
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch warnings'
      }
    }
  }

  // Get warning statistics (teacher only)
  async getWarningStats(): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      console.log('Fetching warning statistics')
      const response = await api.get('/warnings/stats')
      console.log('Warning stats response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to fetch warning stats:', error.response?.data || error.message)
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch warning stats'
      }
    }
  }

  // Check if student can re-enter exam
  async canReEnterExam(examId: string): Promise<{ success: boolean; canReEnter: boolean; message?: string }> {
    try {
      console.log(`Checking if can re-enter exam: ${examId}`)
      const response = await api.get(`/exams/${examId}/status`)
      console.log('Exam status response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Failed to check exam status:', error.response?.data || error.message)
      return {
        success: false,
        canReEnter: false,
        message: error.response?.data?.message || 'Failed to check exam status'
      }
    }
  }
}

export default new ExamApi()
