import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'

export default function AddQuestions() {
  const { id } = useParams<{ id: string }>()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchQuestions(id)
  }, [id])

  const fetchQuestions = async (examId: string) => {
    try {
      const response = await api.get(`/exams/${examId}/questions`)
      setQuestions(response.data)
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Manage Questions</h1>
            <Link
              to="/teacher/exams"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Exams
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
                <h3 className="text-lg font-medium mb-4">Questions</h3>
                <div className="space-y-4">
                  {questions.map((q: any) => (
                    <div key={q.id} className="border rounded p-4">
                      <p>{q.text}</p>
                      <p className="text-sm text-gray-500">Type: {q.type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
