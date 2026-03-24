import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'

interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  scheduledAt: string
  status: string
}

interface Attempt {
  id: string
  examTitle: string
  submittedAt: string
  cheatingScore: number | null
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [recentAttempts, setRecentAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [examsRes, attemptsRes] = await Promise.all([
        api.get('/exams'),
        api.get('/results/student')
      ])
      
      setExams(examsRes.data.slice(0, 3)) // Show only 3 recent exams
      setRecentAttempts(attemptsRes.data.slice(0, 3))
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name}</span>
              <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Student
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Link
              to="/dashboard"
              className="border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-blue-600"
            >
              Dashboard
            </Link>
            <Link
              to="/exams"
              className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Available Exams
            </Link>
            <Link
              to="/results"
              className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              My Results
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Available Exams</dt>
                      <dd className="text-lg font-medium text-gray-900">{exams.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                      <dd className="text-lg font-medium text-gray-900">{recentAttempts.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg. Score</dt>
                      <dd className="text-lg font-medium text-gray-900">85%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Available Exams */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Available Exams</h3>
                  <Link
                    to="/exams"
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-4">
                  {exams.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No available exams</p>
                  ) : (
                    exams.map((exam) => (
                      <div key={exam.id} className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900">{exam.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{exam.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-sm text-gray-500">
                            {exam.durationMinutes} minutes
                          </span>
                          <Link
                            to={`/exam/${exam.id}`}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Start Exam
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recent Attempts */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Attempts</h3>
                  <Link
                    to="/results"
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-4">
                  {recentAttempts.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No recent attempts</p>
                  ) : (
                    recentAttempts.map((attempt) => (
                      <div key={attempt.id} className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900">{attempt.examTitle}</h4>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm text-gray-500">
                            {new Date(attempt.submittedAt).toLocaleDateString()}
                          </span>
                          {attempt.cheatingScore !== null && (
                            <span className={`text-sm px-2 py-1 rounded ${
                              attempt.cheatingScore < 0.3 
                                ? 'bg-green-100 text-green-800'
                                : attempt.cheatingScore < 0.7
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              Risk: {Math.round(attempt.cheatingScore * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
