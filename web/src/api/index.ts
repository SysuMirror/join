import { http } from './http'

// ===== 公共类型 =====

export type JobType = 'fulltime' | 'intern' | 'parttime'

export interface SiteStats {
  openJobs: number
  departments: number
  locations: number
  faqs: number
}

export interface SiteConfig {
  brand: string
  heroTitle: string
  heroSubtitle: string
  announcement: string
  tagline: string
  contactEmail: string
  bgWords: string
  teamTitle?: string
  teamIntro?: string
  teamHighlights?: string
  adminSubs?: string
  updatedAt: string
  stats?: SiteStats
  ssoEnabled?: boolean
}

export interface Department {
  id: number
  name: string
  slug: string
  summary: string
  description: string
  color: string
  /** 部门管理员邮箱（逗号分隔；旧数据兼容，界面不再使用） */
  admin_emails?: string
  admin_user_ids?: string
  adminUsers?: Array<{ id: number; name: string; email: string }>
  openJobs?: number
  directions?: string[]
  enabled?: number
  sort_order?: number
  jobCount?: number
  openJobCount?: number
  created_at?: string
  updated_at?: string
  head_user_id?: number
  base_seats?: number
  floating_seats?: number
  output_delivery?: number
  output_usage?: number
  output_talent?: number
  output_activity?: number
  output_note?: string
  head?: {
    id: number
    name: string
    avatar: string
    developer_no: string
    level: DeveloperLevel
  } | null
  seats?: {
    base: number
    floating: number
    total: number
    occupied: number
    available: number
    waitlist: number
  }
  output?: { delivery: number; usage: number; talent: number; activity: number; score: number; note: string }
  members?: number
  roundtable_members?: Array<{ id: number; name: string; avatar: string; developer_no: string; joined_at: string }>
}

export interface Job {
  id: number
  slug: string
  title: string
  department_id: number
  department: string
  department_slug: string
  direction: string
  location: string
  type: JobType
  experience: string
  education: string
  /** 社团场景下表示「时间投入」 */
  salary: string
  /** 咨询微信（可选） */
  contact_wechat: string
  /** 常驻招聘：报名信息完整时自动通过 */
  auto_approve?: boolean
  tags: string[]
  summary: string
  responsibilities: string
  requirements: string
  bonus: string
  description: string
  headcount: number
  enabled?: number
  sort_order?: number
  created_at?: string
  updated_at?: string
  createdAt: string
  updatedAt: string
  departmentInfo?: {
    id: number
    name: string
    slug: string
    summary: string
    description: string
    color: string
  } | null
  related?: Job[]
}

/** 管理端岗位：tags 为逗号分隔字符串（与前台公开接口不同） */
export interface AdminJob extends Omit<Job, 'tags'> {
  tags: string
  tagsArray: string[]
}

export interface JobMeta {
  directions: string[]
  locations: string[]
  types: JobType[]
  departments: Array<{
    id: number
    name: string
    slug: string
    summary: string
    color: string
    openJobs: number
  }>
}

