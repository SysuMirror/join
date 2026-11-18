import { reactive } from 'vue'
import { api, type DirectoryUser } from '../api'

const CACHE_TTL_MS = 10 * 60_000
const STORAGE_KEY = 'join_directory_cache_v1'

type DirectoryState = {
  users: DirectoryUser[]
  loadedAt: number
  stale: boolean
  warning: string
  loading: boolean
}

const state = reactive<DirectoryState>({
  users: [],
  loadedAt: 0,
  stale: false,
  warning: '',
  loading: false,
})

let inflight: Promise<DirectoryState> | null = null

function restore() {
  if (state.users.length) return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { at: number; users: DirectoryUser[] }
    if (!parsed?.at || !Array.isArray(parsed.users)) return
    if (Date.now() - parsed.at > CACHE_TTL_MS) return
    state.users = parsed.users
    state.loadedAt = parsed.at
  } catch {
    /* 忽略损坏的本地缓存 */
  }
}

function persist() {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ at: state.loadedAt, users: state.users }),
    )
  } catch {
    /* 超出存储上限时只保留内存缓存 */
  }
}

/** 拉取一次后台用户目录（SSO 缓存 + 本地用户），后续搜索全部在本地完成。 */
async function ensure(force = false): Promise<DirectoryState> {
  restore()
  const fresh = state.users.length > 0 && Date.now() - state.loadedAt < CACHE_TTL_MS
  if (!force && fresh) return state
  if (inflight) return inflight
  state.loading = true
  inflight = (async () => {
    try {
      const page = await api.adminDirectoryUsers({
        limit: 5000,
        includeUnregistered: 1,
        refresh: force ? 1 : '',
      })
      state.users = page.users || []
      state.loadedAt = Date.now()
      state.stale = Boolean(page.stale)
      state.warning = page.warning || ''
      persist()
    } catch (e) {
      state.warning = e instanceof Error ? e.message : '用户目录加载失败'
    } finally {
      state.loading = false
      inflight = null
    }
    return state
  })()
  return inflight
}

function haystack(u: DirectoryUser): string {
  return [u.name, u.email, u.developer_no, u.student_id, u.sso_sub]
    .join(' ')
    .toLowerCase()
}

export function searchDirectory(
  q: string,
  opts: { registeredOnly?: boolean; includeUnregistered?: boolean; limit?: number } = {},
): DirectoryUser[] {
  const tokens = q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const includeUnregistered = opts.includeUnregistered !== false
  const limit = Math.min(5000, Math.max(1, opts.limit || 5000))
  return state.users
    .filter((u) => (opts.registeredOnly ? u.registered : true))
    .filter((u) => (includeUnregistered ? true : u.registered))
    .filter((u) => {
      if (!tokens.length) return true
      const hay = haystack(u)
      return tokens.every((t) => hay.includes(t))
    })
    .sort(
      (a, b) =>
        Number(b.registered) - Number(a.registered) ||
        a.name.localeCompare(b.name, 'zh-CN'),
    )
    .slice(0, limit)
}

export function useDirectoryStore() {
  return { state, ensure, refresh: () => ensure(true), search: searchDirectory }
}