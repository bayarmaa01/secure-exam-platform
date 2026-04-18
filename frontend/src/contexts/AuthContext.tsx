import React, { createContext, useContext, useEffect, useState } from 'react'
import { authService, User } from '../api/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>
  register: (email: string, password: string, name: string, role?: 'student' | 'teacher', registration_number?: string) => Promise<User>
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
      const token = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      const userStr = localStorage.getItem('user')

      console.log('DEBUG: Initializing auth with tokens:', {
        hasAccessToken: !!token,
        hasRefreshToken: !!refreshToken,
        hasUser: !!userStr
      })

      if (token && refreshToken && userStr) {
        try {
          // Validate token by fetching current user
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
          localStorage.setItem('user', JSON.stringify(currentUser))
          console.log('DEBUG: Token validation successful, user logged in')
        } catch (error) {
          console.error('DEBUG: Token validation failed:', error)
          // Clear invalid tokens
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          setUser(null)
        }
      }
      
      setLoading(false)
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string, rememberMe?: boolean): Promise<User> => {
    try {
      console.log('DEBUG: Attempting login for email:', email)
      const result = await authService.login({ email, password, rememberMe })
      
      // Store tokens and user data with consistent keys
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      localStorage.setItem('user', JSON.stringify(result.user))
      
      console.log('DEBUG: Login successful, tokens stored:', {
        hasAccessToken: !!result.accessToken,
        hasRefreshToken: !!result.refreshToken,
        userRole: result.user.role
      })
      
      setUser(result.user)
      
      // Redirect based on role
      const userRole = result.user.role
      if (userRole === 'teacher') {
        window.location.href = '/teacher-dashboard'
      } else {
        window.location.href = '/student-dashboard'
      }
      
      return result.user
    } catch (error) {
      console.error('DEBUG: Login failed:', error)
      throw error
    }
  }

  const register = async (email: string, password: string, name: string, role?: 'student' | 'teacher', registration_number?: string): Promise<User> => {
    try {
      console.log('DEBUG: Attempting registration for email:', email)
      const result = await authService.register({ email, password, name, role: role || 'student', registration_number })
      
      // Store tokens and user data with consistent keys
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      localStorage.setItem('user', JSON.stringify(result.user))
      
      console.log('DEBUG: Registration successful, tokens stored:', {
        hasAccessToken: !!result.accessToken,
        hasRefreshToken: !!result.refreshToken,
        userRole: result.user.role
      })
      
      setUser(result.user)
      
      // Redirect based on role
      const userRole = result.user.role
      if (userRole === 'teacher') {
        window.location.href = '/teacher-dashboard'
      } else {
        window.location.href = '/student-dashboard'
      }
      
      return result.user
    } catch (error) {
      console.error('DEBUG: Registration failed:', error)
      throw error
    }
  }

  const logout = (): void => {
    console.log('DEBUG: Logging out, clearing all auth data')
    // Clear all auth data with consistent keys
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setUser(null)
    
    // Redirect to login
    window.location.href = '/login'
  }

  const refreshToken = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('refreshToken')
      if (!token) {
        throw new Error('No refresh token available')
      }
      
      const newAccessToken = await authService.refreshToken(token)
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
