import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'
import { io, Socket } from 'socket.io-client'

interface ActiveSession {
  session_id: string
  exam_id: string
  exam_title: string
  student_name: string
  student_email: string
  start_time: string
  violation_count: number
  status: string
}

interface Violation {
  session_id: string
  user_id: string
  type: string
  details: string
  timestamp: string
}

interface ExamStats {
  exam_id: string
  exam_title: string
  active_sessions: number
  total_violations: number
  completion_rate: number
}

export default function LiveMonitoring() {
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [recentViolations, setRecentViolations] = useState<Violation[]>([])
  const [examStats, setExamStats] = useState<ExamStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedExam, setSelectedExam] = useState<string | null>(null)

  // Initialize WebSocket connection
  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_API_URL || 'http://localhost:4000')
    
    socketRef.current.on('connect', () => {
      console.log('Teacher monitoring socket connected')
    })

    socketRef.current.on('exam_started', (data) => {
      console.log('Exam started:', data)
      fetchActiveSessions()
      fetchExamStats()
    })

    socketRef.current.on('exam_submitted', (data) => {
      console.log('Exam submitted:', data)
      fetchActiveSessions()
      fetchExamStats()
    })

    socketRef.current.on('force_submit', (data) => {
      console.log('Force submit:', data)
      fetchActiveSessions()
      fetchExamStats()
    })

    socketRef.current.on('violation_detected', (data) => {
      console.log('Violation detected:', data)
      setRecentViolations(prev => [data, ...prev.slice(0, 19)]) // Keep last 20 violations
    })

    socketRef.current.on('disconnect', () => {
      console.log('Teacher monitoring socket disconnected')
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  // Fetch initial data
  useEffect(() => {
    fetchActiveSessions()
    fetchExamStats()
    fetchRecentViolations()
  }, [])

  const fetchActiveSessions = async () => {
    try {
      const response = await api.get('/exam-sessions/sessions/active')
      setActiveSessions(response.data)
    } catch (error) {
      console.error('Failed to fetch active sessions:', error)
    }
  }

  const fetchExamStats = async () => {
    try {
      const response = await api.get('/teacher/exams')
      const exams = response.data
      
      const stats = exams.map((exam: any) => ({
        exam_id: exam.id,
        exam_title: exam.title,
        active_sessions: activeSessions.filter(s => s.exam_id === exam.id).length,
        total_violations: activeSessions
          .filter(s => s.exam_id === exam.id)
          .reduce((sum, s) => sum + s.violation_count, 0),
        completion_rate: 0 // Would need to calculate from completed sessions
      }))
      
      setExamStats(stats)
    } catch (error) {
      console.error('Failed to fetch exam stats:', error)
    }
  }

  const fetchRecentViolations = async () => {
    try {
      const response = await api.get('/exam-sessions/violations/recent')
      setRecentViolations(response.data.slice(0, 20))
    } catch (error) {
      console.error('Failed to fetch recent violations:', error)
    }
  }

  const handleForceSubmit = async (sessionId: string, studentName: string) => {
    if (!confirm(`Force submit exam for ${studentName}?`)) {
      return
    }

    try {
      await api.post(`/exam-sessions/${sessionId}/force-submit`)
      console.log('Force submitted successfully')
    } catch (error) {
      console.error('Failed to force submit:', error)
    }
  }

  const getViolationTypeColor = (type: string) => {
    switch (type) {
      case 'tab_switch':
        return 'text-yellow-700 bg-yellow-100'
      case 'fullscreen_exit':
        return 'text-red-700 bg-red-100'
      case 'copy_paste':
        return 'text-orange-700 bg-orange-100'
      case 'right_click':
        return 'text-purple-700 bg-purple-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const getViolationTypeIcon = (type: string) => {
    switch (type) {
      case 'tab_switch':
        return '🔄'
      case 'fullscreen_exit':
        return '📱'
      case 'copy_paste':
        return '📋'
      case 'right_click':
        return '🖱️'
      default:
        return '⚠️'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading live monitoring...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Live Exam Monitoring</h1>
              <span className="ml-4 px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full animate-pulse">
                LIVE
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/teacher/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Exams</dt>
                      <dd className="text-lg font-medium text-gray-900">{activeSessions.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856m1.084-4.418a1.5 1.5 0 00-1.176-1.176C4.162 8.56 3.5 8.5c0-1.062.062-2.062 2.062-2.062 0-1.124.088-2.088 2.088-2.088z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Violations</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {activeSessions.reduce((sum, s) => sum + s.violation_count, 0)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg Completion Rate</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {examStats.length > 0 
                          ? `${Math.round(examStats.reduce((sum, s) => sum + s.completion_rate, 0) / examStats.length * 100)}%`
                          : '0%'
                        }
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Active Sessions */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Active Exam Sessions</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Exam
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Violations
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activeSessions.map((session) => (
                        <tr key={session.session_id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{session.student_name}</div>
                            <div className="text-sm text-gray-500">{session.student_email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{session.exam_title}</div>
                            <div className="text-sm text-gray-500">
                              Started: {new Date(session.start_time).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {Math.floor((Date.now() - new Date(session.start_time).getTime()) / 60000)}m
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              session.violation_count === 0 
                                ? 'bg-green-100 text-green-800'
                                : session.violation_count < 3
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {session.violation_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <button
                              onClick={() => handleForceSubmit(session.session_id, session.student_name)}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Force Submit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recent Violations */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Violations</h3>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentViolations.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No violations detected</p>
                  ) : (
                    recentViolations.map((violation, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className={`text-2xl ${getViolationTypeIcon(violation.type)}`}>
                            {getViolationTypeIcon(violation.type)}
                          </span>
                          <div>
                            <div className={`text-sm font-medium ${getViolationTypeColor(violation.type)}`}>
                              {violation.type.replace('_', ' ').toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {violation.details}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(violation.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(violation.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Exam Statistics */}
          <div className="bg-white shadow rounded-lg mt-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Exam Statistics</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {examStats.map((stat) => (
                  <div key={stat.exam_id} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{stat.exam_title}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Active Sessions:</span>
                        <span className="text-sm font-medium text-gray-900">{stat.active_sessions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Violations:</span>
                        <span className="text-sm font-medium text-gray-900">{stat.total_violations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Completion Rate:</span>
                        <span className="text-sm font-medium text-gray-900">{stat.completion_rate}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
