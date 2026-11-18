import { Router } from 'express'
import { db, now, type HallOfFameRow, type HistoryChapterRow, type UserRow } from '../db.js'
import { fail, ok } from '../middleware.js'
import {
  HALL_DEFAULT_DEPARTMENT,
  HALL_DEPARTMENTS,
  userNameOf,
} from '../services/hall.js'

export const historyRouter = Router()

function sortedChapters(): HistoryChapterRow[] {
  return [...db.getStore().history_chapters]
    .filter((c) => c.enabled === 1)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

function displayName(user: UserRow): string {
  return userNameOf(user)
}

function str(v: unknown, max: number): string {
  return String(v ?? '')
    .trim()
    .slice(0, max)
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

/** 邀请链接有效的条件：未被撤销、未过期、用户仍存在 */
function resolveInvite(token: string) {
  const s = db.getStore()
  const invite = s.hall_invites.find((x) => x.token === token)
  if (!invite) return { error: 404 as const, message: '邀请链接无效或已失效' }
  if (invite.status === 'revoked') {
    return { error: 410 as const, message: '邀请链接已被撤销，请联系管理员重新发送' }
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: 410 as const, message: '邀请链接已过期，请联系管理员重新发送' }
  }
  const user = s.users.find((u) => u.id === invite.user_id)
  if (!user) return { error: 404 as const, message: '邀请对应的用户不存在' }
  return { invite, user }
}

/**
 * 名人堂成员必须对应系统注册用户：展示时以用户当前资料为准。
 * 关联用户已不存在的条目不再公开（legacy user_id=0 的旧数据仍保留）。
 */
function sortedHallOfFame(): HallOfFameRow[] {
  const users = new Map(db.getStore().users.map((u) => [u.id, u]))
  return [...db.getStore().hall_of_fame]
    .filter((h) => h.enabled === 1)
    .filter((h) => !h.user_id || users.has(h.user_id))
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((h) => {
      const user = h.user_id ? users.get(h.user_id) : null
      return user
        ? { ...h, name: displayName(user), avatar: h.avatar || user.avatar }
        : h
    })
}

/** GET /api/history — 公开的集市历史长文档 + 名人堂 */
historyRouter.get('/', (_req, res) => {
  const s = db.getStore()
  const chapters = sortedChapters()
  const hallOfFame = sortedHallOfFame()
  const stamps = [
    s.history_settings.updated_at,
    ...chapters.map((c) => c.updated_at),
    ...hallOfFame.map((h) => h.updated_at),
  ].filter(Boolean)
  const updatedAt = stamps.sort().at(-1) || s.history_settings.updated_at
  ok(res, {
    settings: {
      title: s.history_settings.title,
      subtitle: s.history_settings.subtitle,
      hall_title: s.history_settings.hall_title,
      hall_intro: s.history_settings.hall_intro,
    },
    chapters,
    hallOfFame,
    updatedAt,
  })
})

// ===== 名人堂资料填写邀请（公开 token，无需登录） =====

historyRouter.get('/invite/:token', (req, res) => {
  const resolved = resolveInvite(String(req.params.token || '').trim())
  if ('error' in resolved) {
    fail(res, resolved.error ?? 500, resolved.message || '邀请链接不可用')
    return
  }
  const { invite, user } = resolved
  const entry = db
    .getStore()
    .hall_of_fame.find((h) => h.user_id === user.id) || null
  ok(res, {
    invite: {
      token: invite.token,
      department: invite.department,
      title: invite.title,
      status: invite.status,
      expires_at: invite.expires_at,
    },
    user: {
      id: user.id,
      name: displayName(user),
      email: user.email,
      avatar: user.avatar,
      developer_no: user.developer_no,
    },
    entry: entry
      ? { ...entry, name: displayName(user), avatar: entry.avatar || user.avatar }
      : null,
    departments: HALL_DEPARTMENTS,
  })
})

historyRouter.post('/invite/:token', async (req, res) => {
  const resolved = resolveInvite(String(req.params.token || '').trim())
  if ('error' in resolved) {
    fail(res, resolved.error ?? 500, resolved.message || '邀请链接不可用')
    return
  }
  const { invite, user } = resolved
  const b = (req.body || {}) as Record<string, unknown>

  // 邀请页不展示部门选择，统一默认软工集市；管理员可在后台调整
  const department = HALL_DEFAULT_DEPARTMENT
  const bio = String(b.bio ?? '').trim().slice(0, 8000)
  if (!bio) {
    fail(res, 400, '请填写介绍')
    return
  }
  const marketUrl = str(b.market_url, 500)
  if (!validHttpUrl(marketUrl)) {
    fail(res, 400, '集市主页链接需以 http:// 或 https:// 开头')
    return
  }
  const contactEmail = str(b.contact_email, 120)
  if (!validEmail(contactEmail)) {
    fail(res, 400, '联系邮箱格式不正确')
    return
  }

  const s = db.getStore()
  const t = now()
  let entry = s.hall_of_fame.find((h) => h.user_id === user.id) || null
  const payload = {
    title: str(b.title, 80),
    department,
    year: str(b.year, 40),
    quote: str(b.quote, 300),
    bio,
    achievements: str(b.achievements, 6000),
    user_submitted: 1,
    market_url: marketUrl,
    contact_email: contactEmail,
    contact_wechat: str(b.contact_wechat, 120),
    contact_other: str(b.contact_other, 500),
    name: displayName(user),
    updated_at: t,
  }
  if (entry) {
    Object.assign(entry, payload, { avatar: entry.avatar || user.avatar })
  } else {
    const maxSort = s.hall_of_fame.reduce((m, h) => Math.max(m, h.sort_order), 0)
    entry = {
      id: db.nextId('hall_of_fame'),
      user_id: user.id,
      name: payload.name,
      avatar: user.avatar,
      title: payload.title,
      department: payload.department,
      year: payload.year,
      quote: payload.quote,
      bio: payload.bio,
      achievements: payload.achievements,
      user_submitted: 1,
      market_url: payload.market_url,
      contact_email: payload.contact_email,
      contact_wechat: payload.contact_wechat,
      contact_other: payload.contact_other,
      sort_order: maxSort + 1,
      enabled: 1,
      created_at: t,
      updated_at: t,
    }
    s.hall_of_fame.push(entry)
  }
  invite.status = 'submitted'
  invite.submitted_at = t
  await db.persist()
  ok(
    res,
    {
      entry: { ...entry, name: displayName(user), avatar: entry.avatar || user.avatar },
      message: '资料已保存',
    },
    '资料已保存',
  )
})