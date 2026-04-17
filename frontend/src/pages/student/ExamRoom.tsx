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
}

export default function ExamRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

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
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<number | null>(null)

  const submitExam = useCallback(async () => {
    if (!attemptId || submitting) return
    
    setSubmitting(true)

    try {
      const response = await api.post(`/exams/attempts/${attemptId}/submit`, {
        answers,
        cheatingWarnings
      })
      
      console.log('Exam submitted:', response.data)
      navigate(`/results/${attemptId}`)
    } catch (error) {
      console.error('Failed to submit exam:', error)
      setSubmitting(false)
    }
  }, [attemptId, submitting, answers, cheatingWarnings, navigate])

  const loadExam = useCallback(async () => {
    try {
      const response = await api.get(`/exams/${id}`)
      const examData = response.data
      console.log('Exam data loaded:', examData)

      setExam(examData)
      setQuestions(examData.questions || [])

      // Start exam attempt
      const attemptResponse = await api.post(`/attempts/start`, {
        examId: id
      })

      if (attemptResponse.data.success) {
        setAttemptId(attemptResponse.data.attemptId)
        setTimeLeft(examData.durationMinutes * 60)
        setExamEndTime(new Date(examData.endTime))
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to load exam:', error)
      setLoading(false)
    }
  }, [id])

  // Anti-cheating prevention functions
  const preventContextMenu = (e: MouseEvent) => e.preventDefault()
  const preventCopyPaste = (e: ClipboardEvent) => e.preventDefault()
  const handleKeyDown = (e: KeyboardEvent) => {
    // Disable Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault()
    }
  }

  const handleVisibilityChange = () => {
    if (document.hidden && attemptId) {
      // Tab switch detected
      setCheatingWarnings(prev => prev + 1)
      api.post('/api/warnings', {
        userId: user?.id,
        examId: id,
        type: 'tab_switch',
        message: 'Student switched tabs during exam'
      }).catch((error: unknown) => console.error('Failed to send warning:', error))
    }
  }

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      // Exited fullscreen
      if (attemptId) {
        setCheatingWarnings(prev => prev + 1)
        api.post('/api/warnings', {
          userId: user?.id,
          examId: id,
          type: 'fullscreen_exit',
          message: 'Student exited fullscreen during exam'
        }).catch((error: unknown) => console.error('Failed to send warning:', error))
      }
    }
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.play()
      }

      // Setup canvas for frame capture
      const canvas = canvasRef.current
      if (!canvas) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Capture frame every 5 seconds
      setInterval(async () => {
        if (ctx && video && video.readyState === 4) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)

          const frame = canvas.toDataURL('image/jpeg', 0.8)

          // Send frame to AI for analysis
          api.post('/api/ai/analyze-frame', {
            frame,
            timestamp: Date.now(),
            sessionId: attemptId,
            userId: user?.id,
            examId: id
          }).catch((error: unknown) => console.error('Failed to analyze frame:', error))
        }
      }, 5000)
    } catch (error) {
      console.error('Failed to start webcam:', error)
    }
  }

  const setupAntiCheating = useCallback(async () => {
    try {
      // Enable anti-cheating measures
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      document.addEventListener('contextmenu', preventContextMenu)
      document.addEventListener('copy', preventCopyPaste)
      document.addEventListener('paste', preventCopyPaste)

      // Start webcam for proctoring
      await startWebcam()
    } catch (error) {
      console.error('Failed to setup proctoring:', error)
    }
  }, [handleFullscreenChange, handleKeyDown, handleVisibilityChange, startWebcam])

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setWebcamActive(false)
    }
  }

  
  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // useEffect hooks - must be called before any conditional returns
  useEffect(() => {
    if (!id) return
    
    loadExam()
  }, [id, loadExam])

  useEffect(() => {
    if (!id) return

    setupAntiCheating()
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      stopWebcam()
    }
  }, [id, setupAntiCheating])

  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
    } else if (timeLeft === 0 && attemptId) {
      submitExam()
    }
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeLeft, attemptId, submitExam])

  // Auto-submit when exam time ends
  useEffect(() => {
    if (examEndTime && timeLeft > 0) {
      const timeUntilEnd = examEndTime.getTime() - Date.now()
      if (timeUntilEnd <= 0) {
        submitExam()
      }
    }
  }, [examEndTime, timeLeft, submitExam])

  const currentQuestion = questions[currentQuestionIndex]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    )
  }

  if (!exam || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Exam not found</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
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
