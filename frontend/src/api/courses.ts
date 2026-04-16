import api from './index'

export interface Course {
  id: string
  name: string
  description: string
  teacher_id: string
  teacher_name?: string
  created_at: string
  updated_at: string
  exam_count?: number
  student_count?: number
}

export interface CreateCourseRequest {
  name: string
  description?: string
}

export interface EnrollStudentRequest {
  registration_number: string
}

export interface Student {
  id: string
  name: string
  email: string
  student_id: string
  enrolled_at: string
}

export const coursesApi = {
  // Teacher: Get own courses
  getTeacherCourses: async (): Promise<Course[]> => {
    const response = await api.get('/teacher/courses')
    return response.data
  },

  // Teacher: Create course
  createCourse: async (data: CreateCourseRequest): Promise<Course> => {
    const response = await api.post('/courses', data)
    return response.data
  },

  // Teacher: Delete course
  deleteCourse: async (courseId: string): Promise<void> => {
    await api.delete(`/courses/${courseId}`)
  },

  // Teacher: Enroll student in course
  enrollStudent: async (courseId: string, data: EnrollStudentRequest): Promise<void> => {
    await api.post(`/courses/${courseId}/enroll`, data)
  },

  // Teacher: Get students in course
  getCourseStudents: async (courseId: string): Promise<Student[]> => {
    const response = await api.get(`/courses/${courseId}/students`)
    return response.data
  },

  // Student: Get enrolled courses
  getStudentCourses: async (): Promise<Course[]> => {
    const response = await api.get('/student/courses')
    return response.data
  },

  // Admin: Get all courses
  getAllCourses: async (): Promise<Course[]> => {
    const response = await api.get('/admin/courses')
    return response.data
  }
}
