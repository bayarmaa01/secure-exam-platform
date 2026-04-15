import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { authService } from '../api/auth'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (!tokenParam) {
      setError('Invalid reset link')
    } else {
      setToken(tokenParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!token) {
      setError('Invalid reset token')
      return
    }

    setLoading(true)

    try {
      const result = await authService.resetPassword(token, newPassword)
      setMessage(result.message)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
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
        <h1 className="text-2xl font-bold text-white mb-6">Reset Password</h1>
        
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
            <label htmlFor="newPassword" className="block text-slate-300 text-sm mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-slate-300 text-sm mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
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