export interface HistoryChapter {
  id: number
  kicker: string
  title: string
  summary: string
  era: string
  content: string
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

export interface HallOfFameMember {
  id: number
  /** 关联的系统注册用户 id */
  user_id: number
  name: string
  avatar: string
  title: string
  department: string
  year: string
  quote: string
  bio: string
  achievements: string
  /** 1 = 本人通过邀请填写；寄语/自我介绍对管理员锁定 */
  user_submitted: number
  market_url: string
  contact_email: string
  contact_wechat: string
  contact_other: string
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

export interface HallUserSummary {
  id: number
  name: string
  email: string
  avatar: string
  developer_no: string
  developer_level: DeveloperLevel
  sso_sub?: string
}

export interface AdminHallOfFameMember extends HallOfFameMember {
  /** 管理员自定义头像；空字符串表示跟随系统用户头像 */
  custom_avatar: string
  user: HallUserSummary | null
}

export interface HistorySettings {
  title: string
  subtitle: string
  hall_title: string
  hall_intro: string
  updated_at?: string
}

export interface HistoryDocument {
  settings: HistorySettings
  chapters: HistoryChapter[]
  hallOfFame: HallOfFameMember[]
  updatedAt: string
}

export interface HallInvite {
  id: number
  user_id: number
  token: string
  department: string
  title: string
  status: 'pending' | 'submitted' | 'revoked'
  expires_at: string
  created_by: string
  created_at: string
  sent_at: string
  submitted_at: string
}

export interface AdminHallInvite extends HallInvite {
  expired: boolean
  link: string
  user: {
    id: number
    name: string
    email: string
    avatar: string
    developer_no: string
  } | null
}

export interface AdminHistoryMeta {
  departments: string[]
  mailConfigured: boolean
}

export interface SsoUserSummary {
  /** 已在本平台注册时返回本地用户 id；未注册为 0 */
  user_id: number
  sso_sub: string
  name: string
  email: string
  avatar: string
  developer_no: string
  student_id: string
  internal: boolean
  active: boolean
  registered: boolean
}

export interface SsoUserDirectory {
  users: SsoUserSummary[]
  ssoAvailable: boolean
  warning: string
  cachedAt?: string
  stale?: boolean
}

/** 后台用户目录（SSO 缓存 + 本地账号合并） */
export interface DirectoryUser {
  user_id: number
  sso_sub: string
  name: string
  email: string
  avatar: string
  developer_no: string
  developer_level: DeveloperLevel
  student_id: string
  internal: boolean
  active: boolean
  registered: boolean
}

export interface DirectoryPage {
  users: DirectoryUser[]
  cachedAt: string
  stale: boolean
  warning: string
}

export interface BatchInviteResult {
  results: Array<{
    ok: boolean
    index: number
    user?: { id: number; name: string; email: string }
    auto_created?: boolean
    invite?: AdminHallInvite
    link?: string
    emailSent?: boolean
    error?: string
  }>
  success: number
  failed: number
  emailSent: number
}

export interface HallInviteInfo {
  invite: {
    token: string
    department: string
    title: string
    status: HallInvite['status']
    expires_at: string
  }
  user: {
    id: number
    name: string
    email: string
    avatar: string
    developer_no: string
  }
  entry: HallOfFameMember | null
  departments: string[]
}

export interface Faq {
  id: number
  category: string
  question: string
  answer: string
  sort_order: number
  enabled?: number
  created_at?: string
  updated_at?: string
}

export interface Resume {
  id: number
  title: string
  name: string
  phone: string
  email: string
  city: string
  intention: string
  /** 年级（大一/大二/…） */
  grade: string
  education: string
  school: string
  major: string
  graduation_year: string
  experience_years: number
  skills: string
  summary: string
  work_experience: string
  project_experience: string
  education_experience: string
  file_name: string
  file_size: number
  has_file: boolean
  parse_note: string
  parsed_text?: string
  /** 基本信息/联系方式/教育/经历是否达到自动通过要求 */
  complete?: boolean
  missing_fields?: string[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ResumeSnapshot {
  title?: string
  name?: string
  phone?: string
  email?: string
  city?: string
  intention?: string
  grade?: string
  education?: string
  school?: string
  major?: string
  graduation_year?: string
  experience_years?: number
  skills?: string
  summary?: string
  work_experience?: string
  project_experience?: string
  education_experience?: string
  file_name?: string
}

export interface TimelineEvent {
  action: string
  by?: string
  viaModule?: string
  note?: string
  at: string
}

export type DeveloperLevel = 'market' | 'project' | 'roundtable'
export type ApplicationStage = 'submitted' | 'interview' | 'offered' | 'joined' | 'rejected' | 'withdrawn'

export interface Application {
  id: number
  job_id: number
  jobTitle: string
  jobSlug: string
  department: string
  location: string
  direction: string
  name: string
  contact: string
  email: string
  phone: string
  /** 报名同学填写的微信号（可选） */
  wechat: string
  note: string
  status: 'pending' | 'passed' | 'rejected'
  stage: ApplicationStage
  interview_at: string
  interview_note: string
  confirmed_at: string
  joined_at: string
  review_note: string
  oa_status: string
  oa_oid: string
  oa_timeline: TimelineEvent[]
  resume_id: number
  resume_title: string
  resume_file_name: string
  snapshot: ResumeSnapshot
  created_at: string
  updated_at: string
}

export interface AdminApplication extends Application {
  userEmail: string
  userName: string
  jobDepartment: string
  jobLocation: string
  /** 管理端返回的简历标题/文件名（camelCase） */
  resumeTitle: string
  resumeFileName: string
  resumeText?: string
  oaTimeline: TimelineEvent[]
}

export interface AuthUser extends DeveloperIdentity {
  provider: string
  internal: boolean
  roles: string[]
  is_admin: boolean
  /** 有后台权限（超级管理员 / 部门管理员 / 资源方代表） */
  is_staff?: boolean
}

export interface DeveloperIdentity {
  id: number
  name: string
  email: string
  avatar: string
  developer_no: string
  developer_level: DeveloperLevel
  level_label: string
  status: 'active' | 'exited'
  department: { id: number; name: string; slug: string; color: string } | null
  department_joined_at: string
  roundtable_joined_at: string
  developer_bio: string
  developer_skills: string[]
  developer_links: string[]
  /** 是否已同步 UniSSO 的开发者权限 */
  sso_developer?: boolean
  sso_developer_at?: string
  system_role: 'user' | 'super_admin'
  reviewer_role: '' | 'resource'
  is_super_admin: boolean
  is_resource_reviewer: boolean
  is_department_admin: boolean
  admin_departments: Array<{ id: number; name: string; slug: string }>
  head_departments: Array<{ id: number; name: string; slug: string }>
}

export interface DefenseReview {
  id: number
  level: number
  reviewer_user_id: number
  reviewer_name: string
  role_label: string
  status: 'pending' | 'submitted'
  decision: '' | 'fact' | 'approve' | 'reject' | 'abstain'
  score: number
  opinion: string
  is_fact_only: boolean
  submitted_at: string
  created_at: string
}

export interface Defense {
  id: number
  applicant_user_id: number
  department_id: number
  department_name: string
  title: string
  statement: string
  proposal: string
  achievements: string
  status: 'submitted' | 'level1' | 'level2' | 'level3' | 'waitlist' | 'passed' | 'rejected' | 'withdrawn'
  current_level: number
  final_result: '' | 'passed' | 'rejected' | 'waitlist'
  final_note: string
  decided_by: string
  decided_at: string
  created_at: string
  updated_at: string
  applicant: DeveloperIdentity | null
  department: { id: number; name: string; slug: string; color: string } | null
  seat: { total: number; occupied: number; available: number; waitlist: number }
  reviews: DefenseReview[]
  my_pending_reviews?: DefenseReview[]
}

export interface PendingReview {
  review_id: number
  level: number
  role_label: string
  defense_id: number
  title: string
  applicant_name: string
  department_name: string
  status: string
  created_at: string
}

export interface MyDeveloperProfile extends DeveloperIdentity {
  seat: { total: number; occupied: number; available: number; waitlist: number } | null
  defenses: Defense[]
  pending_reviews: PendingReview[]
  memberships: Array<{
    id: number
    department_id: number
    department: string
    role: 'member' | 'head'
    status: 'active' | 'left'
    joined_at: string
    left_at: string
    note: string
  }>
}

export interface AdminUser extends DeveloperIdentity {
  last_login_at: string
  created_at: string
  provider: string
  avatar: string
}

export interface AdminUserDetail extends AdminUser {
  memberships: Array<Record<string, unknown>>
  defenses: Defense[]
  reviews: DefenseReview[]
  seat_reviews: SeatReview[]
}

export interface SeatReview {
  id: number
  user_id: number
  department_id: number
  year: number
  output_score: number
  passed: number
  result: 'kept' | 'exited'
  note: string
  reviewer: string
  decided_at: string
  created_at: string
  updated_at: string
}

export interface OrgDepartment {
  id: number
  name: string
  slug: string
  summary: string
  description: string
  color: string
  enabled: number
  sort_order: number
  head: { id: number; name: string; avatar: string; developer_no: string; level: DeveloperLevel } | null
  seats: { base: number; floating: number; total: number; occupied: number; available: number; waitlist: number }
  output: { delivery: number; usage: number; talent: number; activity: number; score: number; note: string }
  members: number
  roundtable_members: Array<{ id: number; name: string; avatar: string; developer_no: string; joined_at: string }>
  member_list?: Array<{
    id: number
    name: string
    avatar: string
    developer_no: string
    developer_level: DeveloperLevel
    level_label: string
    developer_bio: string
    developer_skills: string[]
  }>
}

export interface PublicitySeat {
  department_id: number
  department_name: string
  base: number
  floating: number
  total: number
  delivery: number
  usage: number
  talent: number
  activity: number
}

export interface PublicityPromotion {
  user_id: number
  name: string
  developer_no: string
  department_name: string
  result: string
  note: string
}

export interface Publicity {
  id: number
  title: string
  meeting_date: string
  summary: string
  content: string
  published: boolean
  created_by: string
  created_at: string
  updated_at: string
  seats: PublicitySeat[]
  promotions: PublicityPromotion[]
}

export interface PublicitySummary {
  id: number
  title: string
  meeting_date: string
  summary: string
  created_at: string
  seats: number
  promotions: number
}

export interface OrgOverview {
  levels: Array<{ key: DeveloperLevel; name: string; short: string; description: string }>
  process: Array<{ step: number; title: string; detail: string }>
  stats: {
    developers: number
    market: number
    project: number
    roundtable: number
    departments: number
    seats: number
    seatsOccupied: number
    activeDefenses: number
    passedDefenses: number
  }
  departments: OrgDepartment[]
  roundtable: Array<{
    id: number
    name: string
    avatar: string
    developer_no: string
    department: { id: number; name: string; color: string } | null
    joined_at: string
  }>
}

export interface RoundtableData {
  seats: Array<{
    department: { id: number; name: string; slug: string; color: string }
    total: number
    occupied: number
    available: number
    waitlist: number
    members: number
    base: number
    floating: number
  }>
  members: Array<AdminUser & { last_review: SeatReview | null }>
  waitlist: Defense[]
  seat_reviews: SeatReview[]
}

export interface AdminSession {
  global: boolean
  resourceReviewer: boolean
  user: {
    id: number
    email: string
    name: string
    avatar: string
    is_admin: boolean
    identity?: DeveloperIdentity
  } | null
  departments: Array<{
    id: number
    name: string
    slug: string
    admin_emails: string
    head_user_id: number
    base_seats: number
    floating_seats: number
  }>
  head_departments: Array<{ id: number; name: string; slug: string }>
  permissions: {
    departments: boolean
    departmentAdmins: boolean
    users: boolean
    defenses: boolean
    roundtable: boolean
    faqs: boolean
    site: boolean
    history: boolean
    jobs: boolean
    applications: boolean
  }
}

export interface UploadResumeResult {
  resume: Resume
  parsed: Partial<Resume> | null
  pages: number
  warning: string
}

export interface AdminStats {
  jobs: number
  openJobs: number
  departments: number
  applications: number
  pendingReview: number
  offered: number
  joined: number
  passed: number
  rejected: number
  oaApproved: number
  users: number
  developers: number
  roundtable: number
  defenses: number
  defensesOpen: number
  defensesPassed: number
  resumes: number
  faqs: number
}

export interface MeOverview {
  resumes: number
  applications: number
  pending: number
  passed: number
  rejected: number
}

export interface JoinTeamStatus {
  ready: boolean
  resume_id: number
  missing_fields: string[]
  sso_developer: boolean
  sso_developer_at: string
  email: string
}

export interface JoinTeamResult {
  developer: boolean
  identity: DeveloperIdentity
  resume_id: number
  sso_developer_at: string
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)))
    else sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// ===== 公开接口 =====
export const api = {
  site: () => http.get<SiteConfig>('api/site'),
  departments: () => http.get<Department[]>('api/departments'),
  department: (slug: string) => http.get<Department>(`api/departments/${encodeURIComponent(slug)}`),
  jobs: (params: Record<string, unknown> = {}) => http.get<Job[]>(`api/jobs${qs(params)}`),
  jobMeta: () => http.get<JobMeta>('api/jobs/meta'),
  job: (key: string | number) => http.get<Job>(`api/jobs/${encodeURIComponent(String(key))}`),
  faqs: (params: Record<string, unknown> = {}) => http.get<Faq[]>(`api/faqs${qs(params)}`),
  history: () => http.get<HistoryDocument>('api/history'),
  hallInvite: (token: string) =>
    http.get<HallInviteInfo>(`api/history/invite/${encodeURIComponent(token)}`),
  submitHallInvite: (token: string, body: Record<string, unknown>) =>
    http.post<{ entry: HallOfFameMember; message: string }>(
      `api/history/invite/${encodeURIComponent(token)}`,
      body,
    ),
  apply: (key: string | number, body: { resume_id: number; note?: string; wechat?: string }) =>
    http.post(`api/jobs/${encodeURIComponent(String(key))}/apply`, body),
  health: () => http.get<any>('api/health'),

  // ===== 管理体系公开数据 =====
  orgOverview: () => http.get<OrgOverview>('api/org/overview'),
  orgDepartment: (slug: string) => http.get<OrgDepartment>(`api/org/departments/${encodeURIComponent(slug)}`),
  orgRecentDefenses: () => http.get<Array<Record<string, unknown>>>('api/org/defenses/recent'),
  orgPublicities: () => http.get<PublicitySummary[]>('api/org/publicities'),
  orgPublicity: (id: number) => http.get<Publicity>(`api/org/publicities/${id}`),

  // ===== 认证 =====
  /** 初始会话探测：匿名时返回 { user: null }（HTTP 200） */
  session: () => http.get<{ user: AuthUser | null }>('api/auth/session'),
  me: () => http.get<AuthUser>('api/auth/me'),
  login: (email: string, password: string) =>
    http.post<{ token: string; user: AuthUser }>('api/auth/login', { email, password }),
  /** 静默 SSO：浏览器带父域 sse_sso Cookie，成功后返回与管理员密码登录相同结构 */
  ssoTry: () => http.post<{ token: string; user: AuthUser }>('api/auth/sso/try'),
  logout: () => http.post('api/auth/logout'),
  /** 浏览器直接跳转的 SSO 入口（后端 302 到 UniSSO） */
  ssoStartUrl: (returnTo = '/me') =>
    `/api/auth/sso/start?returnTo=${encodeURIComponent(returnTo)}`,

  // ===== 个人中心 / 开发者身份 =====
  myOverview: () => http.get<MeOverview>('api/me/overview'),
  myDeveloper: () => http.get<MyDeveloperProfile>('api/me/developer'),
  myJoinTeamStatus: () => http.get<JoinTeamStatus>('api/me/join-team'),
  joinTeam: (body: { resume_id?: number } = {}) =>
    http.post<JoinTeamResult>('api/me/join-team', body, { timeout: 30_000 }),
  myDefenses: () => http.get<Defense[]>('api/me/defenses'),
  myDefense: (id: number) => http.get<Defense>(`api/me/defenses/${id}`),
  createDefense: (body: { title?: string; statement: string; proposal: string; achievements?: string }) =>
    http.post<Defense>('api/me/defenses', body),
  withdrawDefense: (id: number) => http.post<Defense>(`api/me/defenses/${id}/withdraw`, {}),
  myPendingReviews: () => http.get<PendingReview[]>('api/me/reviews'),
  submitMyReview: (
    id: number,
    body: { decision: string; score?: number; opinion: string },
  ) => http.post<Defense | null>(`api/me/reviews/${id}`, body),
  confirmApplication: (id: number) => http.post(`api/me/applications/${id}/confirm`, {}),
  myApplications: () => http.get<Application[]>('api/me/applications'),
  myApplication: (id: number) => http.get<Application>(`api/me/applications/${id}`),
  myResumes: () => http.get<Resume[]>('api/me/resumes'),
  myResume: (id: number) => http.get<Resume>(`api/me/resumes/${id}`),
  createResume: (body: Partial<Resume>) => http.post<Resume>('api/me/resumes', body),
  updateResume: (id: number, body: Partial<Resume>) =>
    http.put<Resume>(`api/me/resumes/${id}`, body),
  deleteResume: (id: number) => http.delete(`api/me/resumes/${id}`),
  setDefaultResume: (id: number) => http.post(`api/me/resumes/${id}/default`, {}),
  uploadResume: (fileName: string, dataBase64: string) =>
    http.post<UploadResumeResult>(
      'api/me/resumes/upload',
      { fileName, dataBase64 },
      { timeout: 120_000 },
    ),
  resumeFileUrl: (id: number) => `/api/me/resumes/${id}/file`,

  // ===== 管理端 =====
  adminMe: () => http.get<AdminSession>('api/admin/me'),
  adminStats: () => http.get<AdminStats>('api/admin/stats'),
  adminDirectoryUsers: (params: Record<string, unknown> = {}) =>
    http.get<DirectoryPage>(`api/admin/directory/users${qs(params)}`),
  adminRefreshDirectory: () =>
    http.post<{ cachedAt: string; total: number }>('api/admin/directory/refresh', {}),
  adminSite: () => http.get<SiteConfig>('api/admin/site'),
  adminUpdateSite: (body: Partial<SiteConfig>) => http.put<SiteConfig>('api/admin/site', body),

  adminDepartments: () => http.get<Department[]>('api/admin/departments'),
  adminCreateDepartment: (body: Record<string, unknown>) =>
    http.post<Department>('api/admin/departments', body),
  adminUpdateDepartment: (id: number, body: Record<string, unknown>) =>
    http.put<Department>(`api/admin/departments/${id}`, body),
  adminDeleteDepartment: (id: number) => http.delete(`api/admin/departments/${id}`),

  adminJobs: (params: Record<string, unknown> = {}) =>
    http.get<AdminJob[]>(`api/admin/jobs${qs(params)}`),
  adminCreateJob: (body: Record<string, unknown>) => http.post<AdminJob>('api/admin/jobs', body),
  adminUpdateJob: (id: number, body: Record<string, unknown>) =>
    http.put<AdminJob>(`api/admin/jobs/${id}`, body),
  adminDeleteJob: (id: number) => http.delete(`api/admin/jobs/${id}`),

  adminApplications: (params: Record<string, unknown> = {}) =>
    http.get<AdminApplication[]>(`api/admin/applications${qs(params)}`),
  adminApplication: (id: number) =>
    http.get<AdminApplication>(`api/admin/applications/${id}`),
  adminPassApplication: (id: number) =>
    http.post(`api/admin/applications/${id}/pass`, {}, { timeout: 20_000 }),
  adminRejectApplication: (id: number, note = '') =>
    http.post(`api/admin/applications/${id}/reject`, { note }),
  adminApplicationStage: (id: number, body: Record<string, unknown>) =>
    http.post<AdminApplication>(`api/admin/applications/${id}/stage`, body),

  // ===== 人事 / 角色 =====
  adminUsers: (params: Record<string, unknown> = {}) =>
    http.get<{ items: AdminUser[]; total: number; page: number; pageSize: number }>(
      `api/admin/users${qs(params)}`,
    ),
  adminUser: (id: number) => http.get<AdminUserDetail>(`api/admin/users/${id}`),
  adminUserLookup: (q: string) =>
    http.get<Array<Pick<AdminUser, 'id' | 'name' | 'email' | 'developer_no' | 'developer_level' | 'avatar'>>>(
      `api/admin/users/lookup${qs({ q })}`,
    ),
  adminUpdateUserRole: (id: number, body: Record<string, unknown>) =>
    http.patch<AdminUser>(`api/admin/users/${id}/role`, body),
  adminUpdateUserIdentity: (id: number, body: Record<string, unknown>) =>
    http.patch<AdminUser>(`api/admin/users/${id}/identity`, body),

  // ===== 答辩管理 =====
  adminDefenses: (params: Record<string, unknown> = {}) =>
    http.get<Defense[]>(`api/admin/defenses${qs(params)}`),
  adminDefense: (id: number) => http.get<Defense>(`api/admin/defenses/${id}`),
  adminPendingReviews: () => http.get<Array<Record<string, unknown>>>('api/admin/defenses/pending-reviews'),
  adminSubmitReview: (
    defenseId: number,
    reviewId: number,
    body: { decision: string; score?: number; opinion: string },
  ) => http.post<Defense | null>(`api/admin/defenses/${defenseId}/reviews/${reviewId}`, body),
  adminDecideDefense: (id: number, decision: 'pass' | 'reject', note = '') =>
    http.post<Defense>(`api/admin/defenses/${id}/decide`, { decision, note }),
  adminReassignReview: (defenseId: number, reviewId: number, reviewerUserId: number) =>
    http.post<Defense>(`api/admin/defenses/${defenseId}/reassign`, {
      review_id: reviewId,
      reviewer_user_id: reviewerUserId,
    }),

  // ===== 圆桌 / 年度复审 =====
  adminRoundtable: () => http.get<RoundtableData>('api/admin/roundtable'),
  adminSeatReview: (userId: number, body: Record<string, unknown>) =>
    http.post<SeatReview>(`api/admin/roundtable/${userId}/review`, body),
  adminExitRoundtable: (userId: number, body: Record<string, unknown>) =>
    http.post<SeatReview | null>(`api/admin/roundtable/${userId}/exit`, body),
  adminPromoteWaitlist: (departmentId: number) =>
    http.post<{ promoted: number }>('api/admin/roundtable/promote', { department_id: departmentId }),

  // ===== 会议 / 席位与晋升公示 =====
  adminPublicities: () => http.get<Publicity[]>('api/admin/publicities'),
  adminPublicityDraft: (since = '') =>
    http.get<{
      title: string
      meeting_date: string
      since: string
      seats: PublicitySeat[]
      promotions: PublicityPromotion[]
      content: string
    }>(`api/admin/publicities/draft${qs({ since })}`),
  adminCreatePublicity: (body: Record<string, unknown>) =>
    http.post<Publicity>('api/admin/publicities', body),
  adminUpdatePublicity: (id: number, body: Record<string, unknown>) =>
    http.put<Publicity>(`api/admin/publicities/${id}`, body),
  adminDeletePublicity: (id: number) => http.delete(`api/admin/publicities/${id}`),
  adminRefreshOa: () =>
    http.post<{ refreshed: number; total: number }>(
      'api/admin/applications/refresh-oa',
      {},
      { timeout: 30_000 },
    ),

  // ===== 集市历史 / 名人堂 =====
  adminHistoryMeta: () => http.get<AdminHistoryMeta>('api/admin/history/meta'),
  adminHistorySettings: () => http.get<HistorySettings>('api/admin/history/settings'),
  adminUpdateHistorySettings: (body: Partial<HistorySettings>) =>
    http.put<HistorySettings>('api/admin/history/settings', body),
  adminHistoryChapters: () => http.get<HistoryChapter[]>('api/admin/history/chapters'),
  adminCreateHistoryChapter: (body: Record<string, unknown>) =>
    http.post<HistoryChapter>('api/admin/history/chapters', body),
  adminUpdateHistoryChapter: (id: number, body: Record<string, unknown>) =>
    http.put<HistoryChapter>(`api/admin/history/chapters/${id}`, body),
  adminDeleteHistoryChapter: (id: number) =>
    http.delete(`api/admin/history/chapters/${id}`),
  adminHallOfFame: () => http.get<AdminHallOfFameMember[]>('api/admin/history/hall'),
  adminCreateHallOfFame: (body: Record<string, unknown>) =>
    http.post<AdminHallOfFameMember>('api/admin/history/hall', body),
  adminUpdateHallOfFame: (id: number, body: Record<string, unknown>) =>
    http.put<AdminHallOfFameMember>(`api/admin/history/hall/${id}`, body),
  adminDeleteHallOfFame: (id: number) => http.delete(`api/admin/history/hall/${id}`),
  adminReorderHall: (ids: number[]) =>
    http.post<AdminHallOfFameMember[]>('api/admin/history/hall/reorder', { ids }),
  adminHistorySsoUsers: (q = '') =>
    http.get<SsoUserDirectory>(`api/admin/history/sso-users${qs({ q })}`),
  adminHallInvites: () => http.get<AdminHallInvite[]>('api/admin/history/invites'),
  adminCreateHallInvite: (body: Record<string, unknown>) =>
    http.post<{ invite: AdminHallInvite; link: string; emailSent: boolean }>(
      'api/admin/history/invites',
      body,
      { timeout: 30_000 },
    ),
  adminCreateHallInvitesBatch: (body: Record<string, unknown>) =>
    http.post<BatchInviteResult>('api/admin/history/invites/batch', body, {
      timeout: 120_000,
    }),
  adminResendHallInvite: (id: number) =>
    http.post<{ invite: AdminHallInvite; link: string; emailSent: boolean }>(
      `api/admin/history/invites/${id}/resend`,
      {},
      { timeout: 30_000 },
    ),
  adminRevokeHallInvite: (id: number) =>
    http.delete<AdminHallInvite>(`api/admin/history/invites/${id}`),

  adminFaqs: () => http.get<Faq[]>('api/admin/faqs'),
  adminCreateFaq: (body: Record<string, unknown>) => http.post<Faq>('api/admin/faqs', body),
  adminUpdateFaq: (id: number, body: Record<string, unknown>) =>
    http.put<Faq>(`api/admin/faqs/${id}`, body),
  adminDeleteFaq: (id: number) => http.delete(`api/admin/faqs/${id}`),
}

export type { http }
