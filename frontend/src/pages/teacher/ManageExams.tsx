import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  startTime?: string
  endTime?: string
  start_time?: string
  end_time?: string
  scheduledAt?: string
  status: string
  createdAt: string
  courseId?: string
  courseName?: string
  questionCount?: number
  attemptCount?: number
}

export default function ManageExams() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    fetchExams()
  }, []) // Only fetch once on mount

  const fetchExams = async () => {
    // Prevent duplicate calls
    if (isFetching) {
      console.log('Already fetching exams, skipping...')
      return
    }

    setIsFetching(true)
    try {
      console.log('Fetching exams...')
      const response = await api.get('/teacher/exams')
      const examsData = Array.isArray(response.data) ? response.data : response.data?.data || []
      setExams(examsData)
    } catch (error) {
      console.error('Failed to fetch exams:', error)
      setExams([])
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Manage Exams</h1>
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
                <h3 className="text-lg leading-6 font-medium text-gray-900">Your Exams</h3>
                <Link
                  to="/teacher/create-exam"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create New Exam
                </Link>
              </div>
              <div className="space-y-4">
                {exams.map((exam) => (
                  <div key={exam.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{exam.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{exam.description || 'No description'}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-sm text-gray-500">
                            {exam.courseName || 'Unknown Course'}
                          </span>
                          <span className="text-sm text-gray-500">
                            Duration: {exam.durationMinutes || 0} min
                          </span>
                          <span className="text-sm text-gray-500">
                            Questions: {exam.questionCount || 0}
                          </span>
                          <span className="text-sm text-gray-500">
                            Attempts: {exam.attemptCount || 0}
                          </span>
                          <span className="text-sm text-gray-500">
                            Start: {exam.startTime ? new Date(exam.startTime).toLocaleDateString() : 'Not set'}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            exam.status === 'published' ? 'bg-green-100 text-green-800' :
                            exam.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                            exam.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                            exam.status === 'completed' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {exam.status}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/teacher/exam/${exam.id}/questions`}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Manage Questions
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
