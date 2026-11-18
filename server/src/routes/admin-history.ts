import crypto from 'node:crypto'
import { Router } from 'express'
import {
  db,
  now,
  type HallInviteRow,
  type HallOfFameRow,
  type HistoryChapterRow,
  type HistorySettingsRow,
} from '../db.js'
import { ok, fail, requireGlobalAdmin, getCurrentUser } from '../middleware.js'
import {
  HALL_DEFAULT_DEPARTMENT,
  HALL_DEPARTMENTS,
  isHallDepartment,
  userNameOf,
} from '../services/hall.js'
import { isMailConfigured, sendHallInviteMail } from '../services/mail.js'
import { ensureLocalUserFromUnisso } from '../services/sso-users.js'
import {
  cachedRecordBySub,
  ensureSsoDirectory,
  getDirectory,
} from '../services/user-directory.js'
import type { UserRow } from '../db.js'
import { config } from '../config.js'

/**
 * 集市历史 / 名人堂管理（仅超级管理员）。
 * 挂在 /api/admin/history，使用独立路由，避免与 admin.ts 的部门权限逻辑耦合。
 */
export const adminHistoryRouter = Router()

adminHistoryRouter.use(requireGlobalAdmin)

function str(v: unknown, max: number): string {
  return String(v ?? '')
    .trim()
    .slice(0, max)
}

