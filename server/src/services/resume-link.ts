import crypto from 'node:crypto'
import path from 'node:path'
import { config } from '../config.js'

/**
 * 简历外链：开发者平台的 leader 在另一个站点打开 PDF，所以不能沿用
 * /api/me/resumes/:id/file 的登录态校验。这里用带过期时间的 HMAC 签名链接，
 * 链接本身就是访问凭证，90 天后自动失效。
 */

export function resumeAbsolutePath(relPath: string): string | null {
  if (!relPath) return null
  const root = path.resolve(config.dataDir)
  const abs = path.resolve(root, relPath)
  if (abs !== root && !abs.startsWith(root + path.sep)) return null
  return abs
}

function sign(payload: string): string | null {
  const secret = config.devPlatform.resumeLinkSecret
  if (!secret) return null
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

/** 生成带签名的公网简历地址；未配置签名密钥时返回 null */
export function resumePublicUrl(resumeId: number): string | null {
  const exp = Math.floor(Date.now() / 1000) + config.devPlatform.resumeLinkDays * 86400
  const payload = `${resumeId}.${exp}`
  const sig = sign(payload)
  if (!sig) return null
  return `${config.publicBase}/api/developer/resumes/${payload}.${sig}`
}

/** 校验签名链接，返回简历 id；过期或签名不符返回 null */
export function verifyResumeToken(token: string): number | null {
  const match = /^(\d+)\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(String(token || ''))
  if (!match) return null
  const resumeId = Number(match[1])
  const exp = Number(match[2])
  if (!Number.isInteger(resumeId) || resumeId <= 0) return null
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null
  const expected = sign(`${resumeId}.${exp}`)
  if (!expected) return null
  const a = Buffer.from(match[3])
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return crypto.timingSafeEqual(a, b) ? resumeId : null
}