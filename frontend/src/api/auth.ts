import api from './index'

export interface User {
  id: string
  email: string
  name: string
  role: 'student' | 'teacher' | 'admin'
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  role: 'student' | 'teacher'
  studentId?: string
  teacherId?: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export const authService = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data)
    return response.data
  },
  
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data)
    return response.data
  },
  
  refreshToken: async (refreshToken: string): Promise<string> => {
    const response = await api.post<{ accessToken: string }>('/auth/refresh', { refreshToken })
    return response.data.accessToken
  },
  
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me')
    return response.data
  },
  
  logout: (): void => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    window.location.href = '/login'
  }
}
