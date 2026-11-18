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

let ssoProbePromise: Promise<SsoProbeResult> | null = null

/**
 * 共享父域 SSO Cookie 探测（首屏 / 路由守卫 / 登录页共享同一次请求：单飞，
 * 后到者 await 同一 Promise 而不是拿到空的降级结果）。
 * - ok：SSO 管理员身份已落地本地（token + user）；
 * - expired（401 no_sso/invalid_sso/not_internal/not_admin）：父域会话不可用；
 *   调用方只能把它当作「没有可用的 SSO 会话」，不能据此推翻已建立的本地会话；
 * - unavailable（503 / 网络）：UniSSO 不可达，调用方保留本地会话，不踢人。
 */
function probeSharedSso(): Promise<SsoProbeResult> {
  if (!ssoProbePromise) {
    ssoProbePromise = (async () => {
      // invalid_sso = 浏览器带了共享 Cookie 但 SSO 暂不认（常见于刚授权完的短暂
      // 不一致）。隔一拍重试一次，避免把可用会话误判成失效；no_sso 不重试。
      for (let attempt = 0; ; attempt += 1) {
        try {
          const r = await api.ssoTry()
          if (r?.user) {
            localStorage.setItem('join_session_token', r.token)
            setUser(r.user)
            return 'ok' as const
          }
          return 'unavailable' as const
        } catch (e) {
          const err = e as { status?: number; message?: string } | null
          const status = err?.status
          if (status === 401 && err?.message === 'invalid_sso' && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 700))
            continue
          }
          // 失败结果不缓存：下次调用（例如登录页在首屏探测之后）允许重新探测。
          ssoProbePromise = null
          return (status === 401 ? 'expired' : 'unavailable') as SsoProbeResult
        }
      }
    })()
  }
  return ssoProbePromise
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
