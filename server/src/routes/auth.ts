import { Router } from 'express'
import type { Request, Response } from 'express'
import { config, isUnissoConfigured } from '../config.js'
import { db, now, type UserRow } from '../db.js'
import {
  ok,
  fail,
  requireUser,
  getCurrentUser,
  isAdminSub,
  setSessionCookie,
  clearSessionCookie,
  parseCookies,
  SSO_COOKIE,
  setSsoCookie,
  clearSsoCookie,
} from '../middleware.js'
import { createSessionToken } from '../services/session.js'
import {
  developerNoFor,
  ensureDeveloperProfile,
  findUniqueUserByEmail,
  isStaffUser,
  isSuperAdminUser,
  mergeUserRows,
  userIdentityView,
} from '../services/org.js'
import {
  buildAuthorizeUrl,
  createPkcePair,
  createState,
  exchangeCode,
  fetchUserInfo,
  verifyIdToken,
  verifyPassword,
  verifySession,
  revokeSession,
  type UnissoPasswordVerifyResult,
  JwksError,
} from '../unisso.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UnissoUserClaims = NonNullable<UnissoPasswordVerifyResult['user']>

/** 静默 SSO 限流：同一 IP 每分钟最多 10 次 */
const SSO_TRY_MAX = 10
const ssoTryHits = new Map<string, { count: number; resetAt: number }>()

function allowSsoTry(ip: string): boolean {
  const nowMs = Date.now()
  const key = ip || 'unknown'
  const entry = ssoTryHits.get(key)
  if (!entry || nowMs >= entry.resetAt) {
    ssoTryHits.set(key, { count: 1, resetAt: nowMs + 60_000 })
    if (ssoTryHits.size > 10_000) {
      for (const [k, v] of ssoTryHits) if (nowMs >= v.resetAt) ssoTryHits.delete(k)
    }
    return true
  }
  entry.count += 1
  return entry.count <= SSO_TRY_MAX
}

/**
 * 管理员登录落地：按 sub upsert 本地用户并授予后台权限。
 * 密码登录与静默 SSO 共用，避免两套行为漂移。
 */
async function persistAdminLogin(u: UnissoUserClaims, email: string): Promise<UserRow> {
  const sub = String(u.sub || u.sso_sub || '').trim()
  const s = db.getStore()
  const t = now()
  let user = s.users.find((x) => x.sso_sub && x.sso_sub === sub)
  if (!user) {
    const id = db.nextId('users')
    user = {
      id,
      email,
      name: String(u.name || u.preferred_username || '').trim().slice(0, 60) || email.split('@')[0],
      is_admin: 1,
      system_role: 'super_admin',
      reviewer_role: '',
      avatar: String(u.picture || '').trim().slice(0, 500),
      sso_sub: sub,
      sse_sub: String(u.sse_sub || '').trim(),
      internal: 1,
      roles: '',
      provider: 'unisso',
      last_login_at: t,
      developer_no: developerNoFor(id),
      developer_level: 'market',
      primary_department_id: 0,
      department_joined_at: '',
      roundtable_joined_at: '',
      status: 'active',
      developer_bio: '',
      developer_skills: '',
      developer_links: '',
      created_at: t,
    }
    s.users.push(user)
  } else {
    if (email) user.email = email
    user.name = String(u.name || u.preferred_username || '').trim().slice(0, 60) || user.name
    const avatar = String(u.picture || '').trim().slice(0, 500)
    if (avatar) user.avatar = avatar
    const sseSub = String(u.sse_sub || '').trim()
    if (sseSub) user.sse_sub = sseSub
    user.sso_sub = sub
    user.internal = 1
    user.is_admin = 1
    user.system_role = 'super_admin'
    user.last_login_at = t
  }
  ensureDeveloperProfile(user)
  await db.persist()
  return user
}

function sanitizeReturnTo(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/api')) {
    return config.unisso.defaultReturnTo
  }
  return s.slice(0, 500)
}

function loginErrorRedirect(res: Response, message: string) {
  res.redirect(`/login?error=${encodeURIComponent(message)}`)
}

function mapUser(u: UserRow) {
  const identity = userIdentityView(u)
  return {
    ...identity,
    provider: u.provider,
    internal: u.internal === 1,
    roles: u.roles ? u.roles.split(',').filter(Boolean) : [],
    is_admin: isSuperAdminUser(u) || isAdminSub(u.sso_sub),
    is_staff: isStaffUser(u) || isAdminSub(u.sso_sub),
  }
}

