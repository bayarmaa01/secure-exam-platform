import api from './index'

export interface User {
  id: string
  email: string
  name: string
  role: 'student' | 'teacher' | 'admin'
  registration_number?: string
}

export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  role: 'student' | 'teacher'
  registration_number?: string
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
  
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email })
    return response.data
  },
  
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/reset-password', { token, newPassword })
    return response.data
  },
  
  logout: (): void => {
    console.log('DEBUG: authService logout - clearing tokens')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }
}
