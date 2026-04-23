import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'

interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  startTime: string
  endTime?: string
  status: string
  courseName: string
  questionCount: number
  scheduledAt?: string // for backward compatibility
  completed?: boolean // Track if student has completed this exam
  attemptId?: string // Track existing attempt ID
}

export default function ExamList() {
  const { user } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      const response = await api.get('/exams')
      setExams(response.data)
    } catch (error) {
      console.error('Failed to fetch exams:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredExams = exams.filter(exam => {
    if (filter === 'all') return true
    if (filter === 'available') return exam.status === 'published'
    return false
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exams...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Available Exams</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name}</span>
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Filter */}
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('available')}
                className={`px-3 py-1 text-sm rounded ${
                  filter === 'available'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Available
              </button>
            </div>
          </div>

          {/* Exams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No exams found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filter === 'available' ? 'No available exams at the moment.' : 'No exams match your filter.'}
                  </p>
                </div>
              </div>
            ) : (
              filteredExams.map((exam) => (
                <div key={exam.id} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        {exam.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {exam.durationMinutes} min • {exam.questionCount} questions
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{exam.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{exam.description}</p>
                    <p className="text-sm text-gray-500 mb-4">
                      <strong>Course:</strong> {exam.courseName}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(exam.startTime || exam.scheduledAt || '').toLocaleDateString()} at {new Date(exam.startTime || exam.scheduledAt || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      {exam.completed ? (
                        <span className="px-3 py-1 bg-gray-400 text-white text-sm rounded cursor-not-allowed">
                          Completed
                        </span>
                      ) : (
                        <Link
                          to={`/exam/${exam.id}`}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Start Exam
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
