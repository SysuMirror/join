import { computed, reactive } from 'vue'
import { api, type AuthUser } from '../api'

type AuthState = {
  user: AuthUser | null
  loaded: boolean
  loading: boolean
}

const state = reactive<AuthState>({ user: null, loaded: false, loading: false })
let inflight: Promise<AuthUser | null> | null = null

async function ensure(force = false): Promise<AuthUser | null> {
  if (state.loaded && !force) return state.user
  if (inflight) return inflight
  state.loading = true
  inflight = (async () => {
    try {
      const res = await api.session()
      const u = res?.user || null
      state.user = u
      return u
    } catch {
      state.user = null
      return null
    } finally {
      state.loaded = true
      state.loading = false
      inflight = null
    }
  })()
  return inflight
}

function setUser(u: AuthUser | null) {
  state.user = u
  state.loaded = true
}

async function logout() {
  try {
    await api.logout()
  } catch {
    /* ignore */
  }
  clearLocal()
}

function clearLocal() {
  localStorage.removeItem('join_session_token')
  state.user = null
  state.loaded = true
}

export type SsoProbeResult = 'ok' | 'expired' | 'unavailable'

let ssoProbed = false

/**
 * 共享父域 sse_sso Cookie 探测（每次页面加载最多一次，路由守卫与登录页共用）。
 * - ok：SSO 管理员身份已落地本地（token + user）；
 * - expired（401 no_sso/invalid_sso/not_internal/not_admin）：父域会话不可用；
 *   注意 not_admin 也可能是普通集市账号的 Cookie，路由守卫只对 staff 会话做单点登出；
 * - unavailable（503 / 网络）：UniSSO 不可达，调用方保留本地会话，不踢人。
 */
async function probeSharedSso(): Promise<SsoProbeResult> {
  if (ssoProbed) return 'unavailable'
  ssoProbed = true
  try {
    const r = await api.ssoTry()
    if (r?.user) {
      localStorage.setItem('join_session_token', r.token)
      setUser(r.user)
      return 'ok'
    }
    return 'unavailable'
  } catch (e) {
    const status = (e as { status?: number } | null)?.status
    return status === 401 ? 'expired' : 'unavailable'
  }
}

export function useAuth() {
  return {
    state,
    user: computed(() => state.user),
    isAdmin: computed(() => Boolean(state.user?.is_admin)),
    isStaff: computed(() => Boolean(state.user?.is_admin || state.user?.is_staff)),
    isLoggedIn: computed(() => Boolean(state.user)),
    ensure,
    setUser,
    clearLocal,
    probeSharedSso,
    logout,
  }
}
