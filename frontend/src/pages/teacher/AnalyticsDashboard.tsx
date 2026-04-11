import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import { Users, TrendingUp, AlertTriangle, BookOpen, Target, Eye, Activity, Calendar, Award } from 'lucide-react'
import api from '../../api'
import toast from 'react-hot-toast'

interface TopicAnalysis {
  topic: string
  totalAnswers: number
  wrongAnswers: number
  errorRate: number
  studentsAttempted: number
  status: string
}

interface ClassMetrics {
  totalExams: number
  totalStudents: number
  totalQuestionsAnswered: number
  totalCorrectAnswers: number
  classAverage: number
  totalPasses: number
  passRate: number
}

interface WeakTopic {
  topic: string
  wrongAnswers: number
  totalAnswers: number
  errorRate: number
  strugglingStudents: number
  recommendation: string
  status: string
}

interface ProgressData {
  examName: string
  date: string
  score: number
}

interface LeaderboardEntry {
  id: string
  name: string
  studentId: string
  totalScore: number
  examsAttempted: number
  averageScore: number
  rank: number
}

export default function AnalyticsDashboard() {
  const [topicAnalysis, setTopicAnalysis] = useState<TopicAnalysis[]>([])
  const [classMetrics, setClassMetrics] = useState<ClassMetrics | null>(null)
  const [weakTopicsWithStudents, setWeakTopicsWithStudents] = useState<WeakTopic[]>([])
  const [progressData, setProgressData] = useState<ProgressData[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState('all')

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      
      const [overviewResponse, progressResponse, leaderboardResponse] = await Promise.all([
        api.get('/analytics/teacher-overview'),
        api.get('/analytics/progress-over-time'),
        api.get('/analytics/leaderboard?limit=10')
      ])
      
      const data = overviewResponse.data
      
      setTopicAnalysis(data.topicAnalysis || [])
      setClassMetrics(data.classMetrics || {})
      setWeakTopicsWithStudents(data.weakTopicsWithStudents || [])
      setProgressData(progressResponse.data || [])
      setLeaderboard(leaderboardResponse.data || [])
    } catch (error) {
      toast.error('Failed to load analytics data')
      console.error('Analytics error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Critical': return 'text-red-600'
      case 'Needs Improvement': return 'text-yellow-600'
      case 'Good': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Critical': return <AlertTriangle className="w-4 h-4" />
      case 'Needs Improvement': return <Eye className="w-4 h-4" />
      case 'Good': return <TrendingUp className="w-4 h-4" />
      default: return <BookOpen className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Teacher Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">Monitor class performance and identify improvement areas</p>
        </div>

        {/* Class Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Students</p>
                <p className="text-2xl font-semibold text-gray-900">{classMetrics?.totalStudents || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Class Average</p>
                <p className="text-2xl font-semibold text-gray-900">{classMetrics?.classAverage || 0}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <BookOpen className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Exams</p>
                <p className="text-2xl font-semibold text-gray-900">{classMetrics?.totalExams || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-lg p-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pass Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{classMetrics?.passRate || 0}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Topic Performance Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Topic Performance Analysis</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topicAnalysis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="topic" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="errorRate" fill="#ef4444" name="Error Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Performance Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Excellent (90-100%)', value: 25, color: '#10b981' },
                    { name: 'Good (70-89%)', value: 45, color: '#3b82f6' },
                    { name: 'Needs Improvement (50-69%)', value: 20, color: '#f59e0b' },
                    { name: 'Below 50%', value: 10, color: '#ef4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[{ name: 'Excellent (90-100%)', value: 25, color: '#10b981' },
                    { name: 'Good (70-89%)', value: 45, color: '#3b82f6' },
                    { name: 'Needs Improvement (50-69%)', value: 20, color: '#f59e0b' },
                    { name: 'Below 50%', value: 10, color: '#ef4444' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Progress Over Time and Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Class Progress Over Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Progress Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} name="Average Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Performers Leaderboard */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h2>
            <div className="space-y-3">
              {leaderboard.slice(0, 5).map((student, index) => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                    }`}>
                      {student.rank}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{student.name}</p>
                      <p className="text-sm text-gray-500">{student.studentId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{student.averageScore}%</p>
                    <p className="text-sm text-gray-500">{student.examsAttempted} exams</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weak Topics Analysis */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Topics Requiring Attention</h2>
          {weakTopicsWithStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Struggling Students</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weakTopicsWithStudents.map((topic, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{topic.topic}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{topic.errorRate}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{topic.strugglingStudents}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(topic.status)}`}>
                          {getStatusIcon(topic.status)}
                          {topic.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className={`p-2 rounded text-xs ${
                          topic.status === 'Critical' ? 'bg-red-100 text-red-800' :
                          topic.status === 'Needs Improvement' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {topic.recommendation}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">Excellent! All topics are performing well.</p>
            </div>
          )}
        </div>

        {/* Actionable Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Teaching Recommendations */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Teaching Recommendations</h2>
            <div className="space-y-3">
              {weakTopicsWithStudents.slice(0, 3).map((topic, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{topic.topic}</p>
                    <p className="text-xs text-gray-600">{topic.recommendation}</p>
                  </div>
                </div>
              ))}
              {weakTopicsWithStudents.length === 0 && (
                <p className="text-sm text-gray-600">Current teaching methods are effective. Continue with the same approach.</p>
              )}
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Suggested Actions</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="rounded text-blue-600" />
                <label className="text-sm text-gray-700">Review weak topics in next class</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="rounded text-blue-600" />
                <label className="text-sm text-gray-700">Create practice exercises for struggling topics</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="rounded text-blue-600" />
                <label className="text-sm text-gray-700">Schedule one-on-one sessions with struggling students</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="rounded text-blue-600" />
                <label className="text-sm text-gray-700">Prepare additional study materials</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
