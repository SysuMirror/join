import { db, now, type UserRow } from '../db.js'
import { isUnissoConfigured } from '../config.js'
import { updateUnissoDeveloper } from '../unisso.js'

/** 登录时的开通请求最多等这么久，超时只记日志（不拖慢登录），下次登录再试。 */
const LOGIN_SYNC_TIMEOUT_MS = 4_000

/**
 * 把本地开发者身份同步到 UniSSO（is_developer=true）。
 * 失败只记日志，不阻断本地进组 / 报名流程；成功则写回本地标记。
 */
export async function syncUnissoDeveloper(
  user: UserRow,
  timeoutMs = 12_000,
): Promise<boolean> {
  if (user.sso_developer === 1) return true
  const email = (user.email || '').trim().toLowerCase()
  if (!email || !isUnissoConfigured()) return false
  try {
    const result = await updateUnissoDeveloper(email, true, timeoutMs)
    if (!result.ok || result.status >= 400 || result.developer === false) {
      console.warn(
        `[unisso] 开发者权限同步失败 uid=${user.id} status=${result.status} ${result.message || result.error || ''}`,
      )
      return false
    }
    user.sso_developer = 1
    user.sso_developer_at = now()
    return true
  } catch (e) {
    console.warn(
      `[unisso] 开发者权限同步异常 uid=${user.id}: ${e instanceof Error ? e.message : e}`,
    )
    return false
  }
}

/**
 * 登录即自动开通开发者权限（不再需要申请加入软工集市团队）。
 * - 已是开发者 / 已退出 / 缺邮箱 / SSO 未配置：直接跳过；
 * - 失败不阻断登录，只记日志；
 * - 成功后立即落盘，即使调用方之后不再 persist 也不会丢标记。
 */
export async function autoGrantDeveloperOnLogin(user: UserRow): Promise<boolean> {
  if (user.sso_developer === 1) return true
  if (user.status !== 'active') return false
  const email = (user.email || '').trim()
  if (!email || !isUnissoConfigured()) return false
  const granted = await syncUnissoDeveloper(user, LOGIN_SYNC_TIMEOUT_MS)
  if (granted) {
    console.log(`[unisso] 登录自动开通开发者权限 uid=${user.id}`)
    await db.persist()
  }
  return granted
}