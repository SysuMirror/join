import { db, now, type UserRow } from '../db.js'
import { isAdminSub } from '../middleware.js'
import { unissoUserIsActive, type UnissoUserRecord } from '../unisso.js'
import { developerNoFor, ensureDeveloperProfile, findUniqueUserByEmail } from './org.js'

export function ssoSubOf(user: UnissoUserRecord): string {
  return String(user.sub || user.sso_sub || '').trim()
}

function cleanName(value: unknown): string {
  return String(value || '')
    .replace(/[​-‍﻿]/g, '')
    .trim()
    .slice(0, 60)
}

export function ssoNameOf(user: UnissoUserRecord): string {
  const email = String(user.email || '').trim()
  return (
    cleanName(user.name) ||
    cleanName(user.preferred_username) ||
    (email ? email.split('@')[0] : '') ||
    `SSO 用户 ${ssoSubOf(user).slice(0, 6)}`
  )
}

export function findLocalUserBySso(user: UnissoUserRecord): UserRow | null {
  const sub = ssoSubOf(user)
  const email = String(user.email || '').trim().toLowerCase()
  const s = db.getStore()
  if (sub) {
    const bySub = s.users.find((u) => u.sso_sub && u.sso_sub === sub)
    if (bySub) return bySub
  }
  if (email) return findUniqueUserByEmail(email, sub)
  return null
}

/**
 * 邀请前确保 SSO 用户在本地已有账号。
 * - 已存在：只补齐缺失字段，不覆盖管理员改过的名字；
 * - 不存在：按 SSO 资料自动创建「集市开发者」。
 */
export function ensureLocalUserFromUnisso(user: UnissoUserRecord): {
  user: UserRow | null
  created: boolean
  error?: string
} {
  const sub = ssoSubOf(user)
  if (!sub) return { user: null, created: false, error: 'SSO 用户缺少 sub' }
  if (!unissoUserIsActive(user)) {
    return { user: null, created: false, error: '该 SSO 账号未激活，无法邀请' }
  }
  const email = String(user.email || '').trim().toLowerCase()
  if (!email) {
    return { user: null, created: false, error: '该 SSO 用户没有邮箱，无法发送邀请' }
  }
  const existing = findLocalUserBySso(user)
  if (existing) {
    if (!existing.email) existing.email = email
    if (!existing.name) existing.name = ssoNameOf(user)
    if (!existing.avatar) existing.avatar = String(user.picture || '').trim().slice(0, 500)
    if (!existing.sse_sub) existing.sse_sub = String(user.sse_sub || '').trim()
    if (!existing.sso_sub) existing.sso_sub = sub
    ensureDeveloperProfile(existing)
    return { user: existing, created: false }
  }

  const t = now()
  const id = db.nextId('users')
  const isSuper = isAdminSub(sub)
  const created: UserRow = {
    id,
    email,
    name: ssoNameOf(user),
    is_admin: isSuper ? 1 : 0,
    system_role: isSuper ? 'super_admin' : 'user',
    reviewer_role: '',
    avatar: String(user.picture || '').trim().slice(0, 500),
    sso_sub: sub,
    sse_sub: String(user.sse_sub || '').trim(),
    internal: user.internal === true ? 1 : 0,
    roles: '',
    provider: 'unisso',
    last_login_at: '',
    developer_no: developerNoFor(id),
    developer_level: 'market',
    primary_department_id: 0,
    department_joined_at: '',
    roundtable_joined_at: '',
    status: 'active',
    developer_bio: '',
    developer_skills: '',
    developer_links: '',
    sso_developer: 0,
    sso_developer_at: '',
    created_at: t,
  }
  ensureDeveloperProfile(created)
  db.getStore().users.push(created)
  return { user: created, created: true }
}