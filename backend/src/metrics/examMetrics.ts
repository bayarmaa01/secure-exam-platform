import { register, Counter, Histogram, Gauge } from 'prom-client'

// Define metrics for live exam system
export const activeExamSessions = new Gauge({
  name: 'exam_active_sessions',
  help: 'Number of active exam sessions',
  labelNames: ['exam_id', 'course_id']
})

export const examStartedTotal = new Counter({
  name: 'exam_started_total',
  help: 'Total number of exams started',
  labelNames: ['exam_id', 'course_id', 'user_id']
})

export const examSubmittedTotal = new Counter({
  name: 'exam_submitted_total',
  help: 'Total number of exams submitted',
  labelNames: ['exam_id', 'course_id', 'user_id']
})

export const examForceSubmittedTotal = new Counter({
  name: 'exam_force_submitted_total',
  help: 'Total number of exams force submitted by teachers',
  labelNames: ['exam_id', 'course_id', 'teacher_id']
})

export const examViolationsTotal = new Counter({
  name: 'exam_violations_total',
  help: 'Total number of exam violations detected',
  labelNames: ['type', 'exam_id', 'course_id', 'user_id']
})

export const websocketConnections = new Gauge({
  name: 'websocket_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['type'] // student, teacher, admin
})

export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'user_role']
})

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['table', 'operation', 'user_role']
})

export const examSessionDuration = new Histogram({
  name: 'exam_session_duration_seconds',
  help: 'Duration of exam sessions in seconds',
  labelNames: ['exam_id', 'course_id', 'user_id']
})

export const violationRateByExam = new Gauge({
  name: 'exam_violation_rate',
  help: 'Rate of violations per exam',
  labelNames: ['exam_id', 'course_id']
})

// Helper functions to increment metrics with proper labels
export const incrementExamStarted = (examId: string, courseId: string, userId: string) => {
  examStartedTotal.inc({ exam_id: examId, course_id: courseId, user_id: userId })
}

export const incrementExamSubmitted = (examId: string, courseId: string, userId: string) => {
  examSubmittedTotal.inc({ exam_id: examId, course_id: courseId, user_id: userId })
}

export const incrementExamForceSubmitted = (examId: string, courseId: string, teacherId: string) => {
  examForceSubmittedTotal.inc({ exam_id: examId, course_id: courseId, teacher_id: teacherId })
}

export const incrementExamViolations = (type: string, examId: string, courseId: string, userId: string) => {
  examViolationsTotal.inc({ type, exam_id: examId, course_id: courseId, user_id: userId })
}

export const setActiveExamSessions = (count: number, examId?: string, courseId?: string) => {
  if (examId && courseId) {
    activeExamSessions.set({ exam_id: examId, course_id: courseId }, count)
  } else {
    activeExamSessions.set(count)
  }
}

export const setWebSocketConnections = (count: number, type: string) => {
  websocketConnections.set({ type }, count)
}

export const recordApiRequest = (method: string, route: string, statusCode: number, duration: number, userRole?: string) => {
  apiRequestDuration.observe({ 
    method, 
    route, 
    status_code: statusCode.toString(), 
    user_role: userRole || 'anonymous' 
  }, duration / 1000) // Convert to seconds
}

export const recordDbQuery = (table: string, operation: string, duration: number, userRole?: string) => {
  dbQueryDuration.observe({ 
    table, 
    operation, 
    user_role: userRole || 'anonymous' 
  }, duration / 1000) // Convert to seconds
}

export const recordExamSessionDuration = (examId: string, courseId: string, userId: string, duration: number) => {
  examSessionDuration.observe({ 
    exam_id: examId, 
    course_id: courseId, 
    user_id: userId 
  }, duration / 1000) // Convert to seconds
}

export const updateViolationRate = (examId: string, courseId: string, violationCount: number, totalSessions: number) => {
  const rate = totalSessions > 0 ? violationCount / totalSessions : 0
  violationRateByExam.set({ exam_id: examId, course_id: courseId }, rate)
}
