import type { Request, Response, NextFunction } from 'express'
import { config } from './config.js'

export function ok<T>(res: Response, data: T, message = 'ok') {
  res.json({ code: 0, message, data })
}

export function fail(res: Response, status: number, message: string) {
  res.status(status).json({ code: status, message })
}

/**
 * 管理端鉴权：请求头 `x-admin-token` 或 `Authorization: Bearer <token>` 与 JOIN_ADMIN_TOKEN 一致。
 * 用于管理页审核入口，非强安全（生产建议置于平台反代之后）+ 建议部署平台用环境变量注入。
 */
export function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const expected = config.adminToken
  if (!expected) {
    fail(res, 500, '管理口令未配置（JOIN_ADMIN_TOKEN）')
    return
  }
  const header =
    String(req.headers['x-admin-token'] || '') ||
    String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
  if (header !== expected) {
    fail(res, 403, '管理口令不正确')
    return
  }
  next()
}
