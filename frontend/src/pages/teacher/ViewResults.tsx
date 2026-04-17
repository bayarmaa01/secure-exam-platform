import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

interface Result {
  id: string
  studentName: string
  studentEmail: string
  examTitle: string
  courseName: string
  score: number
  totalPoints: number
  percentage: number
  status: string
  submittedAt: string
}

export default function ViewResults() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    try {
      const response = await api.get('/teacher/results').catch(err => {
        console.error('Results API error:', err)
        return { data: { data: [] } }
      })
      const resultsData = response.data?.data || response.data || []
      setResults(Array.isArray(resultsData) ? resultsData as Result[] : [])
    } catch (error) {
      console.error('Failed to fetch results:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">View Results</h1>
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
          <div className="bg-white shadow rounded-lg p-6">
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div>
                <h3 className="text-lg font-medium mb-4">Student Results</h3>
                <div className="space-y-4">
                  {Array.isArray(results) && results.length > 0 ? (
                    results.map((result: Result) => (
                      <div key={result.id} className="border rounded p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-lg">{result.examTitle}</p>
                            <p className="text-sm text-gray-600">{result.courseName}</p>
                            <p className="text-sm text-gray-500">Student: {result.studentName}</p>
                            <p className="text-sm text-gray-500">Email: {result.studentEmail}</p>
                            <p className="text-sm text-gray-500">Submitted: {new Date(result.submittedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">{result.percentage.toFixed(1)}%</div>
                            <div className="text-sm text-gray-500">{result.score}/{result.totalPoints}</div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              result.status === 'passed' ? 'bg-green-100 text-green-800' :
                              result.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {result.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No results found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
