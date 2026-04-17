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
  useAuth()
  
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [webcamActive, setWebcamActive] = useState(false)
  const [cheatingWarnings, setCheatingWarnings] = useState(0)
  const [examEndTime, setExamEndTime] = useState<Date | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const intervalRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  const submitExam = useCallback(async () => {
    if (!attemptId || submitting) return
    
    setSubmitting(true)
    
    try {
      await api.post(`/exams/attempts/${attemptId}/submit`, {
        answers,
        cheatingWarnings
      })
      
      navigate(`/results/${attemptId}`)
    } catch (error) {
      console.error('Failed to submit exam:', error)
      setSubmitting(false)
    }
  }, [attemptId, submitting, answers, cheatingWarnings, navigate])

  useEffect(() => {
    if (!id) return
    
    loadExam()
    setupAntiCheating()
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
      stopWebcam()
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [timeLeft, attemptId, submitExam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when exam time ends
  useEffect(() => {
    if (examEndTime && timeLeft > 0) {
      const timeUntilEnd = examEndTime.getTime() - Date.now()
      if (timeUntilEnd <= 0) {
        submitExam()
      }
    }
  }, [examEndTime, timeLeft, submitExam]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExam = async () => {
    try {
      const [examRes, questionsRes] = await Promise.all([
        api.get(`/exams/${id}`),
        api.get(`/exams/${id}/questions`)
      ])
      
      const examData = examRes.data
      setExam(examData)
      setQuestions(questionsRes.data)
      
      // Set exam end time for timer
      if (examData.endTime) {
        setExamEndTime(new Date(examData.endTime))
        const timeUntilEnd = new Date(examData.endTime).getTime() - Date.now()
        setTimeLeft(Math.max(0, Math.floor(timeUntilEnd / 1000)))
      }
      
      // Start exam attempt
      const attemptRes = await api.post(`/exams/${id}/start`)
      setAttemptId(attemptRes.data.attemptId)
      setTimeLeft(examRes.data.durationMinutes * 60)
      
      // Start webcam monitoring
      startWebcam()
      
    } catch (error) {
      console.error('Failed to load exam:', error)
      navigate('/exams')
    } finally {
      setLoading(false)
    }
  }

  // Anti-cheating prevention functions
  const preventContextMenu = (e: MouseEvent) => e.preventDefault()
  const preventCopyPaste = (e: ClipboardEvent) => e.preventDefault()
  const handleKeyDown = (e: KeyboardEvent) => {
    // Disable Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault()
    }
  }

  const setupAntiCheating = () => {
    let warningCount = 0
    
    // Tab switching detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        warningCount++
        setCheatingWarnings(warningCount)
        console.log('Tab switched - potential cheating')
        
        // Send warning to backend
        if (attemptId) {
          api.post('/warnings', {
            exam_id: id,
            type: 'tab_switch',
            message: 'Student switched tabs during exam'
          }).catch(error => console.error('Failed to send warning:', error))
        }
      }
    }
    
    // Fullscreen detection
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        warningCount++
        setCheatingWarnings(warningCount)
        console.log('Exited fullscreen - potential cheating')
        
        // Send warning to backend
        if (attemptId) {
          api.post('/warnings', {
            exam_id: id,
            type: 'fullscreen_exit',
            message: 'Student exited fullscreen during exam'
          }).catch(error => console.error('Failed to send warning:', error))
        }
      }
    })
    
    // Prevent right-click
    document.addEventListener('contextmenu', preventContextMenu)
    
    // Disable copy/paste
    document.addEventListener('copy', preventCopyPaste)
    document.addEventListener('paste', preventCopyPaste)
    
    // Disable keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown)
    
    // Auto-submit after 3 warnings
    if (warningCount >= 3) {
      submitExam()
    }
    
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu)
      document.removeEventListener('copy', preventCopyPaste)
      document.removeEventListener('paste', preventCopyPaste)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('keydown', handleKeyDown)
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
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setWebcamActive(true)
        startFrameCapture()
      }
    } catch (error) {
      console.error('Webcam access denied:', error)
      setCheatingWarnings(prev => prev + 1)
      sendCheatingAlert('Webcam access denied')
    }
  }

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setWebcamActive(false)
    }
  }

  const captureAndSendFrame = async () => {
    if (!videoRef.current) return
    
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 640, 480)
      const imageData = canvas.toDataURL('image/jpeg', 0.8)
      
      try {
        await api.post('/ai/analyze-frame', {
          attemptId,
          frame: imageData,
          timestamp: Date.now()
        })
      } catch (error) {
        console.error('Failed to send frame:', error)
      }
    }
  }

  const sendCheatingAlert = async (reason: string) => {
    if (!attemptId) return
    
    try {
      await api.post('/ai/cheating-alert', {
        attemptId,
        reason,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to send cheating alert:', error)
    }
  }

  const startFrameCapture = () => {
    if (!webcamActive) return
    
    intervalRef.current = setInterval(() => {
      if (videoRef.current && attemptId) {
        captureAndSendFrame()
      }
    }, 5000) // Send frame every 5 seconds
  }

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    
    // Auto-save answer
    if (attemptId) {
      api.post(`/exams/attempts/${attemptId}/answers`, {
        questionId,
        answer
      }).catch(error => console.error('Failed to save answer:', error))
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exam...</p>
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Exam not found</h2>
          <button
            onClick={() => navigate('/exams')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Exams
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
              <span className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`text-lg font-mono ${
                timeLeft < 300 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {formatTime(timeLeft)}
              </div>
              <button
                onClick={submitExam}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {currentQuestion && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="mb-6">
                  <span className="inline-block px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full mb-4">
                    {currentQuestion.points} points
                  </span>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    {currentQuestion.text}
                  </h2>
                </div>

                {currentQuestion.type === 'mcq' ? (
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
                          checked={answers[currentQuestion.id] === option}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                          className="mr-3"
                        />
                        <span className="text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={answers[currentQuestion.id] as string || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                    placeholder="Type your answer here..."
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Webcam Monitoring */}
        <div className="w-96 p-4">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Proctoring Active</h3>
            <div className="flex items-center justify-center">
              {webcamActive ? (
                <div className="text-green-600">● Camera Active</div>
              ) : (
                <div className="text-red-600">● Camera Inactive</div>
              )}
            </div>
            {cheatingWarnings > 0 && (
              <div className="mt-4 p-3 bg-yellow-100 border border border-yellow-400 rounded">
                <div className="text-yellow-800 font-medium">
                  ⚠️ Warnings: {cheatingWarnings}
                </div>
                <div className="text-sm text-yellow-700">
                  {cheatingWarnings >= 3 ? 'Exam will be auto-submitted' : 'Continue monitoring'}
                </div>
              </div>
            )}
          </div>
          <video
            ref={videoRef}
            className="w-full h-48 bg-black rounded"
            autoPlay
            muted
          />
        </div>
      </main>
    </div>
  )
}
