// Unified Exam System Types
// Standardized types for MCQ, Writing, Coding, and Mixed exams

export type ExamType = 'mcq' | 'writing' | 'coding' | 'mixed' | 'ai_proctored'

export type QuestionType = 'mcq' | 'short_answer' | 'long_answer' | 'coding'

export type ProgrammingLanguage = 'python' | 'java' | 'cpp' | 'javascript' | 'c'

export interface TestCase {
  input: string
  output: string
  description?: string
}

export interface StarterCode {
  python?: string
  java?: string
  cpp?: string
  javascript?: string
  c?: string
}

export interface Question {
  id: string
  question_text: string
  type: QuestionType
  options?: string[]
  correct_answer?: string
  points: number
  topic?: string
  difficulty: 'easy' | 'medium' | 'hard'
  explanation?: string
  language?: ProgrammingLanguage
  starter_code?: StarterCode
  test_cases?: TestCase[]
  created_at: string
}

export interface Exam {
  id: string
  title: string
  description?: string
  type: ExamType
  duration_minutes: number
  start_time: string
  end_time: string
  difficulty: 'easy' | 'medium' | 'hard'
  total_marks: number
  passing_marks: number
  is_published: boolean
  course_id?: string
  teacher_id?: string
  fullscreen_required: boolean
  tab_switch_detection: boolean
  copy_paste_blocked: boolean
  camera_required: boolean
  face_detection_enabled: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  assign_to_all: boolean
  assigned_groups: string[]
  status: 'draft' | 'published' | 'ongoing' | 'completed'
  questions?: Question[]
  created_at: string
  updated_at: string
}

export interface ExamFormData {
  title: string
  description?: string
  type: ExamType
  duration_minutes: number
  start_time: string
  end_time: string
  difficulty: 'easy' | 'medium' | 'hard'
  total_marks: number
  passing_marks: number
  is_published: boolean
  fullscreen_required: boolean
  tab_switch_detection: boolean
  copy_paste_blocked: boolean
  camera_required: boolean
  face_detection_enabled: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  assign_to_all: boolean
  assigned_groups: string[]
}

export interface QuestionFormData {
  question_text: string
  type: QuestionType
  options?: string[]
  correct_answer?: string
  points: number
  topic?: string
  difficulty: 'easy' | 'medium' | 'hard'
  explanation?: string
  language?: ProgrammingLanguage
  starter_code?: StarterCode
  test_cases?: TestCase[]
}

export interface ExamAttempt {
  id: string
  exam_id: string
  user_id: string
  answers: Record<string, string | string[]>
  started_at: string
  submitted_at?: string
  score?: number
  total_points: number
  percentage?: number
  status: 'in_progress' | 'submitted' | 'graded'
  proctoring_session_id?: string
  risk_score: number
  created_at: string
}

export interface Answer {
  id: string
  attempt_id: string
  question_id: string
  answer: string
  is_correct?: boolean
  points_earned: number
  time_taken?: number
  created_at: string
}

export interface ExamResult {
  id: string
  student_id: string
  exam_id: string
  attempt_id: string
  score: number
  total_points: number
  percentage: number
  status: 'completed' | 'failed' | 'passed'
  graded_at: string
  graded_by?: string
  feedback?: string
  created_at: string
}

// Helper functions for type validation
export function isMCQQuestion(question: Question): boolean {
  return question.type === 'mcq'
}

export function isWritingQuestion(question: Question): boolean {
  return question.type === 'short_answer' || question.type === 'long_answer'
}

export function isCodingQuestion(question: Question): boolean {
  return question.type === 'coding'
}

export function isMixedExam(exam: Exam): boolean {
  return exam.type === 'mixed'
}

export function isWritingExam(exam: Exam): boolean {
  return exam.type === 'writing'
}

export function isCodingExam(exam: Exam): boolean {
  return exam.type === 'coding'
}

export function isMCQExam(exam: Exam): boolean {
  return exam.type === 'mcq'
}

export function getAllowedQuestionTypes(examType: ExamType): QuestionType[] {
  switch (examType) {
    case 'mcq':
      return ['mcq']
    case 'writing':
      return ['short_answer', 'long_answer']
    case 'coding':
      return ['coding']
    case 'mixed':
    case 'ai_proctored':
      return ['mcq', 'short_answer', 'long_answer', 'coding']
    default:
      return ['mcq']
  }
}
