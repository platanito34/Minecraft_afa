import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  timeout: 15000,
})

// Inyectar token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirigir a login si el token expira
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