function num(v: unknown, min: number, max: number, fallback = 0): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function validHttpUrl(v: string): boolean {
  if (!v) return true
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function validEmail(v: string): boolean {
  return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function sortedChapters(includeDisabled: boolean): HistoryChapterRow[] {
  return [...db.getStore().history_chapters]
    .filter((c) => includeDisabled || c.enabled === 1)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

function sortedHallOfFame(includeDisabled: boolean): HallOfFameRow[] {
  return [...db.getStore().hall_of_fame]
    .filter((h) => includeDisabled || h.enabled === 1)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

// ===== 元信息 =====

adminHistoryRouter.get('/meta', (_req, res) => {
  ok(res, { departments: HALL_DEPARTMENTS, mailConfigured: isMailConfigured() })
})

/**
 * 邀请用用户目录：优先查询 UniSSO 全量用户（含未在本平台注册的人），
 * SSO 暂不可用时回退到本地已注册用户。
 */
adminHistoryRouter.get('/sso-users', async (req, res) => {
  const q = String(req.query.q || '').trim()
  const force = String(req.query.refresh || '') === '1'
  const page = await getDirectory(q, {
    includeUnregistered: true,
    force,
    limit: 300,
  })
  const ssoAvailable = Boolean(db.getStore().sso_user_cache.updated_at)
  ok(res, {
    users: page.users,
    ssoAvailable,
    warning: page.warning,
    cachedAt: page.cachedAt,
    stale: page.stale,
  })
})

// ===== 页面文案 =====

adminHistoryRouter.get('/settings', (_req, res) => {
  ok(res, db.getStore().history_settings)
})

adminHistoryRouter.put('/settings', async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const hs: HistorySettingsRow = db.getStore().history_settings
  if (b.title != null) hs.title = str(b.title, 80) || '软工集市历史'
  if (b.subtitle != null) hs.subtitle = str(b.subtitle, 500)
  if (b.hall_title != null) hs.hall_title = str(b.hall_title, 80) || '名人堂'
  if (b.hall_intro != null) hs.hall_intro = str(b.hall_intro, 800)
  hs.updated_at = now()
  await db.persist()
  ok(res, hs, '年鉴页文案已更新')
})

// ===== 章节 =====

adminHistoryRouter.get('/chapters', (_req, res) => {
  ok(res, sortedChapters(true))
})

function readChapterBody(
  b: Record<string, unknown>,
  existing?: HistoryChapterRow,
): { row: HistoryChapterRow | null; error?: string } {
  const title = b.title != null ? str(b.title, 120) : existing?.title || ''
  if (!title) return { row: null, error: '章节标题必填' }
  const content = b.content != null ? String(b.content).slice(0, 60000) : existing?.content || ''
  const base: HistoryChapterRow = {
    id: existing?.id || 0,
    kicker: b.kicker != null ? str(b.kicker, 40) : existing?.kicker || '',
    title,
    summary: b.summary != null ? str(b.summary, 400) : existing?.summary || '',
    era: b.era != null ? str(b.era, 40) : existing?.era || '',
    content,
    sort_order:
      b.sort_order != null
        ? num(b.sort_order, -9999, 9999, existing?.sort_order ?? 0)
        : existing?.sort_order ?? 0,
    enabled:
      b.enabled != null
        ? b.enabled === false || b.enabled === 0
          ? 0
          : 1
        : existing?.enabled ?? 1,
    created_at: existing?.created_at || '',
    updated_at: now(),
  }
  return { row: base }
}

adminHistoryRouter.post('/chapters', async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const parsed = readChapterBody(b)
  if (!parsed.row) {
    fail(res, 400, parsed.error || '参数不正确')
    return
  }
  const t = now()
  const row: HistoryChapterRow = {
    ...parsed.row,
    id: db.nextId('history_chapters'),
    created_at: t,
    updated_at: t,
  }
  db.getStore().history_chapters.push(row)
  await db.persist()
  ok(res, row, '章节已创建')
})

adminHistoryRouter.put('/chapters/:id', async (req, res) => {
  const row = db.getStore().history_chapters.find((c) => c.id === Number(req.params.id))
  if (!row) {
    fail(res, 404, '章节不存在')
    return
  }
  const b = (req.body || {}) as Record<string, unknown>
  const parsed = readChapterBody(b, row)
  if (!parsed.row) {
    fail(res, 400, parsed.error || '参数不正确')
    return
  }
  Object.assign(row, parsed.row, { id: row.id, created_at: row.created_at })
  await db.persist()
  ok(res, row, '章节已更新')
})

adminHistoryRouter.delete('/chapters/:id', async (req, res) => {
  const s = db.getStore()
  const id = Number(req.params.id)
  const idx = s.history_chapters.findIndex((c) => c.id === id)
  if (idx < 0) {
    fail(res, 404, '章节不存在')
    return
  }
  s.history_chapters.splice(idx, 1)
  await db.persist()
  ok(res, { id }, '章节已删除')
})

// ===== 名人堂 =====

/** 名人堂成员关联的用户摘要（供后台展示与下拉选择） */
function mapHall(h: HallOfFameRow) {
  const user = db.getStore().users.find((u) => u.id === h.user_id) || null
  return {
    ...h,
    name: user ? userNameOf(user) : h.name,
    avatar: h.avatar || user?.avatar || '',
    /** 管理员自定义头像；留空表示跟随系统用户头像 */
    custom_avatar: h.avatar,
    user: user
      ? {
          id: user.id,
          name: userNameOf(user),
          email: user.email,
          avatar: user.avatar,
          developer_no: user.developer_no,
          developer_level: user.developer_level,
        }
      : null,
  }
}

adminHistoryRouter.get('/hall', (_req, res) => {
  ok(res, sortedHallOfFame(true).map(mapHall))
})

function readHallBody(
  b: Record<string, unknown>,
  existing?: HallOfFameRow,
): { row: HallOfFameRow | null; error?: string } {
  const pick = (key: keyof HallOfFameRow, max: number): string =>
    b[key] != null ? str(b[key], max) : (existing?.[key] as string) || ''
  const userId =
    b.user_id != null
      ? num(b.user_id, 1, 99999999, 0)
      : existing?.user_id ?? 0
  const user = db.getStore().users.find((u) => u.id === userId)
  if (!user) {
    return { row: null, error: '请从系统已注册用户中选择名人堂成员' }
  }
  const department = pick('department', 40) || HALL_DEFAULT_DEPARTMENT
  if (!isHallDepartment(department)) {
    return { row: null, error: `部门请选择：${HALL_DEPARTMENTS.join(' / ')}` }
  }
  const marketUrl = pick('market_url', 500)
  if (!validHttpUrl(marketUrl)) {
    return { row: null, error: '集市主页链接需以 http:// 或 https:// 开头' }
  }
  const email = pick('contact_email', 120)
  if (!validEmail(email)) return { row: null, error: '联系邮箱格式不正确' }
  const avatar = pick('avatar', 500)
  if (avatar && !validHttpUrl(avatar) && !avatar.startsWith('/')) {
    return { row: null, error: '头像地址需为 http(s) 链接或站内路径' }
  }
  const lockedByUser = existing?.user_submitted === 1
  const row: HallOfFameRow = {
    id: existing?.id || 0,
    user_id: user.id,
    name: userNameOf(user),
    avatar: avatar || user.avatar,
    title: pick('title', 80),
    department,
    year: pick('year', 40),
    // 寄语与自我介绍由本人在邀请页填写，管理员不可覆盖
    quote: lockedByUser ? existing?.quote || '' : pick('quote', 300),
    bio: lockedByUser ? existing?.bio || '' : pick('bio', 8000),
    achievements: pick('achievements', 6000),
    user_submitted: existing?.user_submitted === 1 ? 1 : 0,
    market_url: marketUrl,
    contact_email: email,
    contact_wechat: pick('contact_wechat', 120),
    contact_other: pick('contact_other', 500),
    sort_order:
      b.sort_order != null
        ? num(b.sort_order, -9999, 9999, existing?.sort_order ?? 0)
        : existing?.sort_order ?? 0,
    enabled:
      b.enabled != null
        ? b.enabled === false || b.enabled === 0
          ? 0
          : 1
        : existing?.enabled ?? 1,
    created_at: existing?.created_at || '',
    updated_at: now(),
  }
  return { row }
}

adminHistoryRouter.post('/hall', async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const parsed = readHallBody(b)
  if (!parsed.row) {
    fail(res, 400, parsed.error || '参数不正确')
    return
  }
  const t = now()
  if (b.sort_order == null) {
    const maxSort = db.getStore().hall_of_fame.reduce((m, h) => Math.max(m, h.sort_order), 0)
    parsed.row.sort_order = maxSort + 1
  }
  const row: HallOfFameRow = {
    ...parsed.row,
    id: db.nextId('hall_of_fame'),
    created_at: t,
    updated_at: t,
  }
  db.getStore().hall_of_fame.push(row)
  await db.persist()
  ok(res, mapHall(row), '名人堂成员已添加')
})

adminHistoryRouter.put('/hall/:id', async (req, res) => {
  const row = db.getStore().hall_of_fame.find((h) => h.id === Number(req.params.id))
  if (!row) {
    fail(res, 404, '名人堂成员不存在')
    return
  }
  const b = (req.body || {}) as Record<string, unknown>
  const parsed = readHallBody(b, row)
  if (!parsed.row) {
    fail(res, 400, parsed.error || '参数不正确')
    return
  }
  Object.assign(row, parsed.row, { id: row.id, created_at: row.created_at })
  await db.persist()
  ok(res, mapHall(row), '名人堂成员已更新')
})

adminHistoryRouter.delete('/hall/:id', async (req, res) => {
  const s = db.getStore()
  const id = Number(req.params.id)
  const idx = s.hall_of_fame.findIndex((h) => h.id === id)
  if (idx < 0) {
    fail(res, 404, '名人堂成员不存在')
    return
  }
  s.hall_of_fame.splice(idx, 1)
  await db.persist()
  ok(res, { id }, '名人堂成员已删除')
})

/** 管理员通过拖动/上下移动后提交完整顺序，统一重写 sort_order */
adminHistoryRouter.post('/hall/reorder', async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const ids = Array.isArray(b.ids)
    ? b.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
    : []
  const s = db.getStore()
  const map = new Map(s.hall_of_fame.map((h) => [h.id, h]))
  const unique = new Set(ids)
  if (
    !ids.length ||
    unique.size !== ids.length ||
    ids.length !== s.hall_of_fame.length ||
    ids.some((id) => !map.has(id))
  ) {
    fail(res, 400, '排序列表不完整，请刷新后重试')
    return
  }
  ids.forEach((id, index) => {
    const row = map.get(id)
    if (row) {
      row.sort_order = index + 1
      row.updated_at = now()
    }
  })
  await db.persist()
  ok(res, sortedHallOfFame(true).map(mapHall), '排序已更新')
})

