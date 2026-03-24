import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' }
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const { data } = await axios.post(baseURL + '/auth/refresh', { refreshToken })
          localStorage.setItem('accessToken', data.accessToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return client(original)
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default client
