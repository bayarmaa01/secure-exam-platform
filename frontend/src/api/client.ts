import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor - add auth token and debug logging
let requestCount = 0
const resetRequestCount = () => {
  requestCount = 0
  console.log('DEBUG: Reset request count to 0')
}

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken')
  
  requestCount++
  console.log('DEBUG: Axios request interceptor:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    hasAccessToken: !!token,
    hasRefreshToken: !!refreshToken,
    tokenLength: token?.length || 0,
    requestCount: requestCount
  })
  
  // Warn if too many requests
  if (requestCount > 50) {
    console.warn('WARNING: High request frequency detected! Request count:', requestCount)
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    console.log('DEBUG: Authorization header set with token')
  } else {
    console.log('DEBUG: No access token found in localStorage')
  }
  
  return config
})

// Response interceptor - handle token refresh and debug logging
client.interceptors.response.use(
  (res) => {
    console.log('DEBUG: Axios response success:', {
      method: res.config.method?.toUpperCase(),
      url: res.config.url,
      status: res.status
    })
    return res
  },
  async (err) => {
    const original = err.config
    console.log('DEBUG: Axios response error:', {
      method: original.method?.toUpperCase(),
      url: original.url,
      status: err.response?.status,
      message: err.message,
      isRetry: !!original._retry
    })
    
    // Handle 429 Too Many Requests with retry logic
    if (err.response?.status === 429 && !original._retry) {
      console.log('DEBUG: 429 Too Many Requests, implementing retry with backoff')
      
      // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s
      const retryCount = original._retryCount || 0
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 16000) // Max 16 seconds
      
      original._retry = true
      original._retryCount = (retryCount || 0) + 1
      
      console.log(`DEBUG: Retrying in ${backoffTime}ms (attempt ${retryCount + 1})`)
      
      setTimeout(() => {
        return client(original)
      }, backoffTime)
      
      return Promise.reject(err)
    }
    
    if (err.response?.status === 401 && !original._retry) {
      console.log('DEBUG: 401 Unauthorized detected, attempting token refresh')
      original._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      
      if (refreshToken) {
        console.log('DEBUG: Refresh token found, attempting refresh')
        try {
          console.log('DEBUG: Calling /auth/refresh endpoint')
          const { data } = await axios.post(baseURL + '/auth/refresh', { refreshToken })
          
          console.log('DEBUG: Token refresh successful, updating localStorage')
          localStorage.setItem('accessToken', data.accessToken)
          
          // Update the original request with new token
          original.headers.Authorization = `Bearer ${data.accessToken}`
          console.log('DEBUG: Retrying original request with new token')
          
          return client(original)
        } catch (refreshError) {
          console.error('DEBUG: Token refresh failed:', refreshError)
          console.log('DEBUG: Clearing tokens and redirecting to login')
          
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
        }
      } else {
        console.log('DEBUG: No refresh token available, redirecting to login')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
    }
    
    return Promise.reject(err)
  }
)

export default client
