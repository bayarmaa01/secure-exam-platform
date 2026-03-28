import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { examService } from '../api/exams'
import ExamTimer from '../components/ExamTimer'
import WebcamCapture from '../components/WebcamCapture'

export default function ExamRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [startedAt, setStartedAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!id) return
    examService.getExamById(id)
      .then((r: any) => {
        const exam = (r.data as any).durationMinutes ? (r.data as any) : { durationMinutes: 60 }
        setDurationMinutes(exam.durationMinutes)
      })
      .catch(() => navigate('/dashboard'))
  }, [id, navigate])

  const startExam = () => {
    if (!id) return
    examService.getExamById(id)
      .then((r: any) => {
        const data = r.data as any
        setAttemptId(data.attemptId)
        setStartedAt(new Date().toISOString())
        return examService.getExamById(id)
      })
      .then((r: any) => setQuestions((r.data as any).questions ? (r.data as any).questions : []))
      .catch(() => navigate('/dashboard'))
  }

  const handleSubmitAnswer = (qId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: answer }))
    // Note: submitAnswer functionality removed as it's not needed for current implementation
  }

  const submitExam = () => {
    if (!attemptId) return
    examService.submitExam({ 
      examId: id!, 
      answers: Object.entries(answers).map(([questionId, answer]) => ({ 
        questionId, 
        answer: answer 
      }))
    })
      .then(() => {
        setSubmitted(true)
        setTimeout(() => navigate('/dashboard'), 2000)
      })
      .catch(() => {})
  }

  const sendFrameToAI = async (blob: Blob) => {
    try {
      const base = import.meta.env.VITE_AI_URL || '/ai'
      const form = new FormData()
      form.append('image', blob)
      await fetch(`${base}/analyze`, {
        method: 'POST',
        body: form
      })
    } catch {
      // Silent fail for proctoring
    }
  }

  if (!attemptId && !questions.length && !startedAt) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-xl font-bold mb-4">Ready to start the exam?</h1>
          <p className="text-slate-400 mb-6">Webcam will be monitored during the exam.</p>
          <button onClick={startExam} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium">
            Start Exam
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-xl font-semibold text-green-400">Exam submitted successfully!</div>
      </div>
    )
  }

  const q = questions[current]
  if (!q) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        Loading questions...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex">
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <ExamTimer
              durationMinutes={durationMinutes}
              startedAt={startedAt}
              onExpire={submitExam}
            />
            <span>Question {current + 1} / {questions.length}</span>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 mb-6 flex-1">
            <h2 className="text-lg font-semibold mb-4">{q.text}</h2>
            {q.type === 'boolean' ? (
              <div className="space-y-2">
                {['True', 'False'].map((opt: string) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === opt}
                      onChange={() => handleSubmitAnswer(q.id, opt)}
                      className="rounded"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {q.options && Array.isArray(q.options) ? (q.options as string[]).map((opt: string) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === opt}
                      onChange={() => handleSubmitAnswer(q.id, opt)}
                      className="rounded"
                    />
                    {opt}
                  </label>
                )) : null}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="px-4 py-2 bg-slate-700 disabled:opacity-50 rounded-lg"
            >
              Previous
            </button>
            {current < questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => c + 1)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitExam}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium"
              >
                Submit Exam
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-80 border-l border-slate-700 p-4 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-400 mb-2">Proctoring</h3>
        <WebcamCapture onFrame={sendFrameToAI} intervalMs={5000} className="flex-1 min-h-[200px]" />
      </div>
    </div>
  )
}
