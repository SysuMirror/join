import type { Request, Response, NextFunction } from 'express'
import { config } from './config.js'
import { db } from './db.js'
import { verifySessionToken } from './services/session.js'

export function ok<T>(res: Response, data: T, message = 'ok') {
  res.json({ code: 0, message, data })
}

export function fail(res: Response, status: number, message: string) {
  res.status(status).json({ code: status, message })
}

/**
 * 管理端鉴权：优先走「邮箱登录会话（JOIN_ADMIN_EMAILS 白名单内的管理员）」，
 * 同时兼容旧式 `x-admin-token` / `Authorization: Bearer <JOIN_ADMIN_TOKEN>`（备选；生产建议置于平台反代之后）。
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expectedToken = config.adminToken
  const headerToken =
    String(req.headers['x-admin-token'] || '') ||
    String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')

  // ① 会话方式：登录用户是否在白名单管理员内
  const payload = headerToken ? verifySessionToken(headerToken) : null
  if (payload) {
    const user = db.getStore().users.find((u) => u.id === payload.uid)
    const adminEmails = adminEmailsList()
    if (user && adminEmails.includes(user.email)) {
      ;(req as unknown as { session?: { uid: number; email: string } }).session = {
        uid: user.id,
        email: user.email,
      }
      return next()
    }
  }

  // ② 兼容旧式：直接比对 adminToken（配置了才启用）
  if (expectedToken && headerToken === expectedToken) {
    return next()
  }

  fail(res, 403, '无管理权限')
}

/** 白名单管理员邮箱（JOIN_ADMIN_EMAILS，逗号分隔） */
function adminEmailsList(): string[] {
  return (process.env.JOIN_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * 兼容旧引用：无会话 token 时禁止登录。保留别名以兼容既有 admin.ts 的 requireAdminToken 调用。
 */
export const requireAdminToken = requireAdmin
