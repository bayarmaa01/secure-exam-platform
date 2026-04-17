import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { examService, Exam } from '../api/exams'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState<Exam[]>([])

  useEffect(() => {
    if (user?.role === 'teacher') {
      examService.getTeacherExams()
        .then(data => setExams(data))
        .catch(() => setExams([]))
    } else if (user?.role === 'student') {
      examService.getAvailableExams()
        .then(data => setExams(data))
        .catch(() => setExams([]))
    }
  }, [user])

  const available = exams // Show all exams to enrolled students

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <span className="font-semibold">Secure Exam Platform</span>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">{user?.name}</span>
          {user?.role === 'admin' && (
            <Link to="/admin" className="text-blue-400 hover:underline">Admin</Link>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} className="text-red-400 hover:underline">
            Logout
          </button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Available Exams</h1>
        <div className="space-y-4">
          {available.length === 0 ? (
            <p className="text-slate-400">No exams available at the moment.</p>
          ) : (
            available.map((exam) => (
              <div key={exam.id} className="bg-slate-800 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold">{exam.title}</h2>
                  <p className="text-slate-400 text-sm">{exam.description}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Duration: {exam.durationMinutes} min | Scheduled: {new Date(exam.startTime).toLocaleString()}
                  </p>
                </div>
                <Link
                  to={`/exam/${exam.id}`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
                >
                  Start Exam
                </Link>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