// ===== UniSSO：发起授权 =====
authRouter.get('/sso/start', async (req, res) => {
  if (!isUnissoConfigured()) {
    loginErrorRedirect(
      res,
      'UniSSO 尚未配置：请管理员在 UniSSO 注册应用并注入 UNISSO_CLIENT_ID / UNISSO_CLIENT_SECRET',
    )
    return
  }
  try {
    const returnTo = sanitizeReturnTo(req.query.returnTo)
    const { verifier, challenge } = createPkcePair()
    const state = createState()

    // 清理过期 state，避免 JSON 库无限增长
    const s = db.getStore()
    const cutoff = Date.now() - 15 * 60 * 1000
    s.sso_states = s.sso_states.filter((st) => Date.parse(st.created_at) > cutoff)

    const t = now()
    s.sso_states.push({
      id: db.nextId('sso_states'),
      state,
      code_verifier: verifier,
      return_to: returnTo,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used: 0,
      created_at: t,
    })
    await db.persist()

    const url = await buildAuthorizeUrl({ state, codeChallenge: challenge })
    res.redirect(url)
  } catch (e) {
    console.error('[auth] 发起 SSO 登录失败:', e instanceof Error ? e.message : e)
    loginErrorRedirect(res, '发起统一登录失败，请稍后重试')
  }
})

// ===== UniSSO：回调（code → token → userinfo → 本应用会话）=====
authRouter.get('/sso/callback', async (req, res) => {
  if (!isUnissoConfigured()) {
    loginErrorRedirect(res, 'UniSSO 尚未配置')
    return
  }
  const oauthError = String(req.query.error || '')
  if (oauthError) {
    const desc = String(req.query.error_description || oauthError)
    loginErrorRedirect(res, `统一登录未完成：${desc}`)
    return
  }

  const code = String(req.query.code || '').trim()
  const state = String(req.query.state || '').trim()
  if (!code || !state) {
    loginErrorRedirect(res, '统一登录回调缺少 code / state')
    return
  }

  const s = db.getStore()
  const stateRow = s.sso_states.find((st) => st.state === state)
  if (!stateRow) {
    loginErrorRedirect(res, '登录状态不存在，请重新登录')
    return
  }
  if (stateRow.used === 1) {
    loginErrorRedirect(res, '登录凭证已使用，请重新登录')
    return
  }
  if (Date.parse(stateRow.expires_at) < Date.now()) {
    loginErrorRedirect(res, '登录已过期，请重新登录')
    return
  }
  stateRow.used = 1
  await db.persist()

  try {
    const token = await exchangeCode(code, stateRow.code_verifier)
    if (token.id_token) {
      try {
        await verifyIdToken(token.id_token)
      } catch (e) {
        // 仅当 JWKS 暂时不可用（网络/502）时回退；签名、issuer、aud、过期等校验失败仍拒绝登录。
        // access_token 是服务端用 client_secret 从 token 接口换来的，userinfo 会再次验证它。
        if (e instanceof JwksError) {
          console.warn(
            '[auth] id_token 暂时无法校验（JWKS 不可用），继续使用 userinfo 验证身份:',
            e.message,
          )
        } else {
          throw e
        }
      }
    }
    const info = await fetchUserInfo(String(token.access_token))

    const sub = String(info.sub || info.sso_sub || token.sso_sub || '').trim()
    if (!sub) throw new Error('UniSSO 未返回用户标识 sub')

    const email = String(info.email || '').trim().toLowerCase()
    const name =
      String(info.name || info.preferred_username || '').trim().slice(0, 60) ||
      (email ? email.split('@')[0] : '') ||
      `用户${sub.slice(0, 6)}`
    const avatar = String(info.picture || '').trim().slice(0, 500)
    const roles = Array.isArray(info.roles) ? info.roles.map(String).join(',') : ''
    const sseSub = String(token.sse_sub || info.sse_sub || '').trim()
    const internal = info.internal === true ? 1 : 0
    const t = now()

    let user = s.users.find((u) => u.sso_sub && u.sso_sub === sub)
    // 邮箱是账号主键：同邮箱的历史账号自动合并；无 sub 匹配时按邮箱认领
    const byEmail = email ? findUniqueUserByEmail(email, sub) : null
    if (user && byEmail && byEmail.id !== user.id) {
      mergeUserRows(user, byEmail)
    }
    if (!user) user = byEmail || undefined
    if (!user) {
      const id = db.nextId('users')
      const isSuper = isAdminSub(sub)
      user = {
        id,
        email,
        name,
        is_admin: isSuper ? 1 : 0,
        system_role: isSuper ? 'super_admin' : 'user',
        reviewer_role: '',
        avatar,
        sso_sub: sub,
        sse_sub: sseSub,
        internal,
        roles,
        provider: 'sso',
        last_login_at: t,
        developer_no: developerNoFor(id),
        developer_level: 'market',
        primary_department_id: 0,
        department_joined_at: '',
        roundtable_joined_at: '',
        status: 'active',
        developer_bio: '',
        developer_skills: '',
        developer_links: '',
        created_at: t,
      }
      s.users.push(user)
    } else {
      if (email) user.email = email
      if (name) user.name = name
      if (avatar) user.avatar = avatar
      if (sseSub) user.sse_sub = sseSub
      if (sub) user.sso_sub = sub
      user.internal = internal
      user.roles = roles
      user.provider = 'sso'
      if (isAdminSub(user.sso_sub)) {
        user.is_admin = 1
        user.system_role = 'super_admin'
      }
      user.last_login_at = t
    }
    // 底座：注册/登录即成为「软工集市开发者」，无需审批
    ensureDeveloperProfile(user)
    await db.persist()

    const sessionToken = createSessionToken({ uid: user.id, email: user.email })
    setSessionCookie(req, res, sessionToken)
    res.redirect(stateRow.return_to || config.unisso.defaultReturnTo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '统一登录失败'
    console.error('[auth] SSO 回调失败:', msg)
    loginErrorRedirect(res, msg)
  }
})

// ===== 会话探测（匿名返回 user:null，避免前端初始请求产生 401 噪音） =====
authRouter.get('/session', (req, res) => {
  const user = getCurrentUser(req)
  ok(res, { user: user ? mapUser(user) : null })
})

// ===== 当前用户 =====
authRouter.get('/me', requireUser, (req, res) => {
  const user = getCurrentUser(req)
  if (!user) {
    fail(res, 401, '用户不存在')
    return
  }
  ok(res, mapUser(user))
})

// ===== 退出：本地会话 + 父域 SSO 会话一起清（单点登出） =====
authRouter.post('/logout', async (req, res) => {
  const sid = String(parseCookies(req.headers.cookie)[SSO_COOKIE] || '').trim()
  if (sid) await revokeSession(sid)
  clearSessionCookie(req, res)
  clearSsoCookie(res)
  ok(res, { done: true }, '已退出')
})

// ===== 管理员登录：邮箱 + 密码（UniSSO 无感校验，不跳转） =====
authRouter.post('/login', async (req, res) => {
  if (!isUnissoConfigured()) {
    fail(res, 500, '统一身份未配置，无法登录管理后台')
    return
  }
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!EMAIL_RE.test(email)) {
    fail(res, 400, '邮箱格式不正确')
    return
  }
  if (!password) {
    fail(res, 400, '请输入密码')
    return
  }

  let result
  try {
    result = await verifyPassword(email, password)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '统一身份服务暂时不可用'
    console.error('[auth] UniSSO 密码校验失败:', msg)
    fail(res, 502, '统一身份服务暂时不可用，请稍后再试')
    return
  }
  if (result.status === 401) {
    fail(res, 401, '邮箱或密码错误')
    return
  }
  if (result.status === 429) {
    fail(res, 429, result.message || '尝试过于频繁，请稍后再试')
    return
  }
  if (result.status !== 200 || !result.ok) {
    fail(res, 502, result.message || result.error || '统一身份校验失败')
    return
  }

  const u = result.user || {}
  const sub = String(u.sub || u.sso_sub || '').trim()
  if (!sub) {
    fail(res, 502, '统一身份未返回用户标识 sub')
    return
  }
  // 管理端只对软件工程学院内部成员开放
  if (u.internal !== true) {
    fail(res, 403, '该账号不属于软件工程学院内部成员，无法进入管理后台')
    return
  }
  if (!isAdminSub(sub)) {
    fail(res, 403, '该账号无后台管理权限')
    return
  }

  const user = await persistAdminLogin(u, email)

  const token = createSessionToken({ uid: user.id, email: user.email })
  setSessionCookie(req, res, token)
  // 密码校验成功时 unisso 已签发父域 SSO 会话：原样种给浏览器
  if (result.sso_session) {
    setSsoCookie(res, result.sso_session, {
      name: result.sso_cookie_name,
      domain: result.sso_cookie_domain,
      maxAge: result.sso_max_age,
    })
  }
  ok(res, { token, user: mapUser(user) }, '登录成功')
})

