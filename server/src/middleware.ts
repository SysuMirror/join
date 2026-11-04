import type { Request, Response, NextFunction } from 'express'
import { config } from './config.js'
import { db, type DepartmentRow, type UserRow } from './db.js'
import { verifySessionToken, type SessionPayload } from './services/session.js'
import {
  departmentAdminDepartmentsOf,
  headDepartmentsOf,
  isDepartmentAdminUser,
  isResourceReviewer,
  isStaffUser,
  isSuperAdminUser,
} from './services/org.js'

export function ok<T>(res: Response, data: T, message = 'ok') {
  res.json({ code: 0, message, data })
}

export function fail(res: Response, status: number, message: string) {
  res.status(status).json({ code: status, message })
}

export type SessionInfo = { uid: number; email: string }

export const SESSION_COOKIE = 'join_session'

/** 解析 Cookie 请求头（不引入 cookie-parser） */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

/** 从 Authorization: Bearer 或 HttpOnly Cookie 取会话 token */
export function readSessionToken(req: Request): string {
  const bearer = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()
  if (bearer) return bearer
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  return cookie ? String(cookie) : ''
}

export function getSessionPayload(req: Request): SessionPayload | null {
  // Bearer 优先；若失效则回退到 HttpOnly Cookie（避免旧的 localStorage token 遮挡 SSO 会话）
  const bearer = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()
  if (bearer) {
    const p = verifySessionToken(bearer)
    if (p) return p
  }
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  return cookie ? verifySessionToken(String(cookie)) : null
}

/** 当前登录用户（已失效/不存在返回 null） */
export function getCurrentUser(req: Request): UserRow | null {
  const payload = getSessionPayload(req)
  if (!payload) return null
  return db.getStore().users.find((u) => u.id === payload.uid) || null
}

function isSecureRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  return proto === 'https' || config.publicBase.startsWith('https://')
}

/** 登录成功后写入 HttpOnly 会话 Cookie（7 天，与 token 有效期一致） */
export function setSessionCookie(req: Request, res: Response, token: string): void {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 3600}`,
  ]
  if (isSecureRequest(req)) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearSessionCookie(req: Request, res: Response): void {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (isSecureRequest(req)) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

/** 共享父域 SSO Cookie：值由 UniSSO 签发，服务端只当会话指针使用 */
export const SSO_COOKIE = 'sse_sso'

export type SsoCookieMeta = { name?: string; domain?: string; maxAge?: number }

/** 登录成功后把 unisso 返回的 SSO 会话种到父域（可与会话 Cookie 并存） */
export function setSsoCookie(res: Response, value: string, meta: SsoCookieMeta = {}): void {
  const name = meta.name || SSO_COOKIE
  const domain = meta.domain || '.ssemarket.cn'
  const maxAge = Number(meta.maxAge) > 0 ? Number(meta.maxAge) : 604800
  res.append(
    'Set-Cookie',
    `${name}=${value}; Domain=${domain}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
  )
}

/** 清父域 SSO Cookie（登出 / 会话失效） */
export function clearSsoCookie(res: Response, meta: SsoCookieMeta = {}): void {
  const name = meta.name || SSO_COOKIE
  const domain = meta.domain || '.ssemarket.cn'
  res.append(
    'Set-Cookie',
    `${name}=; Domain=${domain}; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  )
}

/** 超级管理员 UniSSO sub 白名单：部署环境变量 JOIN_ADMIN_SUBS + 站点配置 adminSubs */
export function adminSubsList(): string[] {
  const envList = config.adminSubs || ''
  const dbList = db.getStore().site_config.adminSubs || ''
  return `${envList},${dbList}`
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAdminSub(sub: string | null | undefined): boolean {
  const s = (sub || '').trim()
  if (!s) return false
  return adminSubsList().includes(s)
}

export function parseEmailList(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
}

/** 该邮箱负责的部门（部门管理员；兼容旧数据） */
export function departmentAdminDepartments(email: string): DepartmentRow[] {
  const e = (email || '').trim().toLowerCase()
  if (!e) return []
  return db
    .getStore()
    .departments.filter((d) => parseEmailList(d.admin_emails).includes(e))
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

/** 是否为某个部门的管理员（旧邮箱语义） */
export function isDepartmentAdmin(email: string): boolean {
  return departmentAdminDepartments(email).length > 0
}

export type AdminContext = {
  user: UserRow | null
  /** 超级管理员：可管理全部部门、站点配置、问答与用户角色 */
  global: boolean
  /** 资源方代表（三级答辩评审） */
  resourceReviewer: boolean
  /** 担任负责人的部门（一级答辩陈述人） */
  headDepartments: DepartmentRow[]
  /** 可管辖的部门（超级管理员为全部） */
  departments: DepartmentRow[]
  departmentIds: number[]
}

/** 解析当前请求的后台权限范围 */
export function getAdminContext(req: Request): AdminContext {
  const user = getCurrentUser(req)
  const global = user ? isSuperAdminUser(user) : false
  const departments = global
    ? [...db.getStore().departments].sort(
        (a, b) => a.sort_order - b.sort_order || a.id - b.id,
      )
    : user
      ? departmentAdminDepartmentsOf(user)
      : []
  return {
    user,
    global,
    resourceReviewer: Boolean(user && isResourceReviewer(user)),
    headDepartments: user ? headDepartmentsOf(user.id) : [],
    departments,
    departmentIds: departments.map((d) => d.id),
  }
}

/** 需要登录的接口 */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = getCurrentUser(req)
  if (!user) {
    fail(res, 401, '未登录或登录已失效')
    return
  }
  ;(req as unknown as { session: SessionInfo }).session = { uid: user.id, email: user.email }
  ;(req as unknown as { user: UserRow }).user = user
  next()
}

/**
 * 后台入口鉴权：超级管理员或部门管理员均可进入；
 * 具体能操作哪些部门由 getAdminContext() 决定。
 */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const ctx = getAdminContext(req)
  if (!ctx.user) {
    fail(res, 403, '无管理权限')
    return
  }
  if (!isStaffUser(ctx.user) && !isAdminSub(ctx.user.sso_sub)) {
    fail(res, 403, '无后台管理权限')
    return
  }
  ;(req as unknown as { session: SessionInfo }).session = {
    uid: ctx.user.id,
    email: ctx.user.email,
  }
  ;(req as unknown as { user: UserRow }).user = ctx.user
  next()
}

/** 仅超级管理员（部门 CRUD、部门管理员设置、站点配置、问答管理） */
export function requireGlobalAdmin(req: Request, res: Response, next: NextFunction) {
  const ctx = getAdminContext(req)
  if (!ctx.global) {
    fail(res, 403, '仅超级管理员可执行此操作')
    return
  }
  if (ctx.user) {
    ;(req as unknown as { session: SessionInfo }).session = {
      uid: ctx.user.id,
      email: ctx.user.email,
    }
    ;(req as unknown as { user: UserRow }).user = ctx.user
  }
  next()
}

/** 兼容旧引用 */
export const requireAdmin = requireGlobalAdmin
