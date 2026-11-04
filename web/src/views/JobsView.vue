<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main">
      <section class="jobs-hero">
        <div class="eyebrow">
          <span class="eyebrow-line" />
          <span>Join us · {{ site?.brand || '软工集市' }}</span>
        </div>
        <h1 class="jobs-title">部门岗位</h1>
        <p class="jobs-sub">
          找到你真正想做的事。共
          <strong>{{ loading ? '…' : jobs.length }}</strong>
          个岗位开放双选。
        </p>
        <div class="jobs-search">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input
            v-model="filters.q"
            class="search-input"
            type="search"
            placeholder="搜索岗位、部门或技能，如「前端」「大模型」"
            @input="onSearchInput"
          />
          <select v-model="filters.sort" class="sort-select" @change="applyFilters">
            <option value="">默认排序</option>
            <option value="latest">最新发布</option>
          </select>
        </div>
      </section>

      <div class="jobs-layout">
        <aside class="filters">
          <div class="filter-group">
            <div class="filter-title">部门</div>
            <button
              class="filter-option"
              :class="{ active: !filters.department }"
              @click="setDepartment('')"
            >
              <span>全部部门</span>
              <span class="count">{{ totalOpen }}</span>
            </button>
            <button
              v-for="d in meta?.departments || []"
              :key="d.id"
              class="filter-option"
              :class="{ active: filters.department === d.slug }"
              @click="setDepartment(filters.department === d.slug ? '' : d.slug)"
            >
              <span>{{ d.name }}</span>
              <span class="count">{{ d.openJobs }}</span>
            </button>
          </div>

          <div v-if="meta?.directions?.length" class="filter-group">
            <div class="filter-title">岗位方向</div>
            <div class="filter-chips">
              <button
                v-for="dir in meta.directions"
                :key="dir"
                class="chip"
                :class="{ active: filters.direction === dir }"
                @click="toggle('direction', dir)"
              >
                {{ dir }}
              </button>
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-title">参与类型</div>
            <div class="filter-chips">
              <button
                v-for="t in typeOptions"
                :key="t.value"
                class="chip"
                :class="{ active: filters.type === t.value }"
                @click="toggle('type', t.value)"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <div v-if="meta?.locations?.length" class="filter-group">
            <div class="filter-title">活动地点</div>
            <div class="filter-chips">
              <button
                v-for="loc in meta.locations"
                :key="loc"
                class="chip"
                :class="{ active: filters.location === loc }"
                @click="toggle('location', loc)"
              >
                {{ loc }}
              </button>
            </div>
          </div>

          <button v-if="hasFilters" class="btn btn-ghost btn-sm" @click="clearFilters">
            清除全部筛选
          </button>
        </aside>

        <section class="jobs-results">
          <div class="results-bar">
            <span class="results-count">
              {{ loading ? '正在加载…' : `共 ${jobs.length} 个岗位` }}
            </span>
            <span v-if="activeHint" class="results-hint">{{ activeHint }}</span>
          </div>

          <div v-if="loading" class="skeleton-list">
            <div v-for="i in 4" :key="i" class="skeleton-row" />
          </div>

          <p v-else-if="error" class="notice notice-error">{{ error }}</p>

          <div v-else-if="!jobs.length" class="empty-state">
            <div class="empty-icon">⌕</div>
            <h3>没有找到匹配的岗位</h3>
            <p>试试调整筛选条件，或看看全部部门岗位。</p>
            <button class="btn btn-primary" @click="clearFilters">查看全部岗位</button>
          </div>

          <div v-else class="job-list">
            <JobCard
              v-for="(job, i) in jobs"
              :key="job.id"
              v-reveal
              :job="job"
              :style="{ transitionDelay: `${Math.min(i * 45, 280)}ms` }"
            />
          </div>
        </section>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Job, type JobMeta } from '../api'
import JobCard from '../components/JobCard.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useSiteStore } from '../stores/site'

const route = useRoute()
const router = useRouter()
const siteState = useSiteStore().state
const site = computed(() => siteState.site)

const meta = ref<JobMeta | null>(null)
const jobs = ref<Job[]>([])
const loading = ref(true)
const error = ref('')

const filters = reactive({
  q: String(route.query.q || ''),
  department: String(route.query.department || ''),
  direction: String(route.query.direction || ''),
  type: String(route.query.type || ''),
  location: String(route.query.location || ''),
  sort: String(route.query.sort || ''),
})

