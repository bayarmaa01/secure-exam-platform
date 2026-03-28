import React, { createContext, useContext, useEffect, useState } from 'react'
import { authService, User } from '../api/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, name: string, role?: 'student' | 'teacher') => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      authService.getCurrentUser().then(setUser).catch(() => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string): Promise<User> => {
    const result = await authService.login({ email, password })
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
    setUser(result.user)
    return result.user
  }

  const register = async (email: string, password: string, name: string, role: 'student' | 'teacher' = 'student'): Promise<User> => {
    const result = await authService.register({ email, password, name, role })
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
    setUser(result.user)
    return result.user
  }

  const logout = () => {
    authService.logout()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
