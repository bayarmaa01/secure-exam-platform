import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

interface Exam {
  id: string
  title: string
  courseId: string
  courseName: string
  type: string
  totalAttempts: number
  pendingCount: number
  gradedCount: number
  submittedCount: number
  latestSubmission: string
}

interface Student {
  id: string
  name: string
  email: string
  studentId: string
  attemptId: string
  status: string
  score: number | null
  submittedAt: string
  gradedAt: string | null
  feedback: string
  violations?: {
    count: number
    details: Array<{
      type: string
      time: string
      details?: string | object
    }>
    riskScore: number
    riskLevel: string
  }
}

interface Question {
  id: string
  question_text: string
  points: number
  type: string
  options?: string[] | Record<string, any>
  correct_answer?: string
}

interface Attempt {
  id: string
  answers: Record<string, string>
  score: number | null
  status: string
  submittedAt: string
  startedAt: string
  feedback: string
  totalPoints: number
  percentage: number | null
  exam: {
    title: string
    type: string
    totalMarks: number
    description: string
  }
  student: {
    name: string
    email: string
    studentId: string
  }
  questions: Question[]
}

export default function NewGradingDashboard() {
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      setLoading(true)
      const response = await api.get('/grading/exams')
      if (response.data.success) {
        setExams(response.data.exams)
      }
    } catch (error) {
      console.error('Failed to fetch exams:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async (examId: string) => {
    try {
      setLoading(true)
      const response = await api.get(`/grading/exams/${examId}/students`)
      if (response.data.success) {
        setStudents(response.data.students)
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttempt = async (attemptId: string) => {
    try {
      setLoading(true)
      const response = await api.get(`/grading/attempts/${attemptId}`)
      if (response.data.success) {
        setAttempt(response.data.attempt)
        setScore(response.data.attempt.score?.toString() || '')
        setFeedback(response.data.attempt.feedback || '')
      }
    } catch (error) {
      console.error('Failed to fetch attempt:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExamClick = (exam: Exam) => {
    setSelectedExam(exam)
    setSelectedStudent(null)
    setAttempt(null)
    fetchStudents(exam.id)
  }

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student)
    setAttempt(null)
    fetchAttempt(student.attemptId)
  }

  const handleSubmitGrade = async () => {
    if (!selectedStudent || !attempt) return

    try {
      setGrading(true)
      const response = await api.post(`/grading/attempts/${selectedStudent.attemptId}/grade`, {
        score: parseFloat(score),
        feedback,
        maxScore: attempt.exam.totalMarks
      })

      if (response.data.success) {
        // Update the student in the list
        setStudents(prev => prev.map(s => 
          s.attemptId === selectedStudent.attemptId 
            ? { ...s, score: response.data.attempt.score, status: 'graded', gradedAt: new Date().toISOString() }
            : s
        ))
        
        // Update the attempt
        setAttempt(prev => prev ? { ...prev, ...response.data.attempt } : null)
        
        alert('Grade submitted successfully!')
      }
    } catch (error) {
      console.error('Failed to submit grade:', error)
      alert('Failed to submit grade')
    } finally {
      setGrading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review': return 'text-yellow-600 bg-yellow-100'
      case 'graded': return 'text-green-600 bg-green-100'
      case 'submitted': return 'text-blue-600 bg-blue-100'
      case 'terminated': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_review': return 'Pending Review'
      case 'graded': return 'Graded'
      case 'submitted': return 'Submitted'
      case 'terminated': return 'Terminated'
      default: return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Grading Dashboard</h1>
              <p className="text-sm text-gray-600">Review and grade student submissions</p>
            </div>
            <Link
              to="/teacher/dashboard"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-120px)]">
          {/* LEFT PANEL - Exams List */}
          <div className="col-span-4 bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-900">Exams</h2>
              <p className="text-sm text-gray-600">Click to view students</p>
            </div>
            <div className="overflow-y-auto h-[calc(100%-60px)]">
              {loading && exams.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : exams.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No exams with attempts found
                </div>
              ) : (
                <div className="divide-y">
                  {exams.map((exam) => (
                    <div
                      key={exam.id}
                      onClick={() => handleExamClick(exam)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedExam?.id === exam.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{exam.title}</div>
                      <div className="text-sm text-gray-600">{exam.courseName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{exam.type}</span>
                        <span className="text-xs text-gray-500">
                          {exam.totalAttempts} students
                        </span>
                      </div>
                      {exam.pendingCount > 0 && (
                        <div className="mt-2">
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            {exam.pendingCount} pending review
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE PANEL - Students */}
          <div className="col-span-4 bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-900">Students</h2>
              <p className="text-sm text-gray-600">
                {selectedExam ? selectedExam.title : 'Select an exam to view students'}
              </p>
            </div>
            <div className="overflow-y-auto h-[calc(100%-60px)]">
              {!selectedExam ? (
                <div className="p-4 text-center text-gray-500">
                  Select an exam to view students
                </div>
              ) : loading && students.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : students.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No students found for this exam
                </div>
              ) : (
                <div className="divide-y">
                  {students.map((student) => (
                    <div
                      key={student.attemptId}
                      onClick={() => handleStudentClick(student)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedStudent?.attemptId === student.attemptId ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{student.name}</div>
                      <div className="text-sm text-gray-600">{student.email}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(student.status)}`}>
                          {getStatusText(student.status)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(student.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {student.score !== null && (
                        <div className="mt-1">
                          <span className="text-sm font-medium">Score: {student.score}</span>
                        </div>
                      )}
                      {student.violations && student.violations.count > 0 && (
                        <div className="mt-2 flex items-center space-x-2">
                          <span className="text-xs text-red-600 font-medium">
                            ⚠️ {student.violations.count} warnings
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            student.violations.riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                            student.violations.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            Risk: {student.violations.riskLevel}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL - Grading */}
          <div className="col-span-4 bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-900">Grading</h2>
              <p className="text-sm text-gray-600">
                {selectedStudent ? selectedStudent.name : 'Select a student to grade'}
              </p>
            </div>
            <div className="overflow-y-auto h-[calc(100%-60px)]">
              {!selectedStudent ? (
                <div className="p-4 text-center text-gray-500">
                  Select a student to view and grade their submission
                </div>
              ) : loading && !attempt ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : !attempt ? (
                <div className="p-4 text-center text-gray-500">
                  Failed to load attempt details
                </div>
              ) : (
                <div className="p-4">
                  {/* Exam Info */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900">{attempt.exam.title}</h3>
                    <p className="text-sm text-gray-600">{attempt.exam.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>Type: {attempt.exam.type}</span>
                      <span>Total Marks: {attempt.exam.totalMarks}</span>
                    </div>
                  </div>

                  {/* Student Info */}
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <div className="font-medium">{attempt.student.name}</div>
                    <div className="text-sm text-gray-600">{attempt.student.email}</div>
                    <div className="text-sm text-gray-500">
                      Submitted: {new Date(attempt.submittedAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Proctoring Activity */}
                  {selectedStudent.violations && selectedStudent.violations.count > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                      <h4 className="font-medium text-red-900 mb-2">Proctoring Activity</h4>
                      <div className="text-sm text-red-800 mb-2">
                        Total Violations: {selectedStudent.violations.count}
                      </div>
                      <div className="space-y-1">
                        {selectedStudent.violations.details.map((violation, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{violation.type}</span>
                            <span className="text-gray-600">
                              {new Date(violation.time).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions and Answers */}
                  <div className="space-y-4 mb-6">
                    {attempt.questions.map((question, index) => {
                      const answer = attempt.answers?.[question.id] || ''
                      return (
                        <div key={question.id} className="border rounded p-3">
                          <div className="font-medium text-gray-900 mb-2">
                            Q{index + 1}: {question.question_text}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            Points: {question.points}
                          </div>
                          <div className="bg-gray-50 p-2 rounded text-sm">
                            <strong>Student Answer:</strong>
                            <div className="mt-1">
                              {typeof answer === 'string' ? answer : JSON.stringify(answer)}
                            </div>
                          </div>
                          {question.type === 'mcq' && question.options && (
                            <div className="mt-2 text-xs text-gray-500">
                              <strong>Options:</strong> {JSON.stringify(question.options)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Grading Form */}
                  {selectedStudent.status !== 'graded' ? (
                    <div className="border-t pt-4">
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Score (out of {attempt.exam.totalMarks})
                        </label>
                        <input
                          type="number"
                          value={score}
                          onChange={(e) => setScore(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max={attempt.exam.totalMarks}
                          step="0.1"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Feedback
                        </label>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="Provide feedback for the student..."
                        />
                      </div>
                      <button
                        onClick={handleSubmitGrade}
                        disabled={grading || !score}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {grading ? 'Submitting...' : 'Submit Grade'}
                      </button>
                    </div>
                  ) : (
                    <div className="border-t pt-4">
                      <div className="bg-green-50 p-3 rounded">
                        <div className="font-medium text-green-800">Already Graded</div>
                        <div className="text-sm text-green-600">
                          Score: {attempt.score}/{attempt.exam.totalMarks}
                        </div>
                        {attempt.feedback && (
                          <div className="mt-2 text-sm">
                            <strong>Feedback:</strong> {attempt.feedback}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
