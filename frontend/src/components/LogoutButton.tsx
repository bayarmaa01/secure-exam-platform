import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, User } from 'lucide-react'

export function LogoutButton() {
  const { user, logout, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <User className="w-5 h-5 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {user.name}
        </span>
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
          {user.role}
        </span>
      </div>
      <button
        onClick={logout}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </button>
    </div>
  )
}
