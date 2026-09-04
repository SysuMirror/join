import { Router } from 'express'
import { config, isMailLoginUsable } from '../config.js'
import { db, now, type UserRow } from '../db.js'
import { ok, fail } from '../middleware.js'
import { sendVerifyCodeMail } from '../services/mail.js'
import { createSessionToken, verifySessionToken } from '../services/session.js'
import type { Request, Response, NextFunction } from 'express'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 当前登录用户（解析 Authorization: Bearer <token>） */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
  const payload = token ? verifySessionToken(token) : null
  if (!payload) {
    fail(res, 401, '未登录或登录已失效')
    return
  }
  ;(req as unknown as { session: SessionInfo }).session = {
    uid: payload.uid,
    email: payload.email,
  }
  next()
}

type SessionInfo = { uid: number; email: string }

/** 供路由取当前登录用户 */
export function getSessionUser(req: Request): SessionInfo | null {
  return ((req as unknown as { session?: SessionInfo }).session) || null
}

function mapUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name, is_admin: u.is_admin === 1 }
}

/** 邮箱是否允许登录（有管理白名单或任意邮箱可注册） */
function allowEmail(email: string): boolean {
  // 后续可扩展：JOIN_LOGIN_ALLOWED_DOMAINS 白名单；当前默认任意合法邮箱即可登录
  return Boolean(email)
}

/** 是否为白名单管理邮箱（JOIN_ADMIN_EMAILS，逗号分隔） */
function isAdminEmail(email: string): boolean {
  const list = (process.env.JOIN_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.toLowerCase())
}

