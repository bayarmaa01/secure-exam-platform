import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'

// Safe date formatting function
const formatDate = (date: string | null | undefined) => {
  if (!date) return "Not available"
  const d = new Date(date)
  return isNaN(d.getTime()) ? "Invalid date" : d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

interface PendingAttempt {
  attempt_id: string
  exam_id: string
  student_id: string
  student_name: string
  student_email: string
  student_roll_number: string
  exam_title: string
  exam_type: string
  submitted_at: string
  answers: any
  total_marks: number
  passing_marks: number
}

interface AttemptDetail {
  attempt_id: string
  exam_id: string
  student_id: string
  student_name: string
  student_email: string
  student_roll_number: string
  exam_title: string
  exam_type: string
  exam_description: string
  submitted_at: string
  started_at: string
  answers: any
  total_marks: number
  passing_marks: number
  questions: Array<{
    id: string
    question_text: string
    points: number
    question_type: string
  }>
}

export default function GradingDashboard() {
  const { user } = useAuth()
  const [pendingAttempts, setPendingAttempts] = useState<PendingAttempt[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'pending' | 'graded'>('pending')

  // Fetch pending grading attempts
  const fetchPendingAttempts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/grading/pending')
      console.log('[GRADING] Pending attempts:', response.data)
      setPendingAttempts(response.data.pendingAttempts || [])
    } catch (error) {
      console.error('[GRADING] Error fetching pending attempts:', error)
      setError('Failed to fetch pending attempts')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch attempt details for grading
  const fetchAttemptDetails = useCallback(async (attemptId: string) => {
    try {
      setLoading(true)
      const response = await api.get(`/grading/attempts/${attemptId}`)
      console.log('[GRADING] Attempt details:', response.data)
      setSelectedAttempt(response.data.attempt)
      // Reset form
      setScore('')
      setFeedback('')
      setError('')
      setSuccess('')
    } catch (error) {
      console.error('[GRADING] Error fetching attempt details:', error)
      setError('Failed to fetch attempt details')
    } finally {
      setLoading(false)
    }
  }, [])

  // Submit grade
  const submitGrade = useCallback(async () => {
    if (!selectedAttempt || !score) {
      setError('Please provide a score')
      return
    }

    const scoreNum = parseFloat(score)
    if (isNaN(scoreNum) || scoreNum < 0) {
      setError('Please provide a valid score')
      return
    }

    if (scoreNum > selectedAttempt.total_marks) {
      setError(`Score cannot exceed total marks (${selectedAttempt.total_marks})`)
      return
    }

    try {
      setGrading(true)
      const response = await api.post(`/grading/attempts/${selectedAttempt.attempt_id}/grade`, {
        score: scoreNum,
        feedback: feedback.trim(),
        maxScore: selectedAttempt.total_marks
      })
      
      console.log('[GRADING] Grade submitted:', response.data)
      setSuccess('Attempt graded successfully!')
      
      // Refresh pending attempts
      await fetchPendingAttempts()
      
      // Clear selection after a delay
      setTimeout(() => {
        setSelectedAttempt(null)
        setSuccess('')
      }, 2000)
      
    } catch (error) {
      console.error('[GRADING] Error submitting grade:', error)
      setError('Failed to submit grade')
    } finally {
      setGrading(false)
    }
  }, [selectedAttempt, score, feedback, fetchPendingAttempts])

  useEffect(() => {
    fetchPendingAttempts()
  }, [fetchPendingAttempts])

  const formatAnswers = (answers: any) => {
    if (!answers) return 'No answers provided'
    
    if (typeof answers === 'string') {
      try {
        return JSON.stringify(JSON.parse(answers), null, 2)
      } catch {
        return answers
      }
    }
    
    return JSON.stringify(answers, null, 2)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Grading Dashboard</h1>
        <div className="text-sm text-gray-600">
          {user?.name} • Teacher
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Attempts List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            Pending Review ({pendingAttempts.length})
          </h2>
          
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : pendingAttempts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending attempts to grade
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAttempts.map((attempt) => (
                <div
                  key={attempt.attempt_id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => fetchAttemptDetails(attempt.attempt_id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">
                        {attempt.exam_title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {attempt.exam_type?.toUpperCase()} • {attempt.total_marks} marks
                      </p>
                      <p className="text-sm text-gray-600">
                        {attempt.student_name} ({attempt.student_roll_number})
                      </p>
                      <p className="text-xs text-gray-500">
                        Submitted: {formatDate(attempt.submitted_at)}
                      </p>
                    </div>
                    <div className="ml-4">
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        Pending Review
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grading Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            Grade Attempt
          </h2>
          
          {!selectedAttempt ? (
            <div className="text-center py-8 text-gray-500">
              Select an attempt from the left to start grading
            </div>
          ) : (
            <div className="space-y-4">
              {/* Attempt Info */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg">{selectedAttempt.exam_title}</h3>
                <p className="text-sm text-gray-600">
                  {selectedAttempt.exam_type?.toUpperCase()} • {selectedAttempt.total_marks} marks total
                </p>
                <p className="text-sm text-gray-600">
                  Passing: {selectedAttempt.passing_marks} marks
                </p>
                <p className="text-sm text-gray-600">
                  Student: {selectedAttempt.student_name} ({selectedAttempt.student_roll_number})
                </p>
                <p className="text-sm text-gray-600">
                  Email: {selectedAttempt.student_email}
                </p>
                <p className="text-sm text-gray-600">
                  Submitted: {formatDate(selectedAttempt.submitted_at)}
                </p>
              </div>

              {/* Questions */}
              <div className="border-b pb-4">
                <h4 className="font-semibold mb-2">Questions ({selectedAttempt.questions?.length || 0})</h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {selectedAttempt.questions?.map((question, index) => (
                    <div key={question.id} className="text-sm">
                      <span className="font-medium">Q{index + 1}:</span> {question.question_text}
                      <span className="text-gray-500 ml-2">({question.points} marks)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Answers */}
              <div className="border-b pb-4">
                <h4 className="font-semibold mb-2">Student Answers</h4>
                <div className="bg-gray-50 p-3 rounded max-h-48 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap">
                    {formatAnswers(selectedAttempt.answers)}
                  </pre>
                </div>
              </div>

              {/* Grading Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Score (0-{selectedAttempt.total_marks})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={selectedAttempt.total_marks}
                    step="0.5"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter score"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feedback (optional)
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Provide feedback for the student..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={submitGrade}
                    disabled={grading || !score}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {grading ? 'Submitting...' : 'Submit Grade'}
                  </button>
                  <button
                    onClick={() => setSelectedAttempt(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
