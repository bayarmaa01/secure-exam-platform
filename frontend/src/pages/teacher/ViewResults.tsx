import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

interface Exam {
  id: string
  title: string
  description: string
  courseName: string
  durationMinutes: number
  startTime: string
  endTime: string
  status: string
  questionCount?: number
  attemptCount?: number
  latestSubmissionTime?: string
}

export default function ViewResults() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompletedExams()
  }, [])

  const fetchCompletedExams = async () => {
    try {
      const response = await api.get('/teacher/exams').catch(err => {
        console.error('Exams API error:', err)
        return { data: [] }
      })
      const examsData = Array.isArray(response.data) ? response.data : response.data?.data || []
      // Backend now properly filters to show only exams with attempts
      // No frontend filtering needed - show all exams returned by API
      setExams(examsData)
    } catch (error) {
      console.error('Failed to fetch completed exams:', error)
      setExams([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Exam Results</h1>
              <p className="text-sm text-gray-600">View available exams and student performance</p>
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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Available Exams ({exams.length})
                </h3>
              </div>
              
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading available exams...</p>
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h12a2 2 0 012-2v-6a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No available exams</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Exams will appear here once they are published or completed.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exams.map((exam) => (
                    <div key={exam.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-lg font-medium text-gray-900">{exam.title}</h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              exam.status === 'graded' ? 'bg-green-100 text-green-800' :
                              exam.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
                              exam.status === 'terminated' ? 'bg-red-100 text-red-800' :
                              exam.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {exam.status === 'pending_review' ? 'Pending Review' :
                               exam.status === 'graded' ? 'Graded' :
                               exam.status === 'terminated' ? 'Terminated' :
                               exam.status === 'submitted' ? 'Submitted' :
                               exam.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{exam.description || 'No description'}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>{exam.courseName || 'Unknown Course'}</span>
                            <span>Duration: {exam.durationMinutes} min</span>
                            <span>Questions: {exam.questionCount || 0}</span>
                            <span>Attempts: {exam.attemptCount || 0}</span>
                            <span>Latest Submission: {exam.latestSubmissionTime ? new Date(exam.latestSubmissionTime).toLocaleDateString() : 'Not submitted'}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <Link
                            to={`/teacher/exam-results/${exam.id}`}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            View Results
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
