import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

interface Result {
  id: string
  studentName: string
  examTitle: string
  score: number
  cheatingScore?: number
  submittedAt: string
}

export default function AdminResults() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/results')
      .then((r) => setResults((r.data as Result[]) || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <Link to="/admin" className="text-slate-400 hover:underline">Back</Link>
        <span className="font-semibold">Results & Cheating Reports</span>
      </nav>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Student Results</h1>
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : results.length === 0 ? (
          <p className="text-slate-400">No results yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-600">
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Exam</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Cheating Score</th>
                  <th className="pb-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-slate-700">
                    <td className="py-2">{r.studentName}</td>
                    <td className="py-2">{r.examTitle}</td>
                    <td className="py-2">{r.score}</td>
                    <td className={`py-2 ${(r.cheatingScore ?? 0) > 0.7 ? 'text-red-400' : ''}`}>
                      {r.cheatingScore != null ? (r.cheatingScore * 100).toFixed(1) + '%' : '-'}
                    </td>
                    <td className="py-2 text-slate-400">{new Date(r.submittedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
