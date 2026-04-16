import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [err, setErr] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErr('')
    setIsLoading(true)
    
    try {
      await register(email, password, name, role, role === 'student' ? registrationNumber : undefined)
      navigate('/dashboard')
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { errors?: { message: string }[], message?: string } } }
      if (apiError.response?.data?.errors) {
        // Handle validation errors from backend
        const validationErrors = apiError.response.data.errors
        const errorMessages = validationErrors.map((e: { message: string }) => e.message).join(', ')
        setErr(errorMessages)
      } else {
        setErr(apiError.response?.data?.message || (error as Error).message || 'Registration failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Create Account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
          />
          {role === 'student' && (
            <input
              type="text"
              placeholder="Registration Number (REG2026001)"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
          )}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
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
            placeholder="Password (min 6 chars, uppercase, lowercase, number, special char)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
          />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg"
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-slate-400 text-sm">
          Already have an account? <Link to="/login" className="text-blue-400 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  )
}