/**
 * 静默 SSO：浏览器带上父域 sse_sso Cookie，服务端向 UniSSO session/verify
 * 换取身份。仅院内 + 管理员白名单可进入后台；其他人 401，前端静默回落表单。
 */
authRouter.post('/sso/try', async (req, res) => {
  if (!isUnissoConfigured()) {
    fail(res, 503, '统一身份未配置')
    return
  }
  if (!allowSsoTry(String(req.ip || ''))) {
    fail(res, 429, '尝试过于频繁，请稍后再试')
    return
  }

  const sid = String(parseCookies(req.headers.cookie)[SSO_COOKIE] || '').trim()
  if (!sid) {
    fail(res, 401, 'no_sso')
    return
  }

  let result
  try {
    result = await verifySession(sid)
  } catch (e) {
    console.error('[auth] UniSSO 会话校验失败:', e instanceof Error ? e.message : e)
    fail(res, 503, 'sso_unavailable')
    return
  }
  if (result.status === 401) {
    clearSsoCookie(res)
    fail(res, 401, 'invalid_sso')
    return
  }
  if (result.status !== 200 || !result.ok) {
    fail(res, 503, 'sso_unavailable')
    return
  }

  const u = result.user || {}
  const sub = String(u.sub || u.sso_sub || '').trim()
  if (!sub) {
    fail(res, 502, '统一身份未返回用户标识 sub')
    return
  }
  if (u.internal !== true) {
    fail(res, 401, 'not_internal')
    return
  }
  if (!isAdminSub(sub)) {
    fail(res, 401, 'not_admin')
    return
  }

  const email = String(u.email || '').trim().toLowerCase()
  const user = await persistAdminLogin(u, email)
  const token = createSessionToken({ uid: user.id, email: user.email })
  setSessionCookie(req, res, token)
  ok(res, { token, user: mapUser(user) }, '登录成功')
})