// ===== 名人堂填写邀请 =====

function inviteLink(token: string): string {
  return `${config.publicBase.replace(/\/$/, '')}/hall-invite/${token}`
}

function mapInvite(inv: HallInviteRow) {
  const user = db.getStore().users.find((u) => u.id === inv.user_id) || null
  const expired = Boolean(inv.expires_at && new Date(inv.expires_at).getTime() < Date.now())
  return {
    ...inv,
    expired,
    link: inviteLink(inv.token),
    user: user
      ? {
          id: user.id,
          name: userNameOf(user),
          email: user.email,
          avatar: user.avatar,
          developer_no: user.developer_no,
        }
      : null,
  }
}

adminHistoryRouter.get('/invites', (_req, res) => {
  const rows = [...db.getStore().hall_invites].sort((a, b) => b.id - a.id)
  ok(res, rows.map(mapInvite))
})

type InviteTargetInput = { user_id?: unknown; sso_sub?: unknown }

/** 解析邀请对象：本地用户 id 或 SSO sub；未注册的 SSO 用户会自动建号。 */
async function resolveInviteTarget(
  target: InviteTargetInput,
): Promise<{ user?: UserRow; created?: boolean; error?: string }> {
  const userId = num(target.user_id, 1, 99999999, 0)
  if (userId) {
    const user = db.getStore().users.find((u) => u.id === userId)
    return user ? { user } : { error: '用户不存在' }
  }
  const sub = str(target.sso_sub, 128)
  if (!sub) return { error: '请选择邀请用户' }
  const local = db.getStore().users.find((u) => u.sso_sub && u.sso_sub === sub)
  if (local) return { user: local }

  // 优先使用 Pod 内缓存的 SSO 目录；缓存里没有时再强制刷新一次
  let record = cachedRecordBySub(sub)
  if (!record) {
    const status = await ensureSsoDirectory(true)
    if (status.warning && !db.getStore().sso_user_cache.users.length) {
      return { error: `无法查询 SSO 用户目录：${status.warning}` }
    }
    record = cachedRecordBySub(sub)
  }
  if (!record) return { error: 'SSO 用户目录中未找到该用户' }
  const ensured = ensureLocalUserFromUnisso(record)
  if (!ensured.user) return { error: ensured.error || '自动创建本地账号失败' }
  if (ensured.created) await db.persist()
  return { user: ensured.user, created: ensured.created }
}

