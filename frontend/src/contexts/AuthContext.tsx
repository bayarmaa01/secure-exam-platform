import React, { createContext, useContext, useEffect, useState } from 'react'
import { authService, User } from '../api/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, name: string, role?: 'student' | 'teacher') => Promise<User>
  logout: () => void
  refreshToken: () => Promise<void>
  isAuthenticated: boolean
  isTeacher: boolean
  isStudent: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Store user data in localStorage for session persistence
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const storedUser = localStorage.getItem('user')
        
        if (token && storedUser) {
          // Validate token by fetching current user
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
          localStorage.setItem('user', JSON.stringify(currentUser))
        } else if (token) {
          // Token exists but no user data, fetch it
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
          localStorage.setItem('user', JSON.stringify(currentUser))
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        // Clear invalid tokens
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const result = await authService.login({ email, password })
      
      // Store tokens and user data
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      localStorage.setItem('user', JSON.stringify(result.user))
      
      setUser(result.user)
      return result.user
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const register = async (email: string, password: string, name: string, role?: 'student' | 'teacher'): Promise<User> => {
    try {
      const result = await authService.register({ email, password, name, role: role || 'student' })
      
      // Store tokens and user data
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      localStorage.setItem('user', JSON.stringify(result.user))
      
      setUser(result.user)
      return result.user
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }

  const logout = (): void => {
    // Clear all auth data
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setUser(null)
    
    // Redirect to login
    window.location.href = '/login'
  }

  const refreshToken = async (): Promise<void> => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }
      
      const newAccessToken = await authService.refreshToken(refreshToken)
      localStorage.setItem('accessToken', newAccessToken)
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
    }
  }

  // Computed values for role-based access
  const isAuthenticated = !!user
  const isTeacher = user?.role === 'teacher'
  const isStudent = user?.role === 'student'
  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      refreshToken,
      isAuthenticated,
      isTeacher,
      isStudent,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Hook for protected routes
export function useRequireAuth(role?: 'student' | 'teacher' | 'admin') {
  const { user, loading, isAuthenticated } = useAuth()
  
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        window.location.href = '/login'
      } else if (role && user?.role !== role) {
        // Redirect to appropriate dashboard based on role
        switch (user?.role) {
          case 'teacher':
            window.location.href = '/teacher-dashboard'
            break
          case 'student':
            window.location.href = '/student-dashboard'
            break
          case 'admin':
            window.location.href = '/admin-dashboard'
            break
          default:
            window.location.href = '/login'
        }
      }
    }
  }, [loading, isAuthenticated, user, role])

  return { user, loading, isAuthenticated }
}
