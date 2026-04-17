import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ExamApi from '../../services/examApi'

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

export default function ResultsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    fetchResults()
  }, [user, navigate])

  const fetchResults = async () => {
    try {
      setLoading(true)
      setError('')
      
      const result = await ExamApi.getStudentResults()
      
      if (result.success && result.data) {
        setResults(result.data)
      } else {
        setError(result.message || 'Failed to fetch results')
      }
    } catch (error: unknown) {
      console.error('Error fetching results:', error)
      setError('Failed to load results. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      case 'completed':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'passed':
        return '✅ Passed'
      case 'failed':
        return '❌ Failed'
      case 'completed':
        return '✅ Completed'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 18 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            <button
              onClick={fetchResults}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:justify-between sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-bold text-gray-900">Your Results</h1>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={fetchResults}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              {/* Results Stats */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-gray-50 px-4 py-5 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Total Exams</div>
                  <div className="mt-2 text-3xl font-semibold text-gray-900">{results.length}</div>
                </div>
                <div className="bg-green-50 px-4 py-5 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Average Score</div>
                  <div className="mt-2 text-3xl font-semibold text-green-600">
                    {results.length > 0 
                      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
                      : 0}%
                  </div>
                </div>
                <div className="bg-blue-50 px-4 py-5 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Passed Exams</div>
                  <div className="mt-2 text-3xl font-semibold text-blue-600">
                    {results.filter(r => r.status === 'passed').length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="mt-8 flow-root">
            {results.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
                <p className="mt-1 text-sm text-gray-500">You haven&apos;t completed any exams yet.</p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {results.map((result) => (
                    <li key={result.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {result.examTitle || 'Exam'} Results
                            </p>
                            <p className="text-sm text-gray-500">
                              {result.courseName} • {new Date(result.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                              {getStatusText(result.status)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="text-sm text-gray-500">
                                Score: <span className="font-medium text-gray-900">{result.score}</span> / {result.totalPoints}
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                Percentage: <span className="font-medium text-gray-900">{result.percentage.toFixed(1)}%</span>
                              </p>
                            </div>
                            <div className="mt-2 sm:mt-0 sm:ml-6">
                              <button
                                onClick={() => navigate(`/results/${result.id}`)}
                                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