async function createInviteForUser(
  user: UserRow,
  department: string,
  title: string,
  days: number,
  createdBy: string,
): Promise<
  | { invite: HallInviteRow; link: string; emailSent: boolean }
  | { error: string }
> {
  if (!user.email) return { error: '该用户没有邮箱，无法发送填写邀请' }
  const s = db.getStore()
  // 同一用户只保留一个有效链接；旧链接立即失效
  for (const inv of s.hall_invites) {
    if (
      inv.user_id === user.id &&
      (inv.status === 'pending' || inv.status === 'submitted')
    ) {
      inv.status = 'revoked'
    }
  }
  const t = now()
  const invite: HallInviteRow = {
    id: db.nextId('hall_invites'),
    user_id: user.id,
    token: crypto.randomBytes(24).toString('hex'),
    department,
    title,
    status: 'pending',
    expires_at: new Date(Date.now() + days * 86400_000).toISOString(),
    created_by: createdBy,
    created_at: t,
    sent_at: '',
    submitted_at: '',
  }
  s.hall_invites.push(invite)
  await db.persist()
  const link = inviteLink(invite.token)
  const emailSent = await sendHallInviteMail({
    to: user.email,
    name: userNameOf(user),
    link,
    department,
    expiresAt: invite.expires_at.slice(0, 10),
  })
  if (emailSent) {
    invite.sent_at = now()
    await db.persist()
  }
  return { invite, link, emailSent }
}

adminHistoryRouter.post('/invites', async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const resolved = await resolveInviteTarget(b)
  if (!resolved.user) {
    fail(res, 400, resolved.error || '请选择邀请用户')
    return
  }
  // 邀请填写页不再让本人选部门，固定为软工集市；管理员之后可在成员编辑里调整
  const department = HALL_DEFAULT_DEPARTMENT
  const title = str(b.title, 80)
  const days = num(b.expires_days, 1, 90, 14)
  const created = await createInviteForUser(
    resolved.user,
    department,
    title,
    days,
    getCurrentUser(req)?.email || 'admin',
  )
  if ('error' in created) {
    fail(res, 400, created.error)
    return
  }
  ok(
    res,
    { invite: mapInvite(created.invite), link: created.link, emailSent: created.emailSent },
    created.emailSent
      ? '邀请邮件已发送'
      : '邀请已创建，但邮件发送失败；请复制链接手动发送',
  )
})

