import React from 'react'
import { Navigate } from 'react-router-dom'
import { useRequireAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  role?: 'student' | 'teacher' | 'admin'
  fallback?: string
}

export function ProtectedRoute({ children, role, fallback = '/login' }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useRequireAuth(role)
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to={fallback} replace />
  }
  
  if (role && user?.role !== role) {
    // Redirect to appropriate dashboard based on user role
    const dashboardMap = {
      'teacher': '/teacher-dashboard',
      'student': '/student-dashboard',
      'admin': '/admin-dashboard'
    }
    const redirectPath = dashboardMap[user?.role as keyof typeof dashboardMap] || '/login'
    return <Navigate to={redirectPath} replace />
  }
  
  return <>{children}</>
}
