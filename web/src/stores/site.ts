import { reactive } from 'vue'
import { api, type SiteConfig } from '../api'

const state = reactive<{ site: SiteConfig | null; loaded: boolean }>({
  site: null,
  loaded: false,
})

let inflight: Promise<SiteConfig | null> | null = null

async function ensure(force = false): Promise<SiteConfig | null> {
  if (state.loaded && !force) return state.site
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const s = await api.site()
      state.site = s
      return s
    } catch {
      state.site = null
      return null
    } finally {
      state.loaded = true
      inflight = null
    }
  })()
  return inflight
}

export function useSiteStore() {
  return { state, ensure }
}
