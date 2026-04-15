import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    try {
      await login(email, password)
      // Redirect is handled in AuthContext
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } }
      setErr(ex?.response?.data?.message || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Secure Exam Platform</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
          />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-slate-400 text-sm">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
