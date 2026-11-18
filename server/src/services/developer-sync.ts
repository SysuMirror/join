import { now, type UserRow } from '../db.js'
import { isUnissoConfigured } from '../config.js'
import { updateUnissoDeveloper } from '../unisso.js'

/**
 * 把本地开发者身份同步到 UniSSO（is_developer=true）。
 * 失败只记日志，不阻断本地进组 / 报名流程；成功则写回本地标记。
 */
export async function syncUnissoDeveloper(user: UserRow): Promise<boolean> {
  if (user.sso_developer === 1) return true
  const email = (user.email || '').trim().toLowerCase()
  if (!email || !isUnissoConfigured()) return false
  try {
    const result = await updateUnissoDeveloper(email, true)
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