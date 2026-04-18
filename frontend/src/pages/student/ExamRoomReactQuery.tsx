import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../api'

interface Question {
  id: string
  text: string
  options: string[]
  type: 'mcq' | 'text'
  points: number
}

interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  scheduledAt: string
  status: string
}

// React Query version - BONUS: Migration to React Query for better caching and deduplication
export default function ExamRoomReactQuery() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [cheatingWarnings, setCheatingWarnings] = useState(0)
  const [examEndTime, setExamEndTime] = useState<Date | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<number | null>(null)
  const isMounted = useRef(true)

  // React Query for exam data - automatic caching and deduplication
  const {
    data: exam,
    isLoading: examLoading,
    error: examError,
    refetch: refetchExam
  } = useQuery({
    queryKey: ['exam', id],
    queryFn: async () => {
      console.log('DEBUG: React Query - Fetching exam data for ID:', id)
      const response = await api.get(`/exams/${id}`)
      return response.data
    },
    enabled: !!id,
    retry: (failureCount, error) => {
      // Don't retry on 404 errors
      if (error?.response?.status === 404) return false
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })

  // React Query mutation for starting exam attempt
  const startAttemptMutation = useMutation({
    mutationFn: async (examId: string) => {
      console.log('DEBUG: React Query - Starting exam attempt for:', examId)
      const response = await api.post(`/attempts/start`, { examId })
      return response.data
    },
    onSuccess: (data, examId) => {
      console.log('DEBUG: React Query - Attempt started successfully:', data.attemptId)
      setTimeLeft(exam?.durationMinutes * 60 || 0)
      setExamEndTime(new Date(exam?.endTime || Date.now() + 60 * 60 * 1000))
    },
    onError: (error) => {
      console.error('DEBUG: React Query - Failed to start attempt:', error)
    },
  })

  // Submit exam mutation
  const submitExamMutation = useMutation({
    mutationFn: async ({ attemptId, answers, warnings }: {
      attemptId: string
      answers: Record<string, string | string[]>
      warnings: number
    }) => {
      console.log('DEBUG: React Query - Submitting exam:', attemptId)
      const response = await api.post(`/exams/attempts/${attemptId}/submit`, {
        answers,
        cheatingWarnings: warnings
      })
      return response.data
    },
    onSuccess: (data, variables) => {
      console.log('DEBUG: React Query - Exam submitted successfully')
      navigate(`/results/${variables.attemptId}`)
    },
    onError: (error) => {
      console.error('DEBUG: React Query - Failed to submit exam:', error)
    },
  })

  // Combined loading state
  const isLoading = examLoading || startAttemptMutation.isPending

  // Error state
  const error = examError || startAttemptMutation.error

  // Load exam data and start attempt
  useEffect(() => {
    if (exam && !startAttemptMutation.data && !startAttemptMutation.isPending) {
      console.log('DEBUG: React Query - Exam loaded, starting attempt')
      startAttemptMutation.mutate(id!)
    }
  }, [exam, id, startAttemptMutation])

  // Set questions when exam data is available
  useEffect(() => {
    if (exam?.questions) {
      setQuestions(exam.questions)
    }
  }, [exam])

  const submitExam = useCallback(() => {
    if (!startAttemptMutation.data?.attemptId || submitExamMutation.isPending) return
    
    submitExamMutation.mutate({
      attemptId: startAttemptMutation.data.attemptId,
      answers,
      warnings: cheatingWarnings
    })
  }, [startAttemptMutation.data?.attemptId, answers, cheatingWarnings, submitExamMutation])

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Timer logic (same as before)
  useEffect(() => {
    if (timeLeft <= 0 || !isMounted.current) return
    
    timerRef.current = setTimeout(() => {
      if (isMounted.current) {
        setTimeLeft(prev => prev - 1)
      }
    }, 1000)
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [timeLeft])

  // Auto-submit when timer reaches zero
  useEffect(() => {
    if (timeLeft === 0 && startAttemptMutation.data?.attemptId && !submitExamMutation.isPending && isMounted.current) {
      console.log('DEBUG: Timer reached zero, auto-submitting exam')
      submitExam()
    }
  }, [timeLeft, startAttemptMutation.data?.attemptId, submitExamMutation.isPending, submitExam])

  const currentQuestion = questions[currentQuestionIndex]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Exam</h1>
          <p className="text-gray-600 mb-6">
            {error instanceof Error ? error.message : 'Failed to load exam'}
          </p>
          <button
            onClick={() => refetchExam()}
            className="mr-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/student/exams')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Exams
          </button>
        </div>
      </div>
    )
  }

  if (!exam || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Exam not found</h1>
          <p className="text-gray-600 mb-6">The exam you're looking for doesn't exist or isn't available.</p>
          <button
            onClick={() => navigate('/student/exams')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Exams
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-500">Question {currentQuestionIndex + 1} of {questions.length}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="font-medium text-gray-900">Time Left:</span>
                <span className="ml-2 text-red-600 font-bold">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-900">Warnings:</span>
                <span className="ml-2 text-yellow-600 font-bold">{cheatingWarnings}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Question */}
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {currentQuestion.text}
            </h2>

            {/* MCQ Options */}
            {currentQuestion.type === 'mcq' && (
              <div className="space-y-3">
                {currentQuestion.options?.map((option, index) => (
                  <label key={index} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option}
                      checked={answers[currentQuestion.id] === option}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Text Answer */}
            {currentQuestion.type === 'text' && (
              <textarea
                value={answers[currentQuestion.id] as string || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your answer here..."
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate('/student/exams')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Exit Exam
            </button>

            <div className="space-x-4">
              {currentQuestionIndex > 0 && (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Previous
                </button>
              )}

              {currentQuestionIndex < questions.length - 1 && (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Next
                </button>
              )}

              {currentQuestionIndex === questions.length - 1 && (
                <button
                  onClick={submitExam}
                  disabled={submitExamMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {submitExamMutation.isPending ? 'Submitting...' : 'Submit Exam'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
