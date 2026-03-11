import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function TeacherDashboard() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <span className="font-semibold">Teacher Panel</span>
        <div className="flex gap-4">
          <Link to="/teacher/create-exam" className="text-blue-400 hover:underline">Create Exam</Link>
          <Link to="/teacher/exams" className="text-blue-400 hover:underline">Manage Exams</Link>
          <Link to="/teacher/results" className="text-blue-400 hover:underline">View Results</Link>
          <Link to="/dashboard" className="text-slate-400 hover:underline">Student View</Link>
          <button onClick={() => logout()} className="text-red-400 hover:underline">Logout</button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Teacher Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/teacher/create-exam" className="bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition">
            <h2 className="font-semibold text-lg">Create New Exam</h2>
            <p className="text-slate-400 text-sm mt-1">Design and create new examinations</p>
          </Link>
          <Link to="/teacher/exams" className="bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition">
            <h2 className="font-semibold text-lg">Manage Exams</h2>
            <p className="text-slate-400 text-sm mt-1">Edit, schedule, and publish existing exams</p>
          </Link>
          <Link to="/teacher/results" className="bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition">
            <h2 className="font-semibold text-lg">View Results</h2>
            <p className="text-slate-400 text-sm mt-1">Monitor student performance and analytics</p>
          </Link>
        </div>
        
        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <h2 className="font-semibold text-lg mb-4">Quick Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">0</div>
              <div className="text-sm text-slate-400">Total Exams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">0</div>
              <div className="text-sm text-slate-400">Published</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">0</div>
              <div className="text-sm text-slate-400">Total Attempts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">0</div>
              <div className="text-sm text-slate-400">Active Students</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
