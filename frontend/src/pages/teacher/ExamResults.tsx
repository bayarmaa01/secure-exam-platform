import React, { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'

interface Violation {
  type: string
  time: string
  details?: string | object
}

interface ViolationData {
  count: number
  details: Violation[]
  riskScore: number
  riskLevel: string
}

interface ExamResult {
  id: string
  score: number | null
  totalPoints: number
  percentage: number | null
  status: string
  attemptStatus: string
  createdAt: string
  submittedAt?: string
  student: {
    name: string
    email: string
    rollNumber: string
  }
  violations?: ViolationData
  gradedAt?: string
  feedback?: string
  violationsCount?: number
  exam?: {
    type: string
    title: string
  }
}

interface Exam {
  id: string
  title: string
  description: string
  courseName: string
  durationMinutes: number
  startTime: string
  endTime: string
  status: string
}

export default function ExamResults() {
  const { examId } = useParams<{ examId: string }>()
  const [exam, setExam] = useState<Exam | null>(null)
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set())

  const toggleViolations = (studentId: string) => {
    const newExpanded = new Set(expandedViolations)
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId)
    } else {
      newExpanded.add(studentId)
    }
    setExpandedViolations(newExpanded)
  }

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'bg-red-100 text-red-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'LOW': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const fetchExamData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch exam details
      const examResponse = await api.get(`/exams/${examId}`).catch(err => {
        console.error('Exam API error:', err)
        return { data: null }
      })
      
      // Fetch exam results
      const resultsResponse = await api.get(`/results/teacher/exam/${examId}`).catch(err => {
        console.error('Results API error:', err)
        return { data: [] }
      })
      
      const examData = examResponse.data
      // Backend returns { success: true, results: [...] } structure
      const resultsData = resultsResponse.data?.results || resultsResponse.data || []
      
      console.log('[DEBUG] Backend response structure:', resultsResponse.data)
      console.log('[DEBUG] Mapped resultsData:', resultsData)
      
      setExam(examData)
      setExamResults(resultsData)
    } catch (error) {
      console.error('Failed to fetch exam data:', error)
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    if (examId) {
      fetchExamData()
    }
  }, [examId, fetchExamData])

  // Process exam results from backend
  console.log('[DEBUG] Raw exam results from backend:', examResults)
  
  // Backend returns results for students who attempted the exam
  // Convert to display format
  const studentsWithResults = examResults.map(result => ({
    id: result.student.email, // Use email as unique identifier
    name: result.student.name,
    email: result.student.email,
    registration_number: result.student.rollNumber,
    score: result.score,
    totalPoints: result.totalPoints || 0,
    percentage: result.percentage,
    status: result.status,
    submittedAt: result.submittedAt,
    violationsCount: result.violations?.count || 0,
    violations: result.violations || {
      count: 0,
      details: [],
      riskScore: 0,
      riskLevel: 'LOW'
    }
  }))

  console.log('[DEBUG] Students with results:', studentsWithResults)
  
  const attendedStudents = studentsWithResults.filter(s => s.submittedAt !== null && s.submittedAt !== undefined)
  const notAttendedStudents = studentsWithResults.filter(s => s.submittedAt === null || s.submittedAt === undefined)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exam results...</p>
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Exam not found</h2>
            <Link
              to="/teacher/results"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600">{exam.courseName}</p>
            </div>
            <Link
              to="/teacher/results"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Exam Info */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Duration</p>
                <p className="text-lg font-semibold">{exam.durationMinutes} minutes</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Start Time</p>
                <p className="text-lg font-semibold">{new Date(exam.startTime).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">End Time</p>
                <p className="text-lg font-semibold">{new Date(exam.endTime).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  exam.status === 'completed' ? 'bg-green-100 text-green-800' :
                  exam.status === 'published' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {exam.status}
                </span>
              </div>
            </div>
          </div>

          {/* Students Results */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Student Results</h3>
                <div className="flex space-x-4">
                  <span className="text-sm text-gray-600">
                    Total: {studentsWithResults.length}
                  </span>
                  <span className="text-sm text-green-600">
                    Attended: {attendedStudents.length}
                  </span>
                  <span className="text-sm text-red-600">
                    Not Attended: {notAttendedStudents.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Violations & Risk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentsWithResults.map((student) => (
                    <React.Fragment key={student.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {student.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {student.registration_number || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student.score !== null ? `${student.score}/${student.totalPoints}` : 'Pending Review'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${
                            student.percentage !== null && student.percentage >= 50 ? 'text-green-600' : 
                            student.percentage !== null && student.percentage < 50 ? 'text-red-600' :
                            'text-yellow-600'
                          }`}>
                            {student.percentage !== null ? `${student.percentage.toFixed(1)}%` : 'Pending'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            student.status === 'passed' ? 'bg-green-100 text-green-800' :
                            student.status === 'failed' ? 'bg-red-100 text-red-800' :
                            student.status === 'graded' ? 'bg-blue-100 text-blue-800' :
                            student.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
                            student.status === 'terminated' ? 'bg-red-100 text-red-800' :
                            student.status === 'not_attended' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {student.status === 'not_attended' ? 'Not Attended' : 
                             student.status === 'pending_review' ? 'Pending Review' :
                             student.status === 'graded' ? 'Graded' :
                             student.status === 'terminated' ? 'Terminated' :
                             student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${
                                (student.violations?.count || 0) >= 3 ? 'bg-red-100 text-red-800' :
                                (student.violations?.count || 0) > 0 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                ⚠️ {student.violations?.count || 0}
                              </span>
                              {student.violations?.riskLevel && (
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getRiskLevelColor(student.violations.riskLevel)}`}>
                                  {student.violations.riskLevel}
                                </span>
                              )}
                            </div>
                            {(student.violations?.count || 0) > 0 && (
                              <button
                                onClick={() => toggleViolations(student.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                {expandedViolations.has(student.id) ? 'Hide' : 'View'} Details
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.submittedAt ? new Date(student.submittedAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.status === 'pending_review' && (
                            <Link
                              to={`/teacher/grading?attempt=${student.id}`}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              Grade
                            </Link>
                          )}
                          {student.status === 'graded' && (
                            <span className="text-green-600 font-medium">
                              Graded
                            </span>
                          )}
                          {student.status === 'terminated' && (
                            <span className="text-red-600 font-medium">
                              Terminated
                            </span>
                          )}
                        </td>
                      </tr>
                      {expandedViolations.has(student.id) && student.violations && student.violations.count > 0 && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-gray-900">Proctoring Violations</h4>
                              <div className="bg-white border rounded p-3">
                                <div className="mb-2">
                                  <span className="text-sm font-medium">Total Violations: {student.violations.count}</span>
                                  <span className="ml-4 text-sm font-medium">Risk Score: {student.violations.riskScore}</span>
                                </div>
                                <div className="space-y-1">
                                  {student.violations.details.map((violation: Violation, index: number) => (
                                    <div key={index} className="flex items-center justify-between text-sm">
                                      <span className="font-medium text-gray-700">{violation.type}</span>
                                      <span className="text-gray-500">
                                        {new Date(violation.time).toLocaleTimeString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {studentsWithResults.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <div className="text-lg font-medium mb-2">No students attempted yet</div>
                          <div className="text-sm">
                            {exam.status === 'draft' 
                              ? 'Publish the exam to allow students to take it'
                              : 'Students have not started this exam yet'
                            }
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
