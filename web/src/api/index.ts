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

// ===== 公开（前端投递） =====
export const api = {
  jobs: () => http.get<Job[]>('api/jobs'),
  job: (slug: string) => http.get<Job>(`api/jobs/${slug}`),
  apply: (slug: string, body: { name?: string; contact: string; resume_url?: string; note?: string }) =>
    http.post(`api/jobs/${slug}/apply`, body),
  health: () => http.get<any>('api/health'),

  // ===== 管理端（需 x-admin-token） =====
  adminJobs: (token: string) => http.get<Job[]>('api/admin/jobs', { headers: { 'x-admin-token': token } }),
  adminCreateJob: (token: string, body: Record<string, unknown>) =>
    http.post('api/admin/jobs', body, { headers: { 'x-admin-token': token } }),
  adminUpdateJob: (token: string, id: number, body: Record<string, unknown>) =>
    http.put(`api/admin/jobs/${id}`, body, { headers: { 'x-admin-token': token } }),
  adminDeleteJob: (token: string, id: number) =>
    http.delete(`api/admin/jobs/${id}`, { headers: { 'x-admin-token': token } }),
  adminApplications: (token: string, status = '') =>
    http.get<Application[]>(
      `api/admin/applications${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      { headers: { 'x-admin-token': token } },
    ),
  adminPassApplication: (token: string, id: number) =>
    http.post(`api/admin/applications/${id}/pass`, {}, { headers: { 'x-admin-token': token }, timeout: 20_000 }),
  adminRejectApplication: (token: string, id: number, note = '') =>
    http.post(`api/admin/applications/${id}/reject`, { note }, { headers: { 'x-admin-token': token } }),
  adminRefreshOa: (token: string) =>
    http.post(`api/admin/applications/refresh-oa`, {}, { headers: { 'x-admin-token': token }, timeout: 30_000 }),
  adminStats: (token: string) =>
    http.get<any>('api/admin/stats', { headers: { 'x-admin-token': token } }),
}
