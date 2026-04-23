import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

interface Exam {
  id: string
  title: string
  description: string
  durationMinutes: number
  scheduledAt: string
  status: string
}

export default function AdminExams() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/exams')
      .then((r) => setExams((r.data as Exam[]) || []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <Link to="/admin" className="text-slate-400 hover:underline">Back</Link>
        <span className="font-semibold">Manage Exams</span>
      </nav>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Exams</h1>
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : exams.length === 0 ? (
          <p className="text-slate-400">No exams yet.</p>
        ) : (
          <div className="space-y-4">
            {exams.map((e) => (
              <div key={e.id} className="bg-slate-800 rounded-lg p-4">
                <h2 className="font-semibold">{e.title}</h2>
                <p className="text-slate-400 text-sm">{e.description}</p>
                <p className="text-slate-500 text-xs mt-1">
                  {e.durationMinutes} min | {new Date(e.scheduledAt).toLocaleString()} | {e.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
