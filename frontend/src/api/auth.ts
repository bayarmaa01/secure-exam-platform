import api from './client'

export interface User {
  id: string
  email: string
  name: string
  role: 'student' | 'admin'
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', { email, password })
    return data
  },
  register: async (email: string, password: string, name: string) => {
    const { data } = await api.post<{ accessToken: string; refreshToken: string; user: User }>('/auth/register', { email, password, name })
    return data
  },
  me: async () => {
    const { data } = await api.get<User>('/auth/me')
    return data
  },
  refresh: async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    const { data } = await api.post<{ accessToken: string }>('/auth/refresh', { refreshToken })
    return data.accessToken
  }
}
