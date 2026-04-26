import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api'

interface Question {
  id: string
  question_text: string
  type: 'mcq' | 'written' | 'coding'
  options: string[]
  correct_answer: string
  points: number
}

interface Attempt {
  id: string
  exam_id: string
  started_at: string
  status: string
  time_remaining?: number
  duration_minutes: number
}

interface Exam {
  id: string
  title: string
  description: string
  duration_minutes: number
}

export default function DynamicExamRoom() {
  const { id: examId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [error, setError] = useState('')

  // Initialize exam
  const initializeExam = useCallback(async () => {
    try {
      setLoading(true)
      
      // Start exam attempt
      const attemptResponse = await api.post(`/exams/${examId}/start`)
      const newAttempt = attemptResponse.data as Attempt
      setAttempt(newAttempt)

      // Calculate time remaining
      const startTime = new Date(newAttempt.started_at)
      const durationMs = newAttempt.duration_minutes * 60 * 1000
      const elapsedMs = Date.now() - startTime.getTime()
      const remainingMs = Math.max(0, durationMs - elapsedMs)
      setTimeRemaining(Math.floor(remainingMs / 1000))

      // Get exam details
      const [examResponse, questionsResponse] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get(`/exams/${examId}/questions`)
      ])
      
      setExam(examResponse.data as Exam)
      setQuestions(questionsResponse.data as Question[])
    } catch (error: unknown) {
      console.error('ERROR:', error)
      console.error('ERROR RESPONSE DATA:', (error as { response?: { data?: unknown } }).response?.data)
      const errorData = (error as { response?: { data?: { error?: string; reason?: string; message?: string } } }).response?.data
      
      if (errorData?.error === 'FORBIDDEN') {
        // Show user-friendly messages based on specific reason
        switch (errorData.reason) {
          case 'EXAM_NOT_PUBLISHED':
            setError('This exam has not been published yet. Please contact your teacher.')
            break
          case 'EXAM_NOT_ACTIVE':
            setError('This exam is not currently active. Please check the exam schedule.')
            break
          case 'EXAM_NOT_STARTED':
            setError('This exam has not started yet. Please try again at the scheduled time.')
            break
          case 'EXAM_ENDED':
            setError('This exam has already ended. The exam period is over.')
            break
          default:
            setError(`Access denied: ${errorData.reason || 'Unknown reason'}`)
        }
      } else {
        setError(errorData?.message || errorData?.reason || 'Failed to start exam')
      }
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    if (examId) {
      initializeExam()
    }
  }, [examId, initializeExam])

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const submitAnswer = useCallback(async (questionId: string) => {
    if (!attempt || !answers[questionId]) return

    try {
      await api.post(`/attempts/${attempt.id}/answers`, {
        question_id: questionId,
        answer: answers[questionId]
      })
    } catch (error: unknown) {
      console.error('Failed to submit answer:', error)
    }
  }, [attempt, answers])

  const handleSubmitExam = useCallback(async () => {
    if (!attempt || submitting) return

    try {
      setSubmitting(true)
      
      // Submit all remaining answers
      for (const [questionId] of Object.entries(answers)) {
        await submitAnswer(questionId)
      }

      // Submit exam
      await api.post(`/attempts/${attempt.id}/submit`)
      
      navigate('/student/results')
    } catch (error: unknown) {
      setError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to submit exam')
    } finally {
      setSubmitting(false)
    }
  }, [attempt, submitting, answers, navigate, submitAnswer])

  // Timer countdown
  useEffect(() => {
    if (timeRemaining > 0 && attempt?.status === 'in_progress') {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmitExam()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [timeRemaining, attempt?.status, handleSubmitExam])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const renderQuestion = (question: Question, _index: number) => {
    const currentAnswer = answers[question.id] || ''

    switch (question.type) {
      case 'mcq':
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option}
                    checked={currentAnswer === option}
                    onChange={(e) => {
                      handleAnswerChange(question.id, e.target.value)
                      submitAnswer(question.id)
                    }}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        )

      case 'written':
        return (
          <div>
            <textarea
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              onBlur={() => submitAnswer(question.id)}
              placeholder="Write your answer here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
            />
            <p className="text-sm text-gray-500 mt-2">
              Your answer will be marked as &quot;pending&quot; for manual grading
            </p>
          </div>
        )

      case 'coding':
        return (
          <div>
            <div className="mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Write your code solution below</span>
              </div>
            </div>
            <textarea
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              onBlur={() => submitAnswer(question.id)}
              placeholder="// Write your solution here..."
              className="w-full px-4 py-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50"
              rows={12}
            />
            <div className="mt-2 text-sm text-gray-500">
              Basic validation will be performed. Make sure your code is complete and runnable.
            </div>
          </div>
        )

      default:
        return <div className="text-gray-500">Unknown question type</div>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Starting exam...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!exam || !attempt) {
    return <div>Loading...</div>
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = Object.keys(answers).length
  const totalQuestions = questions.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`text-lg font-mono ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                {formatTime(timeRemaining)}
              </div>
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-sm text-gray-600">{progress}/{totalQuestions} answered</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Question Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((question, index) => (
                  <button
                    key={question.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`p-2 rounded text-sm font-medium transition-colors ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : answers[question.id]
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                {/* Question Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      currentQuestion.type === 'mcq' ? 'bg-purple-100 text-purple-800' :
                      currentQuestion.type === 'written' ? 'bg-orange-100 text-orange-800' :
                      'bg-indigo-100 text-indigo-800'
                    }`}>
                      {currentQuestion.type.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">
                      {currentQuestion.points} points
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    {currentQuestion.question_text}
                  </h2>
                </div>

                {/* Answer Options */}
                <div className="mb-6">
                  {renderQuestion(currentQuestion, currentQuestionIndex)}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
