import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4005/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    console.log('TOKEN DEBUG:', token ? 'Token found' : 'No token found')
    console.log('TOKEN DEBUG - Request URL:', config.url)
    console.log('TOKEN DEBUG - Request method:', config.method?.toUpperCase())
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('TOKEN DEBUG: Authorization header added')
    } else {
      console.log('TOKEN DEBUG: No Authorization header added')
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401) {
      console.log('TOKEN DEBUG: 401 Unauthorized received')
      console.log('TOKEN DEBUG - Request URL:', error.config?.url)
      console.log('TOKEN DEBUG - Has refresh token:', !!localStorage.getItem('refreshToken'))
      console.log('TOKEN DEBUG - Already retried:', !!originalRequest._retry)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      console.log('TOKEN DEBUG: Attempting token refresh...')

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          })
          
          const { accessToken } = response.data
          localStorage.setItem('accessToken', accessToken)
          console.log('TOKEN DEBUG: Token refresh successful')
          
          // Retry the original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } else {
          console.log('TOKEN DEBUG: No refresh token available')
        }
      } catch (refreshError) {
        console.log('TOKEN DEBUG: Token refresh failed, clearing auth data')
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