/** 批量邀请：一次选择多个 SSO 用户；未注册的自动建号。 */
adminHistoryRouter.post('/invites/batch', async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const rawTargets = Array.isArray(b.users) ? (b.users as InviteTargetInput[]) : []
  const seen = new Set<string>()
  const targets = rawTargets.filter((t) => {
    const key =
      num(t.user_id, 1, 99999999, 0) > 0
        ? `id:${num(t.user_id, 1, 99999999, 0)}`
        : `sso:${str(t.sso_sub, 128)}`
    if (!key || key === 'sso:' || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (!targets.length) {
    fail(res, 400, '请至少选择一位邀请对象')
    return
  }
  if (targets.length > 100) {
    fail(res, 400, '单次最多邀请 100 人')
    return
  }
  const department = HALL_DEFAULT_DEPARTMENT
  const title = str(b.title, 80)
  const days = num(b.expires_days, 1, 90, 14)
  const createdBy = getCurrentUser(req)?.email || 'admin'

  const results: Array<Record<string, unknown>> = []
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]
    const resolved = await resolveInviteTarget(target)
    if (!resolved.user) {
      results.push({
        ok: false,
        index,
        user_id: num(target.user_id, 1, 99999999, 0),
        sso_sub: str(target.sso_sub, 128),
        error: resolved.error || '邀请对象解析失败',
      })
      continue
    }
    const user = resolved.user
    const created = await createInviteForUser(user, department, title, days, createdBy)
    if ('error' in created) {
      results.push({
        ok: false,
        index,
        user: { id: user.id, name: userNameOf(user), email: user.email },
        error: created.error,
      })
    } else {
      results.push({
        ok: true,
        index,
        user: { id: user.id, name: userNameOf(user), email: user.email },
        auto_created: Boolean(resolved.created),
        invite: mapInvite(created.invite),
        link: created.link,
        emailSent: created.emailSent,
      })
    }
  }
  const success = results.filter((r) => r.ok).length
  ok(
    res,
    {
      results,
      success,
      failed: results.length - success,
      emailSent: results.filter((r) => r.ok && r.emailSent).length,
    },
    `已处理 ${results.length} 人：成功 ${success}，失败 ${results.length - success}`,
  )
})

adminHistoryRouter.post('/invites/:id/resend', async (req, res) => {
  const invite = db.getStore().hall_invites.find((x) => x.id === Number(req.params.id))
  if (!invite) {
    fail(res, 404, '邀请不存在')
    return
  }
  const user = db.getStore().users.find((u) => u.id === invite.user_id)
  if (!user || !user.email) {
    fail(res, 400, '该用户没有可用的邮箱')
    return
  }
  // 过期或已撤销时重新生成链接；未过期的链接保持原样
  if (invite.status === 'revoked' || new Date(invite.expires_at).getTime() < Date.now()) {
    invite.token = crypto.randomBytes(24).toString('hex')
    invite.expires_at = new Date(Date.now() + 14 * 86400_000).toISOString()
    invite.status = 'pending'
    invite.submitted_at = ''
  }
  const link = inviteLink(invite.token)
  const emailSent = await sendHallInviteMail({
    to: user.email,
    name: userNameOf(user),
    link,
    department: invite.department,
    expiresAt: invite.expires_at.slice(0, 10),
  })
  if (emailSent) invite.sent_at = now()
  await db.persist()
  ok(
    res,
    { invite: mapInvite(invite), link, emailSent },
    emailSent ? '邀请邮件已重新发送' : '邮件发送失败，请复制链接手动发送',
  )
})

adminHistoryRouter.delete('/invites/:id', async (req, res) => {
  const invite = db.getStore().hall_invites.find((x) => x.id === Number(req.params.id))
  if (!invite) {
    fail(res, 404, '邀请不存在')
    return
  }
  invite.status = 'revoked'
  await db.persist()
  ok(res, mapInvite(invite), '邀请链接已撤销')
})