import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { coursesApi, Course, Student } from '../../api/courses'

export default function Courses() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseStudents, setCourseStudents] = useState<Student[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [enrollData, setEnrollData] = useState({
    student_id: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const data = await coursesApi.getTeacherCourses()
      setCourses(data)
    } catch (error) {
      console.error('Failed to fetch courses:', error)
      setError('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError('')
      const newCourse = await coursesApi.createCourse(formData)
      setCourses([...courses, newCourse])
      setSuccess('Course created successfully!')
      setFormData({ name: '', description: '' })
      setShowCreateModal(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Failed to create course')
    }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course? This will also delete all exams and enrollments.')) {
      return
    }
    
    try {
      setError('')
      await coursesApi.deleteCourse(courseId)
      setCourses(courses.filter(c => c.id !== courseId))
      setSuccess('Course deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Failed to delete course')
    }
  }

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError('')
      await coursesApi.enrollStudent(selectedCourse!.id, enrollData)
      setSuccess('Student enrolled successfully!')
      setEnrollData({ student_id: '' })
      setShowEnrollModal(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Failed to enroll student')
    }
  }

  const handleViewStudents = async (course: Course) => {
    try {
      setError('')
      const students = await coursesApi.getCourseStudents(course.id)
      setCourseStudents(students)
      setSelectedCourse(course)
      setShowEnrollModal(true)
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Failed to fetch students')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading courses...</p>
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
              <Link to="/teacher/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
                &larr; Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name}</span>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Course
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Alerts */}
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Courses Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <div key={course.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewStudents(course)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Manage Students"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Course"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-4">{course.description || 'No description'}</p>
                
                <div className="flex justify-between text-sm text-gray-500 mb-4">
                  <span>{course.exam_count || 0} exams</span>
                  <span>{course.student_count || 0} students</span>
                </div>
                
                <div className="flex space-x-2">
                  <Link
                    to={`/teacher/create-exam?courseId=${course.id}`}
                    className="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded hover:bg-blue-700 transition-colors"
                  >
                    Create Exam
                  </Link>
                  <Link
                    to={`/teacher/exams?courseId=${course.id}`}
                    className="flex-1 bg-gray-600 text-white text-center py-2 px-4 rounded hover:bg-gray-700 transition-colors"
                  >
                    View Exams
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {courses.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No courses found</div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Your First Course
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Course</h2>
            <form onSubmit={handleCreateCourse}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Course Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {showEnrollModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Manage Students - {selectedCourse.name}</h2>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            {/* Enroll New Student */}
            <form onSubmit={handleEnrollStudent} className="mb-6">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={enrollData.student_id}
                  onChange={(e) => setEnrollData({ student_id: e.target.value })}
                  placeholder="Enter Student ID (e.g., STU001)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Enroll Student
                </button>
              </div>
            </form>

            {/* Current Students */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Enrolled Students ({courseStudents.length})</h3>
              {courseStudents.length === 0 ? (
                <p className="text-gray-500">No students enrolled yet</p>
              ) : (
                <div className="space-y-2">
                  {courseStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                      <div className="text-sm font-medium text-gray-700">{student.student_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
