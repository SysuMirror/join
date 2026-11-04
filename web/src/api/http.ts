import axios, { type AxiosInstance } from 'axios'

function resolveBase(): string {
  const api = (import.meta.env.VITE_API_BASE || '').trim()
  if (api) return api.endsWith('/') ? api : `${api}/`
  const raw = (import.meta.env.BASE_URL || '/').trim()
  return raw.endsWith('/') ? raw : `${raw}/`
}

const instance: AxiosInstance = axios.create({
  baseURL: resolveBase(),
  timeout: 60000,
  withCredentials: true,
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('join_session_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (resp) => {
    const body = resp.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return body.data
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body
  },
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      // 旧 token 失效时清掉，避免继续遮挡 Cookie 会话
      localStorage.removeItem('join_session_token')
    }
    const body = error.response?.data
    const message = body?.message || error.message || '网络错误'
    const err = new Error(message) as Error & { status?: number }
    err.status = status
    return Promise.reject(err)
  },
)

export const http = {
  get: <T = any>(url: string, config?: any) => instance.get(url, config) as unknown as Promise<T>,
  post: <T = any>(url: string, data?: any, config?: any) =>
    instance.post(url, data, config) as unknown as Promise<T>,
  put: <T = any>(url: string, data?: any, config?: any) =>
    instance.put(url, data, config) as unknown as Promise<T>,
  patch: <T = any>(url: string, data?: any, config?: any) =>
    instance.patch(url, data, config) as unknown as Promise<T>,
  delete: <T = any>(url: string, config?: any) => instance.delete(url, config) as unknown as Promise<T>,
}
