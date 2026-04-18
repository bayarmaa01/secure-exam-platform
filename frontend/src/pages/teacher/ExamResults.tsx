import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'

interface Student {
  id: string
  name: string
  email: string
  registration_number?: string
}

interface ExamResult {
  studentId: string
  studentName: string
  studentEmail: string
  score: number
  totalPoints: number
  percentage: number
  status: string
  submittedAt?: string
}

interface Exam {
  id: string
  title: string
  description: string
  courseName: string
  durationMinutes: number
  startTime: string
  endTime: string
  status: string
}

export default function ExamResults() {
  const { examId } = useParams<{ examId: string }>()
  const [exam, setExam] = useState<Exam | null>(null)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)

  const fetchExamData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch exam details
      const examResponse = await api.get(`/exams/${examId}`).catch(err => {
        console.error('Exam API error:', err)
        return { data: null }
      })
      
      // Fetch all enrolled students for this exam's course
      const studentsResponse = await api.get(`/teacher/students`).catch(err => {
        console.error('Students API error:', err)
        return { data: [] }
      })
      
      // Fetch exam results
      const resultsResponse = await api.get(`/exams/${examId}/results`).catch(err => {
        console.error('Results API error:', err)
        return { data: [] }
      })
      
      const examData = examResponse.data
      const studentsData = Array.isArray(studentsResponse.data) ? studentsResponse.data : studentsResponse.data?.data || []
      const resultsData = Array.isArray(resultsResponse.data) ? resultsResponse.data : resultsResponse.data?.data || []
      
      setExam(examData)
      setAllStudents(studentsData)
      setExamResults(resultsData)
    } catch (error) {
      console.error('Failed to fetch exam data:', error)
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    if (examId) {
      fetchExamData()
    }
  }, [examId, fetchExamData])

  // Combine students with results
  const studentsWithResults = allStudents.map(student => {
    const result = examResults.find(r => r.studentId === student.id)
    return {
      ...student,
      score: result?.score || 0,
      totalPoints: result?.totalPoints || 0,
      percentage: result?.percentage || 0,
      status: result?.status || 'not_attended',
      submittedAt: result?.submittedAt
    }
  })

  const attendedStudents = studentsWithResults.filter(s => s.status !== 'not_attended')
  const notAttendedStudents = studentsWithResults.filter(s => s.status === 'not_attended')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exam results...</p>
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Exam not found</h2>
            <Link
              to="/teacher/results"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600">{exam.courseName}</p>
            </div>
            <Link
              to="/teacher/results"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Exam Info */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Duration</p>
                <p className="text-lg font-semibold">{exam.durationMinutes} minutes</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Start Time</p>
                <p className="text-lg font-semibold">{new Date(exam.startTime).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">End Time</p>
                <p className="text-lg font-semibold">{new Date(exam.endTime).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  exam.status === 'completed' ? 'bg-green-100 text-green-800' :
                  exam.status === 'published' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {exam.status}
                </span>
              </div>
            </div>
          </div>

          {/* Students Results */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Student Results</h3>
                <div className="flex space-x-4">
                  <span className="text-sm text-gray-600">
                    Total: {studentsWithResults.length}
                  </span>
                  <span className="text-sm text-green-600">
                    Attended: {attendedStudents.length}
                  </span>
                  <span className="text-sm text-red-600">
                    Not Attended: {notAttendedStudents.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentsWithResults.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {student.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {student.registration_number || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.score}/{student.totalPoints}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          student.percentage >= 50 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {student.percentage.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.status === 'passed' ? 'bg-green-100 text-green-800' :
                          student.status === 'failed' ? 'bg-red-100 text-red-800' :
                          student.status === 'not_attended' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {student.status === 'not_attended' ? 'Not Attended' : 
                           student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.submittedAt ? new Date(student.submittedAt).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