const typeOptions = [
  { value: 'fulltime', label: '社团成员' },
  { value: 'intern', label: '项目成员' },
  { value: 'parttime', label: '志愿者' },
]

const totalOpen = computed(() => {
  if (meta.value?.departments) {
    return meta.value.departments.reduce((n, d) => n + d.openJobs, 0)
  }
  return site.value?.stats?.openJobs ?? 0
})

const hasFilters = computed(() =>
  Boolean(
    filters.q ||
      filters.department ||
      filters.direction ||
      filters.type ||
      filters.location ||
      filters.sort,
  ),
)

const activeHint = computed(() => {
  const parts: string[] = []
  if (filters.department) {
    const d = meta.value?.departments.find((x) => x.slug === filters.department)
    parts.push(d?.name || filters.department)
  }
  if (filters.direction) parts.push(filters.direction)
  if (filters.type) parts.push(typeOptions.find((t) => t.value === filters.type)?.label || filters.type)
  if (filters.location) parts.push(filters.location)
  if (filters.q) parts.push(`“${filters.q}”`)
  return parts.join(' · ')
})

let searchTimer: number | undefined

function queryOf(): Record<string, string> {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v) q[k] = v
  }
  return q
}

async function loadJobs() {
  loading.value = true
  error.value = ''
  try {
    jobs.value = (await api.jobs({ ...filters })) || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    jobs.value = []
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  router.replace({ path: '/jobs', query: queryOf() })
  loadJobs()
}

function onSearchInput() {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(applyFilters, 320)
}

function setDepartment(slug: string) {
  filters.department = slug === filters.department ? '' : slug
  applyFilters()
}

function toggle(key: 'direction' | 'type' | 'location', value: string) {
  filters[key] = filters[key] === value ? '' : value
  applyFilters()
}

function clearFilters() {
  filters.q = ''
  filters.department = ''
  filters.direction = ''
  filters.type = ''
  filters.location = ''
  filters.sort = ''
  applyFilters()
}

onMounted(async () => {
  useSiteStore().ensure()
  try {
    meta.value = await api.jobMeta()
  } catch {
    /* 筛选项加载失败不阻塞列表 */
  }
  await loadJobs()
})

// 浏览器前进/后退时同步 URL 中的筛选条件
watch(
  () => route.query,
  (q) => {
    const next = {
      q: String(q.q || ''),
      department: String(q.department || ''),
      direction: String(q.direction || ''),
      type: String(q.type || ''),
      location: String(q.location || ''),
      sort: String(q.sort || ''),
    }
    const changed = (Object.keys(next) as Array<keyof typeof next>).some(
      (k) => filters[k] !== next[k],
    )
    if (!changed) return
    Object.assign(filters, next)
    loadJobs()
  },
)

onUnmounted(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.jobs-hero {
  margin-bottom: 34px;
}
.jobs-title {
  margin: 18px 0 10px;
  font-size: clamp(34px, 5vw, 48px);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.1;
}
.jobs-sub {
  margin: 0 0 24px;
  color: var(--ink-soft);
  font-size: 15px;
}
.jobs-sub strong {
  color: var(--ink);
  font-weight: 700;
}
.jobs-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px 6px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  max-width: 720px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.jobs-search:focus-within {
  border-color: #c9cdd4;
  box-shadow: 0 0 0 4px rgba(23, 23, 23, 0.04);
}
.search-icon {
  color: var(--ink-faint);
  font-size: 18px;
  line-height: 1;
}
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 8px 0;
  font-size: 14px;
}
.sort-select {
  flex: none;
  border: none;
  outline: none;
  background: var(--input-bg);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--ink-soft);
}
.results-bar {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 4px;
}
.results-count {
  font-size: 13px;
  font-weight: 600;
}
.results-hint {
  font-size: 12px;
  color: var(--ink-faint);
}
.skeleton-list {
  border-top: 1px solid var(--line);
}
.empty-state {
  padding: 72px 24px;
  text-align: center;
  border-bottom: 1px solid var(--line);
}
.empty-icon {
  font-size: 30px;
  color: var(--ink-faint);
  margin-bottom: 10px;
}
.empty-state h3 {
  margin: 0 0 8px;
  font-size: 18px;
}
.empty-state p {
  margin: 0 0 20px;
  color: var(--ink-soft);
  font-size: 14px;
}

@media (max-width: 640px) {
  .jobs-search {
    flex-wrap: wrap;
    padding: 10px;
  }
  .search-input {
    flex-basis: calc(100% - 32px);
  }
  .sort-select {
    width: 100%;
  }
}
</style>
