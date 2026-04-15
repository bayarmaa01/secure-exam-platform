import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    try {
      await login(email, password, rememberMe)
      // Redirect is handled in AuthContext
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string; errors?: Array<{ msg?: string }> } } }
      setErr(ex?.response?.data?.message || ex?.response?.data?.errors?.[0]?.msg || 'Login failed')
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
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 pr-10 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="rememberMe" className="text-slate-300 text-sm">
              Remember Me
            </label>
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-slate-400 text-sm">
          No account? <Link to="/register">Register</Link>
        </p>
        <p className="mt-2 text-slate-400 text-sm">
          <Link to="/forgot-password" className="text-blue-400 hover:underline">
            Forgot Password?
          </Link>
        </p>
      </div>
    </div>
  )
}
