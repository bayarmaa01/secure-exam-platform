import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Award, AlertTriangle, BookOpen, Target } from 'lucide-react'
import api from '../../api'
import toast from 'react-hot-toast'

interface TopicPerformance {
  topic: string
  totalQuestions: number
  correctAnswers: number
  accuracy: number
  status: string
}

interface ProgressData {
  examName: string
  date: string
  score: number
}

interface OverallStats {
  totalExams: number
  totalQuestionsAnswered: number
  totalCorrectAnswers: number
  averageScore: number
  examsPassed: number
}

interface WeakTopic {
  topic: string
  totalQuestionsAttempted: number
  correctAnswers: number
  accuracy: number
  errorRate: number
  status: string
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']

export default function LearningDashboard() {
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([])
  const [progressOverTime, setProgressOverTime] = useState<ProgressData[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch all dashboard data
      const [dashboardResponse, weakTopicsResponse] = await Promise.all([
        api.get('/analytics/student-dashboard'),
        api.get('/analytics/weak-topics')
      ])

      const data = dashboardResponse.data
      setTopicPerformance(data.topicPerformance || [])
      setProgressOverTime(data.progressOverTime || [])
      setOverallStats(data.overallStats || {})
      setWeakTopics(weakTopicsResponse.data || [])
    } catch (error) {
      toast.error('Failed to load dashboard data')
      console.error('Dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Strong': return 'text-green-600'
      case 'Moderate': return 'text-yellow-600'
      case 'Weak': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Strong': return <TrendingUp className="w-4 h-4" />
      case 'Moderate': return <AlertTriangle className="w-4 h-4" />
      case 'Weak': return <TrendingDown className="w-4 h-4" />
      default: return <BookOpen className="w-4 h-4" />
    }
  }

  const pieData = overallStats ? [
    { name: 'Correct', value: overallStats.totalCorrectAnswers },
    { name: 'Incorrect', value: overallStats.totalQuestionsAnswered - overallStats.totalCorrectAnswers }
  ] : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your learning dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Learning Dashboard</h1>
          <p className="mt-2 text-gray-600">Track your progress and identify areas for improvement</p>
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Exams</p>
                <p className="text-2xl font-semibold text-gray-900">{overallStats?.totalExams || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Average Score</p>
                <p className="text-2xl font-semibold text-gray-900">{overallStats?.averageScore || 0}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Exams Passed</p>
                <p className="text-2xl font-semibold text-gray-900">{overallStats?.examsPassed || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-lg p-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Weak Topics</p>
                <p className="text-2xl font-semibold text-gray-900">{weakTopics.filter(t => t.status === 'Critical' || t.status === 'Needs Improvement').length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Topic Performance Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Topic</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topicPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="topic" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Progress Over Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#10b981" name="Score %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Accuracy Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Accuracy</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Topic Performance Table */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Topic Performance Details</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topicPerformance.map((topic, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{topic.topic}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{topic.accuracy}%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(topic.status)}`}>
                          {getStatusIcon(topic.status)}
                          {topic.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Weak Topics Analysis */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Areas for Improvement</h2>
          {weakTopics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weakTopics.map((topic, index) => (
                <div key={index} className={`border rounded-lg p-4 ${
                  topic.status === 'Critical' ? 'border-red-200 bg-red-50' :
                  topic.status === 'Needs Improvement' ? 'border-yellow-200 bg-yellow-50' :
                  'border-green-200 bg-green-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{topic.topic}</h3>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      topic.status === 'Critical' ? 'bg-red-100 text-red-800' :
                      topic.status === 'Needs Improvement' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {topic.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Accuracy: {topic.accuracy}%</p>
                    <p>Questions: {topic.totalQuestionsAttempted}</p>
                    <p>Error Rate: {topic.errorRate}%</p>
                  </div>
                  {topic.status === 'Critical' && (
                    <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                      <strong>Recommendation:</strong> Focus on this topic urgently. Consider additional practice and review.
                    </div>
                  )}
                  {topic.status === 'Needs Improvement' && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                      <strong>Recommendation:</strong> Practice more questions in this area to improve understanding.
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Award className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">Great job! No weak topics identified. Keep up the excellent work!</p>
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI-Powered Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-800 mb-2">Strengths</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {topicPerformance.filter(t => t.status === 'Strong').slice(0, 3).map((topic, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Excellent performance in {topic.topic}
                  </li>
                ))}
                {topicPerformance.filter(t => t.status === 'Strong').length === 0 && (
                  <li className="text-gray-500">Continue practicing to build your strengths</li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-2">Recommendations</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {weakTopics.filter(t => t.status === 'Critical' || t.status === 'Needs Improvement').slice(0, 3).map((topic, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    Focus on improving {topic.topic} concepts
                  </li>
                ))}
                {weakTopics.filter(t => t.status === 'Critical' || t.status === 'Needs Improvement').length === 0 && (
                  <li className="text-gray-500">You're doing great! Consider exploring advanced topics</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
