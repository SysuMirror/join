import { db, now, type DepartmentRow, type DefenseRow, type UserRow } from '../db.js'

/** 开发者编号：SSE-D-0001 */
export function developerNoFor(userId: number): string {
  return `SSE-D-${String(userId).padStart(4, '0')}`
}

/** 登录/建号时补齐开发者身份（底座：全员开发者，无需审批）。 */
export function ensureDeveloperProfile(user: UserRow): boolean {
  let changed = false
  if (!user.developer_no) {
    user.developer_no = developerNoFor(user.id)
    changed = true
  }
  if (user.developer_level !== 'project' && user.developer_level !== 'roundtable') {
    if (user.developer_level !== 'market') {
      user.developer_level = 'market'
      changed = true
    }
  }
  if (user.status !== 'exited' && user.status !== 'active') {
    user.status = 'active'
    changed = true
  }
  if (user.primary_department_id == null) {
    user.primary_department_id = 0
    changed = true
  }
  return changed
}

/** 是否为超级管理员（数据库角色优先；兼容旧 is_admin 字段） */
export function isSuperAdminUser(user: UserRow | null | undefined): boolean {
  return Boolean(user && (user.system_role === 'super_admin' || user.is_admin === 1))
}

function idList(raw: string): number[] {
  return String(raw || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function emailList(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** 用户是否为某部门管理员（用户 id 关系优先，兼容旧邮箱关系） */
export function isDepartmentAdminUser(user: UserRow | null | undefined, dept: DepartmentRow): boolean {
  if (!user) return false
  if (idList(dept.admin_user_ids).includes(user.id)) return true
  const email = (user.email || '').trim().toLowerCase()
  return Boolean(email && emailList(dept.admin_emails).includes(email))
}

/** 用户管理的部门（部门管理员） */
export function departmentAdminDepartmentsOf(user: UserRow | null | undefined): DepartmentRow[] {
  if (!user) return []
  return db
    .getStore()
    .departments.filter((d) => isDepartmentAdminUser(user, d))
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

/** 用户担任负责人的部门 */
export function headDepartmentsOf(userId: number): DepartmentRow[] {
  return db
    .getStore()
    .departments.filter((d) => d.head_user_id === userId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

/** 资源方代表（三级评审） */
export function isResourceReviewer(user: UserRow | null | undefined): boolean {
  return Boolean(user && user.reviewer_role === 'resource')
}

/** 是否具有后台权限（超管 / 部门管理员 / 资源方代表） */
export function isStaffUser(user: UserRow | null | undefined): boolean {
  if (!user) return false
  return (
    isSuperAdminUser(user) ||
    isResourceReviewer(user) ||
    departmentAdminDepartmentsOf(user).length > 0
  )
}

/** 部门席位统计 */
export function departmentSeatStats(dept: DepartmentRow): {
  total: number
  occupied: number
  available: number
  waitlist: number
  members: number
  roundtableMembers: UserRow[]
} {
  const s = db.getStore()
  const total = Math.max(1, Number(dept.base_seats) || 1) + Math.max(0, Number(dept.floating_seats) || 0)
  const roundtableMembers = s.users.filter(
    (u) =>
      u.primary_department_id === dept.id &&
      u.developer_level === 'roundtable' &&
      u.status === 'active',
  )
  const waitlist = s.defenses.filter(
    (d) => d.department_id === dept.id && d.status === 'waitlist',
  ).length
  const members = s.users.filter(
    (u) => u.primary_department_id === dept.id && u.status === 'active',
  ).length
  return {
    total,
    occupied: roundtableMembers.length,
    available: Math.max(0, total - roundtableMembers.length),
    waitlist,
    members,
    roundtableMembers,
  }
}

/** 部门公开画像（首页 / 团队页 / 管理端共用） */
export function departmentPublicView(dept: DepartmentRow) {
  const s = db.getStore()
  const stats = departmentSeatStats(dept)
  const head = s.users.find((u) => u.id === dept.head_user_id) || null
  const scores = [
    dept.output_delivery,
    dept.output_usage,
    dept.output_talent,
    dept.output_activity,
  ].map((n) => Number(n) || 0)
  const outputScore = Math.round(scores.reduce((a, b) => a + b, 0) / 4)
  return {
    id: dept.id,
    name: dept.name,
    slug: dept.slug,
    summary: dept.summary,
    description: dept.description,
    color: dept.color,
    enabled: dept.enabled,
    sort_order: dept.sort_order,
    head: head
      ? {
          id: head.id,
          name: head.name,
          avatar: head.avatar,
          developer_no: head.developer_no,
          level: head.developer_level,
        }
      : null,
    seats: {
      base: dept.base_seats,
      floating: dept.floating_seats,
      total: stats.total,
      occupied: stats.occupied,
      available: stats.available,
      waitlist: stats.waitlist,
    },
    output: {
      delivery: dept.output_delivery,
      usage: dept.output_usage,
      talent: dept.output_talent,
      activity: dept.output_activity,
      score: outputScore,
      note: dept.output_note,
    },
    members: stats.members,
    roundtable_members: stats.roundtableMembers.map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      developer_no: u.developer_no,
      joined_at: u.roundtable_joined_at,
    })),
  }
}

/** 用户公开/半公开身份视图 */
export function userIdentityView(user: UserRow) {
  const s = db.getStore()
  const dept = s.departments.find((d) => d.id === user.primary_department_id) || null
  const adminDepts = departmentAdminDepartmentsOf(user)
  const headDepts = headDepartmentsOf(user.id)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    developer_no: user.developer_no || developerNoFor(user.id),
    developer_level: user.developer_level,
    level_label:
      user.developer_level === 'roundtable'
        ? '技术部成员'
        : user.developer_level === 'project'
          ? '项目开发者'
          : '集市开发者',
    status: user.status,
    department: dept
      ? { id: dept.id, name: dept.name, slug: dept.slug, color: dept.color }
      : null,
    department_joined_at: user.department_joined_at,
    roundtable_joined_at: user.roundtable_joined_at,
    developer_bio: user.developer_bio,
    developer_skills: (user.developer_skills || '').split(',').map((x) => x.trim()).filter(Boolean),
    developer_links: (user.developer_links || '').split(',').map((x) => x.trim()).filter(Boolean),
    sso_developer: user.sso_developer === 1,
    sso_developer_at: user.sso_developer_at || '',
    system_role: isSuperAdminUser(user) ? 'super_admin' : 'user',
    reviewer_role: user.reviewer_role,
    is_super_admin: isSuperAdminUser(user),
    is_resource_reviewer: isResourceReviewer(user),
    is_department_admin: adminDepts.length > 0,
    admin_departments: adminDepts.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
    head_departments: headDepts.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
  }
}

/** 进入部门：结束其他在组关系，建立新关系，身份转为项目开发者。 */
export function joinDepartment(
  user: UserRow,
  dept: DepartmentRow,
  opts: { sourceApplicationId?: number; note?: string } = {},
): void {
  const s = db.getStore()
  const t = now()
  for (const m of s.memberships) {
    if (m.user_id === user.id && m.status === 'active' && m.department_id !== dept.id) {
      m.status = 'left'
      m.left_at = t
      m.updated_at = t
    }
  }
  const existing = s.memberships.find(
    (m) => m.user_id === user.id && m.department_id === dept.id && m.status === 'active',
  )
  if (!existing) {
    s.memberships.push({
      id: db.nextId('memberships'),
      user_id: user.id,
      department_id: dept.id,
      role: dept.head_user_id === user.id ? 'head' : 'member',
      status: 'active',
      source_application_id: opts.sourceApplicationId || 0,
      joined_at: t,
      left_at: '',
      note: opts.note || '',
      created_at: t,
      updated_at: t,
    })
  }
  if (user.developer_level === 'market') user.developer_level = 'project'
  user.primary_department_id = dept.id
  user.department_joined_at = t
  user.status = 'active'
  // 负责人自动具备部门管理员权限
  if (dept.head_user_id === user.id) {
    const ids = idList(dept.admin_user_ids)
    if (!ids.includes(user.id)) {
      dept.admin_user_ids = [...ids, user.id].join(',')
      dept.updated_at = t
    }
  }
  return
}

/** 退出开发者体系 / 离开部门 */
export function leaveDepartment(user: UserRow, note = ''): void {
  const s = db.getStore()
  const t = now()
  for (const m of s.memberships) {
    if (m.user_id === user.id && m.status === 'active') {
      m.status = 'left'
      m.left_at = t
      m.note = note || m.note
      m.updated_at = t
    }
  }
  user.primary_department_id = 0
  user.department_joined_at = ''
  if (user.developer_level === 'project') user.developer_level = 'market'
}

/** 部门当前在组项目开发者（不含圆桌） */
export function departmentProjectMembers(deptId: number): UserRow[] {
  return db
    .getStore()
    .users.filter(
      (u) =>
        u.primary_department_id === deptId &&
        u.status === 'active' &&
        u.developer_level === 'project',
    )
    .sort((a, b) => a.id - b.id)
}

export function recentDefensesForUser(userId: number): DefenseRow[] {
  return db
    .getStore()
    .defenses.filter((d) => d.applicant_user_id === userId)
    .sort((a, b) => b.id - a.id)
}
const LEVEL_RANK: Record<string, number> = { market: 0, project: 1, roundtable: 2 }

function mergeCsv(a: string, b: string): string {
  return Array.from(
    new Set(
      `${a || ''},${b || ''}`
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ).join(',')
}

export function usersByEmail(email: string): UserRow[] {
  const e = (email || '').trim().toLowerCase()
  if (!e) return []
  return db.getStore().users.filter((u) => (u.email || '').trim().toLowerCase() === e)
}

/** 合并两个同邮箱账号：所有业务数据归到 canonical，duplicate 删除。 */
export function mergeUserRows(canonical: UserRow, duplicate: UserRow): void {
  if (!canonical || !duplicate || canonical.id === duplicate.id) return
  const s = db.getStore()
  const emailLocal = (canonical.email || '').split('@')[0]
  const canonicalNameWeak =
    !canonical.name || canonical.name === emailLocal || /^\d+$/.test(canonical.name)
  if (canonicalNameWeak && duplicate.name) canonical.name = duplicate.name
  if (!canonical.avatar && duplicate.avatar) canonical.avatar = duplicate.avatar
  if (!canonical.sso_sub && duplicate.sso_sub) canonical.sso_sub = duplicate.sso_sub
  if (!canonical.sse_sub && duplicate.sse_sub) canonical.sse_sub = duplicate.sse_sub
  canonical.internal = Math.max(canonical.internal || 0, duplicate.internal || 0)
  canonical.roles = mergeCsv(canonical.roles, duplicate.roles)
  canonical.is_admin = Math.max(canonical.is_admin || 0, duplicate.is_admin || 0)
  if (duplicate.system_role === 'super_admin') canonical.system_role = 'super_admin'
  if (duplicate.reviewer_role === 'resource') canonical.reviewer_role = 'resource'
  if (!canonical.developer_no && duplicate.developer_no) {
    canonical.developer_no = duplicate.developer_no
  }
  if ((LEVEL_RANK[duplicate.developer_level] || 0) > (LEVEL_RANK[canonical.developer_level] || 0)) {
    canonical.developer_level = duplicate.developer_level
  }
  if (!canonical.primary_department_id && duplicate.primary_department_id) {
    canonical.primary_department_id = duplicate.primary_department_id
    canonical.department_joined_at = duplicate.department_joined_at
  }
  if (!canonical.department_joined_at) canonical.department_joined_at = duplicate.department_joined_at
  if (!canonical.roundtable_joined_at) {
    canonical.roundtable_joined_at = duplicate.roundtable_joined_at
  }
  if (duplicate.status === 'active') canonical.status = 'active'
  canonical.developer_bio = canonical.developer_bio || duplicate.developer_bio
  canonical.developer_skills = mergeCsv(canonical.developer_skills, duplicate.developer_skills)
  canonical.developer_links = mergeCsv(canonical.developer_links, duplicate.developer_links)
  if (duplicate.sso_developer === 1) {
    canonical.sso_developer = 1
    canonical.sso_developer_at = duplicate.sso_developer_at || canonical.sso_developer_at
  }
  if (duplicate.provider === 'sso') canonical.provider = 'sso'
  if (duplicate.last_login_at > canonical.last_login_at) {
    canonical.last_login_at = duplicate.last_login_at
  }
  if (canonical.created_at && duplicate.created_at && duplicate.created_at < canonical.created_at) {
    canonical.created_at = duplicate.created_at
  }

  // 业务数据迁移
  for (const a of s.applications) if (a.user_id === duplicate.id) a.user_id = canonical.id
  for (const r of s.resumes) if (r.user_id === duplicate.id) r.user_id = canonical.id
  for (const d of s.defenses) if (d.applicant_user_id === duplicate.id) d.applicant_user_id = canonical.id
  for (const r of s.defense_reviews) {
    if (r.reviewer_user_id === duplicate.id) {
      r.reviewer_user_id = canonical.id
      r.reviewer_name = canonical.name || canonical.email
    }
  }
  for (const r of s.seat_reviews) if (r.user_id === duplicate.id) r.user_id = canonical.id
  for (const m of s.memberships) if (m.user_id === duplicate.id) m.user_id = canonical.id

  // 部门负责人/管理员关系
  for (const d of s.departments) {
    if (d.head_user_id === duplicate.id) d.head_user_id = canonical.id
    const ids = (d.admin_user_ids || '')
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => (n === duplicate.id ? canonical.id : n))
    d.admin_user_ids = Array.from(new Set(ids)).join(',')
  }

  // 同一部门只保留一条在组关系；账号只保留一个主部门
  const primary = canonical.primary_department_id
  for (const m of s.memberships) {
    if (m.user_id !== canonical.id || m.status !== 'active') continue
    if (primary && m.department_id !== primary) {
      m.status = 'left'
      m.left_at = m.left_at || now()
    }
  }
  const activeByDept = new Map<number, (typeof s.memberships)[number]>()
  for (const m of s.memberships) {
    if (m.user_id !== canonical.id || m.status !== 'active') continue
    const prev = activeByDept.get(m.department_id)
    if (!prev) activeByDept.set(m.department_id, m)
    else {
      if (m.role === 'head') prev.role = 'head'
      m.status = 'left'
      m.left_at = m.left_at || now()
    }
  }

  s.users = s.users.filter((u) => u.id !== duplicate.id)
}

/** 找到邮箱对应的唯一账号；若存在多个同邮箱账号，自动合并后返回。 */
export function findUniqueUserByEmail(email: string, preferredSub = ''): UserRow | null {
  const matches = usersByEmail(email)
  if (!matches.length) return null
  const canonical =
    (preferredSub && matches.find((u) => u.sso_sub === preferredSub)) ||
    matches.find((u) => u.sso_sub) ||
    matches[0]
  for (const other of [...matches]) {
    if (other.id !== canonical.id) mergeUserRows(canonical, other)
  }
  return canonical
}

/** 启动迁移：同邮箱账号合并为一个账号。返回合并的重复账号数量。 */
export function mergeDuplicateEmailAccounts(): number {
  const s = db.getStore()
  const groups = new Map<string, UserRow[]>()
  for (const u of [...s.users]) {
    const email = (u.email || '').trim().toLowerCase()
    if (!email) continue
    const list = groups.get(email) || []
    list.push(u)
    groups.set(email, list)
  }
  let merged = 0
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const canonical = list.find((u) => u.sso_sub) || list[0]
    for (const other of list) {
      if (other.id === canonical.id) continue
      mergeUserRows(canonical, other)
      merged += 1
    }
  }
  return merged
}
