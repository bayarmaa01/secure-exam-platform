import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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
  endTime: string
}

// Production-grade ExamRoom component with strict React StrictMode safety
export default function ExamRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // State management
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [webcamActive, setWebcamActive] = useState(false)
  const [cheatingWarnings, setCheatingWarnings] = useState(0)
  const [examEndTime, setExamEndTime] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [examError, setExamError] = useState<string | null>(null)
  const [warningError, setWarningError] = useState<string | null>(null)
  
  // Refs for production-grade safety and state stability
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<number | null>(null)
  const webcamIntervalRef = useRef<number | null>(null)
  const isMounted = useRef(true)
  const hasInitialized = useRef(false) // Prevents duplicate execution
  const isLoadingExam = useRef(false)
  const isStartingAttempt = useRef(false)
  const attemptStarted = useRef(false)
  const sessionId = useRef<string>(`session_${Date.now()}`) // Clean session ID without random decimals

  // Production-grade submit exam with proper error handling and unmount protection
  const submitExam = useCallback(async () => {
    if (!attemptId || submitting || !isMounted.current) return
    
    setSubmitting(true)

    try {
      const response = await api.post(`/exams/attempts/${attemptId}/submit`, {
        answers,
        cheatingWarnings,
        sessionId: sessionId.current
      })
      
      console.log('Exam submitted successfully:', response.data)
      
      // Only navigate if component is still mounted
      if (isMounted.current) {
        navigate(`/results/${attemptId}`)
      }
    } catch (error) {
      console.error('Failed to submit exam:', error)
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setSubmitting(false)
        setError('Failed to submit exam. Please try again.')
      }
    }
  }, [attemptId, answers, cheatingWarnings, submitting, navigate])

  // Production-grade loadExam with race condition prevention and failsafe logic
  const loadExam = useCallback(async () => {
    // Early exit guards
    if (!id || !isMounted.current || isLoadingExam.current) {
      console.log(`[${sessionId.current}] Skipping exam load - id: ${!!id}, mounted: ${isMounted.current}, loading: ${isLoadingExam.current}`)
      return
    }
    
    console.log(`[${sessionId.current}] Starting exam load for ID: ${id}`)
    isLoadingExam.current = true
    
    // Only update state if component is still mounted
    if (isMounted.current) {
      setLoading(true)
      setError(null)
    }
    
    try {
      // Phase 1: Fetch exam data
      console.log(`[${sessionId.current}] Fetching exam data for ID: ${id}`)
      const examResponse = await api.get(`/exams/${id}`)
      const examData = examResponse.data
      console.log(`[${sessionId.current}] Exam data loaded successfully: ${examData.title}`)
      
      // Prevent state updates if component unmounted
      if (!isMounted.current) return
      
      // Update exam state atomically
      setExam(examData)
      setQuestions(examData.questions || [])
      setTimeLeft(examData.durationMinutes * 60)
      setExamEndTime(new Date(examData.endTime))
      
      // Phase 2: Start exam attempt (only if not already started)
      if (!isStartingAttempt.current && !attemptStarted.current) {
        await startExamAttempt(id)
      }
      
    } catch (error) {
      console.error(`[${sessionId.current}] Failed to load exam:`, error)
      
      // Prevent state updates if component unmounted
      if (!isMounted.current) return
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load exam'
      
      // Handle different error types
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        console.log(`[${sessionId.current}] Exam not found, redirecting to dashboard`)
        setExamError('Exam not found')
        navigate('/student/exams')
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        console.log(`[${sessionId.current}] Authentication error`)
        setAuthError('Authentication failed')
      } else {
        setError(errorMessage)
      }
    } finally {
      // Prevent state updates if component unmounted
      if (isMounted.current) {
        setLoading(false)
      }
      isLoadingExam.current = false
    }
  }, [id, navigate])

  // Production-safe exam attempt starter with idempotent behavior
  const startExamAttempt = async (examId: string) => {
    // StrictMode-safe guards
    if (isStartingAttempt.current || attemptStarted.current || !isMounted.current) return
    
    isStartingAttempt.current = true
    
    try {
      console.log(`[${sessionId.current}] Attempting to start exam attempt for: ${examId}`)
      
      const payload = { examId }
      console.log(`[${sessionId.current}] Sending payload to /attempts/start:`, payload)
      
      const response = await api.post(`/attempts/start`, payload)
      console.log(`[${sessionId.current}] FULL RESPONSE:`, response)
      console.log(`[${sessionId.current}] RESPONSE DATA:`, response.data)
      console.log(`[${sessionId.current}] RESPONSE.DATA.DATA:`, response.data.data)
      
      // CRITICAL FIX: Correct response parsing
      const attempt = response.data.data
      
      if (response.data.success && attempt) {
        // Success case - set attempt ID from correct location
        if (isMounted.current) {
          setAttemptId(attempt.id)
          attemptStarted.current = true
          console.log(`[${sessionId.current}] Exam attempt started/resumed: ${attempt.id}`)
        }
      } else {
        throw new Error(response.data.message || 'Failed to start exam attempt')
      }
      
    } catch (attemptError) {
      console.error(`[${sessionId.current}] Failed to start exam attempt:`, attemptError)
      
      // Simplified error handling - no complex recovery needed since backend is idempotent
      if (attemptError instanceof Error) {
        throw new Error(`Cannot start exam: ${attemptError.message}`)
      } else {
        throw new Error('Failed to start exam attempt')
      }
    } finally {
      isStartingAttempt.current = false
    }
  }

  // Production-grade event handlers with proper cleanup and memory leak prevention
  const preventContextMenu = useCallback((e: MouseEvent) => e.preventDefault(), [])
  const preventCopyPaste = useCallback((e: ClipboardEvent) => e.preventDefault(), [])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Disable Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault()
    }
  }, [])

  const handleVisibilityChange = useCallback(() => {
    if (!isMounted.current || !document.hidden || !attemptId) return
    
    // Tab switch detected with cooldown
    const now = Date.now()
    const timeSinceLastWarning = now - (window as any).lastWarningTime || 0
    
    if (timeSinceLastWarning < 5000) {
      console.log(`[${sessionId.current}] Throttling warning request - only ${timeSinceLastWarning}ms since last`)
      return
    }
    
    console.log(`[${sessionId.current}] Tab switch detected`)
    (window as any).lastWarningTime = now
    
    if (isMounted.current) {
      setCheatingWarnings(prev => prev + 1)
    }
    
    // Send warning asynchronously (non-blocking)
    api.post('/warnings', {
      userId: user?.id,
      examId: id,
      sessionId: sessionId.current,
      type: 'tab_switch',
      message: 'Student switched tabs during exam'
    }).catch((error: unknown) => console.error('Failed to send warning:', error))
  }, [attemptId, user?.id, id])

  const handleFullscreenChange = useCallback(() => {
    if (!isMounted.current || document.fullscreenElement || !attemptId) return
    
    // Exited fullscreen
    console.log(`[${sessionId.current}] Fullscreen exit detected`)
    
    if (isMounted.current) {
      setCheatingWarnings(prev => prev + 1)
    }
    
    // Send warning asynchronously (non-blocking)
    api.post('/warnings', {
      userId: user?.id,
      examId: id,
      sessionId: sessionId.current,
      type: 'fullscreen_exit',
      message: 'Student exited fullscreen during exam'
    }).catch((error: unknown) => console.error('Failed to send warning:', error))
  }, [attemptId, user?.id, id])

  // Production-grade webcam with proper cleanup and memory leak prevention
  const startWebcam = useCallback(async () => {
    if (!isMounted.current) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })

      const video = videoRef.current
      if (video && isMounted.current) {
        video.srcObject = stream
        await video.play()
        
        if (isMounted.current) {
          setWebcamActive(true)
        }
      }

      // Setup canvas for frame capture
      const canvas = canvasRef.current
      if (!canvas || !isMounted.current) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Production-grade frame capture with proper cleanup
      webcamIntervalRef.current = window.setInterval(async () => {
        if (!isMounted.current || !ctx || !video || video.readyState !== 4) return
        
        try {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)

          const frame = canvas.toDataURL('image/jpeg', 0.8)

          // Send frame to AI for analysis (non-blocking)
          api.post('/ai/analyze-frame', {
            frame,
            timestamp: Date.now(),
            sessionId: sessionId.current,
            attemptId,
            userId: user?.id,
            examId: id
          }).catch((error: unknown) => console.error('Failed to analyze frame:', error))
        } catch (error) {
          console.error('Frame capture error:', error)
        }
      }, 5000)
      
    } catch (error) {
      console.error('Failed to start webcam:', error)
    }
  }, [attemptId, user?.id, id])

  // Production-grade webcam cleanup
  const stopWebcam = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current)
      webcamIntervalRef.current = null
    }
    
    if (isMounted.current) {
      setWebcamActive(false)
    }
  }, [])

  // Production-grade anti-cheating setup with proper cleanup
  const setupAntiCheating = useCallback(async () => {
    if (!isMounted.current) return
    
    console.log(`[${sessionId.current}] Setting up anti-cheating measures`)
    
    try {
      // Add event listeners
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      document.addEventListener('contextmenu', preventContextMenu)
      document.addEventListener('copy', preventCopyPaste)
      document.addEventListener('paste', preventCopyPaste)

      // Start webcam for proctoring
      await startWebcam()
      console.log(`[${sessionId.current}] Anti-cheating measures setup completed`)
    } catch (error) {
      console.error(`[${sessionId.current}] Failed to setup proctoring:`, error)
    }
  }, [handleFullscreenChange, handleKeyDown, handleVisibilityChange, preventContextMenu, preventCopyPaste, startWebcam])

  
  // Production-grade answer change handler
  const handleAnswerChange = useCallback((questionId: string, answer: string | string[]) => {
    if (!isMounted.current) return
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }, [])

  // Main useEffect - Load exam data once when component mounts or ID changes
  useEffect(() => {
    // One-time execution guard - prevents duplicate calls
    if (!id || !isMounted.current || isLoadingExam.current || hasInitialized.current) {
      console.log(`[${sessionId.current}] useEffect skipping load - id: ${!!id}, mounted: ${isMounted.current}, loading: ${isLoadingExam.current}, initialized: ${hasInitialized.current}`)
      return
    }
    
    console.log(`[${sessionId.current}] ExamRoom useEffect triggering, loading exam: ${id}`)
    hasInitialized.current = true // Mark as initialized
    setLoading(true) // Show loading state
    loadExam()
    
    return () => {
      const currentSessionId = sessionId.current
      console.log(`[${currentSessionId}] ExamRoom component unmounting, cleaning up`)
      isMounted.current = false
      isLoadingExam.current = false
      isStartingAttempt.current = false
      attemptStarted.current = false
      hasInitialized.current = false // Reset for next mount
    }
  }, [id]) // Only depends on ID change

  // Anti-cheating setup - only runs when attempt is available and prevents duplicates
  const antiCheatingSetup = useRef(false)
  
  useEffect(() => {
    if (!attemptId || !isMounted.current || antiCheatingSetup.current) return
    
    console.log(`[${sessionId.current}] Setting up anti-cheating for attempt: ${attemptId}`)
    setupAntiCheating()
    antiCheatingSetup.current = true
    
    return () => {
      const currentSessionId = sessionId.current
      console.log(`[${currentSessionId}] Cleaning up anti-cheating measures`)
      
      // Remove event listeners to prevent memory leaks
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('contextmenu', preventContextMenu)
      document.removeEventListener('copy', preventCopyPaste)
      document.removeEventListener('paste', preventCopyPaste)
      
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      stopWebcam()
      antiCheatingSetup.current = false
    }
  }, [attemptId])

  // Production-grade timer countdown effect
  useEffect(() => {
    if (timeLeft <= 0 || !isMounted.current) return
    
    timerRef.current = window.setTimeout(() => {
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

  // Production-grade auto-submit when timer reaches zero
  useEffect(() => {
    if (timeLeft === 0 && attemptId && !submitting && isMounted.current) {
      console.log(`[${sessionId.current}] Timer reached zero, auto-submitting exam`)
      submitExam()
    }
  }, [timeLeft, attemptId, submitting])

  // Production-grade auto-submit when exam time ends (backup check)
  useEffect(() => {
    if (!examEndTime || !isMounted.current) return
    
    const timeUntilEnd = examEndTime.getTime() - Date.now()
    if (timeUntilEnd <= 0 && attemptId && !submitting) {
      console.log(`[${sessionId.current}] Exam end time reached, auto-submitting exam`)
      submitExam()
    }
  }, [examEndTime, attemptId, submitting, submitExam])

  // StrictMode-safe cleanup on component unmount (DO NOT reset attemptStarted)
  useEffect(() => {
    return () => {
      const currentSessionId = sessionId.current
      console.log(`[${currentSessionId}] Component unmounting - cleaning up resources`)
      isStartingAttempt.current = false
      isLoadingExam.current = false
      isMounted.current = false
      // NOTE: Do NOT reset attemptStarted.current - it should persist
      // NOTE: Do NOT reset hasInitialized.current - it should persist
    }
  }, [])

  const currentQuestion = questions[currentQuestionIndex]

  // Conditional rendering - prevent "Exam not found" flicker
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam...</p>
        </div>
      </div>
    )
  }

  // Only show error if not loading AND error exists
  if (!loading && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Error Loading Exam</h2>
            <p className="text-gray-600">{error}</p>
          </div>
          <button
            onClick={() => navigate('/student/exams')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Exams
          </button>
        </div>
      </div>
    )
  }

  // Show specific error states
  if (examError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Exam not found</h1>
          <p className="text-gray-600 mb-6">The exam you&apos;re looking for doesn&apos;t exist or isn&apos;t available.</p>
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

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Authentication Error</h1>
          <p className="text-gray-600 mb-6">Please log in again to continue.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (!exam || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Loading Exam...</h1>
          <p className="text-gray-600 mb-6">Please wait while we load your exam.</p>
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
              {webcamActive && (
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              )}
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
              onClick={() => navigate('/dashboard')}
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
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Exam'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden video element for webcam */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
    </div>
  )
}
