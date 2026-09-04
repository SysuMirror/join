import { http } from './http'

export interface Job {
  id: number
  slug: string
  title: string
  department: string
  location: string
  type: 'fulltime' | 'intern' | 'parttime'
  summary: string
  description: string
  headcount: number
  enabled: number
  createdAt: string
}

export interface Application {
  id: number
  jobId: number
  job_title?: string
  name: string
  contact: string
  resume_url: string
  note: string
  status: 'pending' | 'passed' | 'rejected'
  review_note: string
  oa_oid: string
  oa_status: string
  oa_checked_at: string
  oa_timeline: { action: string; by?: string; viaModule?: string; note?: string; at: string }[]
  createdAt: string
  updatedAt: string
  jobTitle: string
  jobSlug: string
  jobDepartment: string
  /** 后端 mapApplication 额外透出的快照（兼容） */
  oaTimeline?: { action: string; by?: string; viaModule?: string; note?: string; at: string }[]
}

export interface AuthUser {
  id: number
  email: string
  name: string
  is_admin: boolean
}

export interface SiteConfig {
  brand: string
  heroTitle: string
  heroSubtitle: string
  announcement: string
  tagline: string
  contactEmail: string
  bgWords: string
  updatedAt: string
}

function authConfig(token: string): Record<string, unknown> {
  return { headers: { Authorization: `Bearer ${token}` } }
}

// ===== 公开（前端投递） =====
export const api = {
  jobs: () => http.get<Job[]>('api/jobs'),
  job: (slug: string) => http.get<Job>(`api/jobs/${slug}`),
  site: () => http.get<SiteConfig>('api/site'),
  apply: (slug: string, body: { name?: string; contact: string; resume_url?: string; note?: string }) =>
    http.post(`api/jobs/${slug}/apply`, body),
  health: () => http.get<any>('api/health'),

  // ===== 认证 =====
  sendCode: (email: string, purpose: 'login' | 'register' = 'login') =>
    http.post(`api/auth/code`, { email, purpose }),
  login: (email: string, code: string) => http.post<any>('api/auth/login', { email, code }),
  register: (email: string, code: string, name: string) => http.post<any>('api/auth/register', { email, code, name }),
  me: (token: string) => http.get<AuthUser>('api/auth/me', authConfig(token)),
  logout: () => http.post('api/auth/logout'),

  // ===== 管理端（需登录会话 Bearer token） =====
  adminJobs: (token: string) => http.get<Job[]>('api/admin/jobs', authConfig(token)),
  adminCreateJob: (token: string, body: Record<string, unknown>) =>
    http.post('api/admin/jobs', body, authConfig(token)),
  adminUpdateJob: (token: string, id: number, body: Record<string, unknown>) =>
    http.put(`api/admin/jobs/${id}`, body, authConfig(token)),
  adminDeleteJob: (token: string, id: number) =>
    http.delete(`api/admin/jobs/${id}`, authConfig(token)),
  adminApplications: (token: string, status = '') =>
    http.get<Application[]>(
      `api/admin/applications${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      authConfig(token),
    ),
  adminPassApplication: (token: string, id: number) =>
    http.post(`api/admin/applications/${id}/pass`, {}, { ...authConfig(token), timeout: 20_000 }),
  adminRejectApplication: (token: string, id: number, note = '') =>
    http.post(`api/admin/applications/${id}/reject`, { note }, authConfig(token)),
  adminRefreshOa: (token: string) =>
    http.post(`api/admin/applications/refresh-oa`, {}, { ...authConfig(token), timeout: 30_000 }),
  adminStats: (token: string) =>
    http.get<any>('api/admin/stats', authConfig(token)),
  adminSite: (token: string) => http.get<SiteConfig>('api/admin/site', authConfig(token)),
  adminUpdateSite: (token: string, body: Partial<SiteConfig>) =>
    http.put<SiteConfig>('api/admin/site', body, authConfig(token)),
}
