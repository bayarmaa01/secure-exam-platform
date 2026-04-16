import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api'
import { useAntiCheat } from '../../hooks/useAntiCheat'
import { io, Socket } from 'socket.io-client'

interface Question {
  id: string
  question_text: string
  type: string
  options: string[]
  correct_answer: string
  points: number
}

interface ExamSession {
  session_id: string
  exam_id: string
  exam_title: string
  start_time: string
  end_time: string
  remaining_time_ms: number
  status: string
  server_time: string
  questions: Question[]
  duration_minutes: number
}

interface Answer {
  question_id: string
  selected_answer: string
}

export default function LiveExam() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<number | null>(null)
  const syncIntervalRef = useRef<number | null>(null)
  
  const [session, setSession] = useState<ExamSession | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)

  // Anti-cheat configuration
  const antiCheat = useAntiCheat(
    session?.session_id || '',
    {
      preventTabSwitch: true,
      preventFullscreenExit: true,
      preventCopyPaste: true,
      preventRightClick: true
    }
  )

  // Handle force submit from teacher
  const handleForceSubmit = useCallback((reason: string) => {
    if (isSubmitting || isAutoSubmitting) return;
    
    setIsAutoSubmitting(true);
    setIsSubmitting(true);
    
    // Submit with current answers
    api.post(`/exam-sessions/${session?.session_id}/submit`, {
      answers,
      violation_count: antiCheat.violationCount
    }).then(() => {
      navigate('/student-dashboard', { 
        state: { 
          message: `Exam force submitted: ${reason}`,
          forceSubmitted: true 
        } 
      });
    }).catch(error => {
      console.error('Force submit failed:', error);
      setIsSubmitting(false);
      setIsAutoSubmitting(false);
    });
  }, [session, answers, antiCheat.violationCount, isSubmitting, isAutoSubmitting, navigate]);

  // Auto-submit when time ends
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting || isAutoSubmitting) return;
    
    setIsAutoSubmitting(true);
    setIsSubmitting(true);
    
    try {
      await api.post(`/exam-sessions/${session?.session_id}/submit`, {
        answers,
        violation_count: antiCheat.violationCount
      });
      
      navigate('/student-dashboard', { 
        state: { 
          message: 'Exam auto-submitted due to time limit or violations',
          autoSubmitted: true 
        } 
      });
    } catch (error) {
      console.error('Auto-submit failed:', error);
      setIsSubmitting(false);
      setIsAutoSubmitting(false);
    }
  }, [session, answers, antiCheat.violationCount, isSubmitting, isAutoSubmitting, navigate]);

  // Sync with server time every 5 seconds
  useEffect(() => {
    if (!session) return

    const syncTime = async () => {
      try {
        const response = await api.get(`/exam-sessions/${session.session_id}`)
        const updatedSession = response.data
        setSession(updatedSession)
        setTimeRemaining(updatedSession.remaining_time_ms)
      } catch (error) {
        console.error('Failed to sync time:', error)
      }
    }

    // Initial sync
    syncTime()
    
    // Sync every 5 seconds
    syncIntervalRef.current = setInterval(syncTime, 5000)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [session?.session_id, antiCheat, handleAutoSubmit])

  // Local timer for countdown
  useEffect(() => {
    if (timeRemaining <= 0) {
      handleAutoSubmit()
      return
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1000))
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [timeRemaining, handleAutoSubmit])

  // Initialize WebSocket connection
  useEffect(() => {
    if (!session) return

    socketRef.current = io((window as any).process?.env?.REACT_APP_API_URL || 'http://localhost:4000')
    
    socketRef.current.on('connect', () => {
      console.log('Connected to exam WebSocket')
      // Join exam room
      socketRef.current?.emit('join_exam_room', session.exam_id)
    })

    socketRef.current.on('force_submit', (data) => {
      console.log('Force submit received:', data)
      if (data.session_id === session.session_id) {
        handleForceSubmit(data.reason)
      }
    })

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from exam WebSocket')
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [session, handleForceSubmit])

  
  // Check for auto-submit conditions
  useEffect(() => {
    if (antiCheat.shouldAutoSubmit()) {
      handleAutoSubmit()
    }
  }, [antiCheat.violations, handleAutoSubmit])

  // Handle answer selection
  const handleAnswerSelect = useCallback((questionId: string, selectedAnswer: string) => {
    setAnswers(prev => {
      const existing = prev.find(a => a.question_id === questionId)
      if (existing) {
        return prev.map(a => 
          a.question_id === questionId 
            ? { ...a, selected_answer: selectedAnswer }
            : a
        )
      } else {
        return [...prev, { question_id: questionId, selected_answer: selectedAnswer }]
      }
    })
  }, [])

  // Request fullscreen
  const requestFullscreen = useCallback(() => {
    antiCheat.requestFullscreen()
  }, [antiCheat])

  // Format time display
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Manual submit
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || isAutoSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await api.post(`/exam-sessions/${session?.session_id}/submit`, {
        answers,
        violation_count: antiCheat.violationCount
      });
      
      navigate('/student-dashboard', { 
        state: { 
          message: 'Exam submitted successfully',
          submitted: true 
        } 
      });
    } catch (error) {
      console.error('Submit failed:', error);
      setIsSubmitting(false);
    }
  }, [session, answers, antiCheat.violationCount, isSubmitting, isAutoSubmitting]);

  // Load initial session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await api.post('/exam-sessions', {
          exam_id: examId,
          course_id: 'course-id-placeholder' // This should come from exam data
        })
        
        const sessionData = response.data
        setSession(sessionData)
        setTimeRemaining(sessionData.remaining_time_ms)
        
        // Request fullscreen on start
        requestFullscreen()
        
      } catch (error) {
        console.error('Failed to start exam session:', error)
        navigate('/student-dashboard', { 
          state: { 
            error: 'Failed to start exam session',
            details: error 
          } 
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()
  }, [examId, navigate, requestFullscreen])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Starting exam session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Exam session not found</p>
        </div>
      </div>
    )
  }

  const currentQuestion = session.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / session.questions.length) * 100

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with timer and status */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">{session.exam_title}</h1>
              <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Question {currentQuestionIndex + 1} of {session.questions.length}
              </span>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Timer */}
              <div className={`text-lg font-mono font-bold ${
                timeRemaining < 60000 ? 'text-red-600' : 
                timeRemaining < 300000 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {formatTime(timeRemaining)}
              </div>
              
              {/* Violations indicator */}
              {antiCheat.violations.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                    {antiCheat.violationCount} Violations
                  </span>
                  {antiCheat.shouldAutoSubmit() && (
                    <span className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full animate-pulse">
                      Auto-submitting...
                    </span>
                  )}
                </div>
              )}
              
              {/* Status indicators */}
              <div className="flex items-center space-x-2">
                {antiCheat.isFullscreen && (
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Fullscreen
                  </span>
                )}
                {antiCheat.isTabActive && (
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 h-2">
        <div 
          className="bg-blue-600 h-2 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {currentQuestion && (
              <div className="space-y-6">
                {/* Question */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    {currentQuestion.question_text}
                  </h2>
                  
                  {/* Points */}
                  <div className="mb-4">
                    <span className="text-sm text-gray-500">
                      Points: {currentQuestion.points || 1}
                    </span>
                  </div>
                </div>

                {/* Answer options */}
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <label
                      key={index}
                      className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option}
                        checked={answers.find(a => a.question_id === currentQuestion.id)?.selected_answer === option}
                        onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                        className="mr-3"
                      />
                      <span className="text-gray-900">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 px-4">
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="text-sm text-gray-500">
            {currentQuestionIndex + 1} / {session.questions.length}
          </div>
          
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.min(session.questions.length - 1, prev + 1))}
            disabled={currentQuestionIndex === session.questions.length - 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

        {/* Submit button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isAutoSubmitting}
            className="px-6 py-3 text-lg font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>

        {/* Violations display */}
        {antiCheat.violations.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-lg font-medium text-red-800 mb-2">Violations Detected</h3>
            <div className="space-y-2">
              {antiCheat.violations.map((violation, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-red-700">
                    {violation.type.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-red-600">
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            {antiCheat.shouldAutoSubmit() && (
              <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                <p className="text-orange-800 font-medium">
                  ⚠️ Exam will be auto-submitted due to excessive violations
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