// ===== 发送验证码（purpose: login | register） =====
authRouter.post('/code', async (req, res) => {
  if (!config.mail.enabled) {
    fail(res, 400, '邮箱登录未启用')
    return
  }
  if (!isMailLoginUsable()) {
    fail(res, 500, '邮箱登录未就绪：请配置 SMTP 与 JOIN_SESSION_SECRET')
    return
  }
  const email = String(req.body?.email || '').trim().toLowerCase()
  const purpose = String(req.body?.purpose || 'login') === 'register' ? 'register' : 'login'
  if (!EMAIL_RE.test(email)) {
    fail(res, 400, '邮箱格式不正确')
    return
  }
  if (!allowEmail(email)) {
    fail(res, 403, '该邮箱无登录权限')
    return
  }

  const s = db.getStore()

  // 按目的预检账号状态，给用户明确提示
  const exists = s.users.some((u) => u.email === email)
  if (purpose === 'register' && exists) {
    fail(res, 409, '该邮箱已注册，请直接登录')
    return
  }
  if (purpose === 'login' && !exists) {
    fail(res, 404, '该邮箱未注册，请先注册')
    return
  }

  // 频率限制：interval 内仅允许一次
  const last = s.verify_codes
    .filter((c) => c.email === email)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
  const intervalMs = config.mail.codeResendInterval * 1000
  if (last && !last.used && Date.parse(last.created_at) + intervalMs > Date.now()) {
    fail(res, 429, `发送过于频繁，请 ${Math.ceil((Date.parse(last.created_at) + intervalMs - Date.now()) / 1000)} 秒后再试`)
    return
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const t = now()
  const row = {
    email,
    code,
    expires_at: new Date(Date.now() + config.mail.codeTtlSeconds * 1000).toISOString(),
    used: 0,
    created_at: t,
  }
  await db.insert('verify_codes', row)

  const sent = await sendVerifyCodeMail(email, code)
  ok(res, { sent, email, ttl: config.mail.codeTtlSeconds }, sent ? '验证码已发送' : '验证码已生成（邮件发送未配置）')
})

// ===== 验证码登录 =====
authRouter.post('/login', async (req, res) => {
  if (!config.mail.enabled) {
    fail(res, 400, '邮箱登录未启用')
    return
  }
  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  if (!EMAIL_RE.test(email)) {
    fail(res, 400, '邮箱格式不正确')
    return
  }
  if (!/^\d{6}$/.test(code)) {
    fail(res, 400, '验证码格式不正确')
    return
  }

  const s = db.getStore()

  // 登录仅限已注册用户
  let user = s.users.find((u) => u.email === email)
  if (!user) {
    fail(res, 404, '该邮箱未注册，请先注册')
    return
  }

  // 取该邮箱最新一条未使用、未过期的验证码
  const target = s.verify_codes
    .filter((c) => c.email === email && !c.used && Date.parse(c.expires_at) > Date.now())
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
  if (!target || target.code !== code) {
    fail(res, 401, '验证码错误或已过期')
    return
  }
  target.used = 1

  user.last_login_at = now()
  // 管理白名单随时可生效（无需重新注册）
  if (isAdminEmail(email)) user.is_admin = 1
  await db.persist()

  const token = createSessionToken({ uid: user.id, email: user.email })
  ok(res, { token, user: mapUser(user) }, '登录成功')
})

// ===== 验证码注册 =====
authRouter.post('/register', async (req, res) => {
  if (!config.mail.enabled) {
    fail(res, 400, '邮箱注册未启用')
    return
  }
  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  const name = String(req.body?.name || '').trim()
  if (!EMAIL_RE.test(email)) {
    fail(res, 400, '邮箱格式不正确')
    return
  }
  if (!/^\d{6}$/.test(code)) {
    fail(res, 400, '验证码格式不正确')
    return
  }
  if (!name || name.length > 32) {
    fail(res, 400, '请填写昵称（1-32 字）')
    return
  }

  const s = db.getStore()
  if (s.users.some((u) => u.email === email)) {
    fail(res, 409, '该邮箱已注册，请直接登录')
    return
  }

  const target = s.verify_codes
    .filter((c) => c.email === email && !c.used && Date.parse(c.expires_at) > Date.now())
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
  if (!target || target.code !== code) {
    fail(res, 401, '验证码错误或已过期')
    return
  }
  target.used = 1

  const t = now()
  const user: UserRow = {
    id: db.nextId('users'),
    email,
    name,
    is_admin: isAdminEmail(email) ? 1 : 0,
    last_login_at: t,
    created_at: t,
  }
  s.users.push(user)
  await db.persist()

  const token = createSessionToken({ uid: user.id, email: user.email })
  ok(res, { token, user: mapUser(user) }, '注册成功')
})

// ===== 当前用户 =====
authRouter.get('/me', requireUser, (req, res) => {
  const session = getSessionUser(req)!
  const user = db.getStore().users.find((u) => u.id === session.uid)
  if (!user) {
    fail(res, 401, '用户不存在')
    return
  }
  ok(res, mapUser(user))
})

// ===== 退出 =====
authRouter.post('/logout', (_req, res) => {
  // 无状态 token，客户端删除本地 token 即可；此处仅作接口占位
  ok(res, { done: true }, '已退出')
})

// ===== SSE Market SSO（预留） =====
authRouter.get('/sso/authorize', (_req, res) => {
  const c = config.sso
  if (!c.enabled) {
    fail(res, 400, 'SSO 登录未启用')
    return
  }
  const url = `${c.baseUrl}/connect?client_id=${c.appId}&redirect_uri=${encodeURIComponent(c.redirectUri)}&response_type=code&scope=${encodeURIComponent(c.scope)}`
  res.redirect(url)
})

authRouter.get('/sso/callback', async (req, res) => {
  const c = config.sso
  if (!c.enabled) {
    fail(res, 400, 'SSO 登录未启用')
    return
  }
  const code = String(req.query.code || '')
  if (!code) {
    fail(res, 400, '缺少授权 code')
    return
  }
  // TODO(subsequent): 用 appId/appSecret 向 SSE Market 换 token → 拿用户信息 → 建/取本地用户 → 签发会话
  fail(res, 501, 'SSO 回调待接入')
})
