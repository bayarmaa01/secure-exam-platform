import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminDashboard() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <span className="font-semibold">Admin Panel</span>
        <div className="flex gap-4">
          <Link to="/admin/users" className="text-blue-400 hover:underline">Users</Link>
          <Link to="/admin/exams" className="text-blue-400 hover:underline">Exams</Link>
          <Link to="/admin/results" className="text-blue-400 hover:underline">Results</Link>
          <Link to="/dashboard" className="text-slate-400 hover:underline">Student View</Link>
          <button onClick={() => logout()} className="text-red-400 hover:underline">Logout</button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/admin/users" className="bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition">
            <h2 className="font-semibold text-lg">User Management</h2>
            <p className="text-slate-400 text-sm mt-1">Manage students, teachers, and admins</p>
          </Link>
          <Link to="/admin/exams" className="bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition">
            <h2 className="font-semibold text-lg">Manage Exams</h2>
            <p className="text-slate-400 text-sm mt-1">Create, schedule, and publish exams</p>
          </Link>
          <Link to="/admin/results" className="bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition">
            <h2 className="font-semibold text-lg">View Results</h2>
            <p className="text-slate-400 text-sm mt-1">Student scores and cheating reports</p>
          </Link>
        </div>
      </main>
    </div>
  )
}
