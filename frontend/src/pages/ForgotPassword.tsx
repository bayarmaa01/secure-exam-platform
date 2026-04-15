import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const result = await authService.forgotPassword(email)
      setMessage(result.message)
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } }
      setError(ex?.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Forgot Password</h1>
        
        {message && (
          <div className="mb-4 p-3 bg-green-600 text-white rounded-lg">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-600 text-white rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-slate-300 text-sm mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-blue-400 hover:underline text-sm">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
