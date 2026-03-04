import api from './client'

export interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  scheduledAt: string
  status: 'draft' | 'published' | 'ended'
}

export interface Question {
  id: string
  text: string
  options: string[]
  type: 'mcq' | 'boolean'
}

export const examsApi = {
  list: () => api.get<Exam[]>('/exams'),
  get: (id: string) => api.get<Exam>(`/exams/${id}`),
  getQuestions: (id: string) => api.get<Question[]>(`/exams/${id}/questions`),
  start: (id: string) => api.post<{ attemptId: string }>(`/exams/${id}/start`),
  submitAnswer: (attemptId: string, questionId: string, answer: string | string[]) =>
    api.post(`/exams/attempts/${attemptId}/answers`, { questionId, answer }),
  submitExam: (attemptId: string) => api.post(`/exams/attempts/${attemptId}/submit`),
  getAttempt: (attemptId: string) => api.get(`/exams/attempts/${attemptId}`)
}
