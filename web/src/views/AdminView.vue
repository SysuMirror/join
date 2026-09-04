<template>
  <div class="page">
    <div class="wrap">
      <header class="head">
        <div>
          <h1 class="page-title">招聘管理</h1>
          <p class="page-sub">管理职位、审核投递，初审通过后自动推送到开发者平台 OA 审批。</p>
        </div>
        <div class="auth">
          <span class="muted small" v-if="me">{{ me.name }}（{{ me.email }}）</span>
          <button class="btn btn-ghost" @click="logout">退出登录</button>
        </div>
      </header>

      <div v-if="entered">
        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.id"
            class="tab"
            :class="{ active: tab === t.id }"
            @click="tab = t.id"
          >
            {{ t.label }}
            <span v-if="t.id === 'apps' && stats.pendingReview" class="tab-badge">{{ stats.pendingReview }}</span>
          </button>
        </div>

        <section v-show="tab === 'jobs'" class="card panel">
          <div class="row-between">
            <h3>职位</h3>
            <button class="btn btn-ghost btn-sm" @click="openJobForm()">+ 新建职位</button>
          </div>
          <table class="table" v-if="jobs.length">
            <thead>
              <tr><th>职位</th><th>部门</th><th class="hide-sm">类型</th><th>状态</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="j in jobs" :key="j.id">
                <td><strong>{{ j.title }}</strong><div class="muted small">{{ j.slug }}</div></td>
                <td>{{ j.department }}</td>
                <td class="hide-sm">{{ typeLabel(j.type) }}</td>
                <td><span class="badge" :class="j.enabled ? 'badge-green' : 'badge-red'">{{ j.enabled ? '开放' : '关闭' }}</span></td>
                <td class="actions">
                  <button class="btn btn-ghost btn-sm" @click="openJobForm(j)">编辑</button>
                  <button class="btn btn-danger btn-sm" @click="deleteJob(j)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无职位</div>
        </section>

        <section v-show="tab === 'apps'" class="card panel">
          <div class="toolbar">
            <select v-model="appFilter" @change="loadApps">
              <option value="">全部</option>
              <option value="pending">待初审</option>
              <option value="passed">已通过</option>
              <option value="rejected">已驳回</option>
            </select>
            <button class="btn btn-ghost btn-sm" @click="refreshOa" :disabled="refreshing">
              {{ refreshing ? '刷新中…' : '刷新 OA 状态' }}
            </button>
          </div>
          <table class="table" v-if="apps.length">
            <thead>
              <tr>
                <th>候选人</th><th>职位</th><th>联系方式</th>
                <th class="hide-sm">初审</th><th>平台 OA</th><th class="hide-sm">投递时间</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in apps" :key="a.id">
                <td>
                  <div><strong>{{ a.name || '匿名' }}</strong></div>
                  <div class="muted small single-line">{{ a.note || '' }}</div>
                </td>
                <td>{{ a.jobTitle }}</td>
                <td class="small mono">{{ a.contact }}</td>
                <td><span class="badge" :class="statusClass(a.status)">{{ statusLabel(a.status) }}</span></td>
                <td>
                  <span class="badge" :class="oaClass(a.oa_status)">{{ oaLabel(a.oa_status) }}</span>
                  <button v-if="a.oaTimeline?.length" class="btn btn-ghost btn-sm" @click="showTimeline(a)">流转</button>
                </td>
                <td class="hide-sm small mono">{{ fmt(a.createdAt) }}</td>
                <td class="actions">
                  <template v-if="a.status === 'pending'">
                    <button class="btn btn-primary btn-sm" @click="pass(a)">初审通过</button>
                    <button class="btn btn-danger btn-sm" @click="reject(a)">驳回</button>
                  </template>
                  <template v-else>
                    <button class="btn btn-ghost btn-sm" @click="pass(a)">刷新 OA</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无投递</div>
        </section>
      </div>

      <div v-else class="card panel empty">正在校验登录…</div>

      <!-- 职位编辑弹窗 -->
      <div v-if="jobFormOpen" class="modal-backdrop" @click.self="jobFormOpen = false">
        <form class="card modal wide" @submit.prevent="saveJob">
          <h3>{{ editingJob ? '编辑职位' : '新建职位' }}</h3>
          <div class="fields">
            <div class="field">
              <label>职位名称 *</label>
              <input v-model="jobForm.title" required maxlength="100" />
            </div>
            <div class="field">
              <label>部门</label>
              <input v-model="jobForm.department" maxlength="60" />
            </div>
            <div class="field">
              <label>地点</label>
              <input v-model="jobForm.location" maxlength="60" placeholder="如：广州 / 远程" />
            </div>
            <div class="field">
              <label>类型</label>
              <select v-model="jobForm.type">
                <option value="fulltime">全职</option>
                <option value="intern">实习</option>
                <option value="parttime">兼职</option>
              </select>
            </div>
            <div class="field">
              <label>招聘人数</label>
              <input v-model.number="jobForm.headcount" type="number" min="0" />
            </div>
            <div class="field">
              <label>是否开放</label>
              <select v-model="jobForm.enabled">
                <option :value="1">开放</option>
                <option :value="0">关闭</option>
              </select>
            </div>
            <div class="field full">
              <label>摘要</label>
              <textarea v-model="jobForm.summary" rows="2" maxlength="300" />
            </div>
            <div class="field full">
              <label>详细描述</label>
              <textarea v-model="jobForm.description" rows="6" />
            </div>
          </div>
          <p v-if="jobFormError" class="error">{{ jobFormError }}</p>
          <div class="modal-actions">
            <button class="btn btn-primary" type="submit">保存</button>
            <button class="btn btn-ghost" type="button" @click="jobFormOpen = false">取消</button>
          </div>
        </form>
      </div>

      <!-- OA 流转记录弹窗 -->
      <div v-if="timelineOf" class="modal-backdrop" @click.self="timelineOf = null">
        <div class="card modal">
          <h3>OA 流转记录 · {{ timelineOf.name || timelineOf.jobTitle }}</h3>
          <ol class="timeline">
            <li v-for="(e, i) in timelineOf.oaTimeline" :key="i" class="tl-item">
              <span class="dot" :class="`dot-${e.action}`" />
              <div>
                <div class="tl-head"><strong>{{ actionLabel(e.action) }}</strong><span class="muted small">{{ e.by || e.viaModule || '' }}</span></div>
                <div v-if="e.note" class="small">{{ e.note }}</div>
                <div class="muted small mono">{{ fmt(e.at) }}</div>
              </div>
            </li>
          </ol>
          <div class="modal-actions"><button class="btn btn-ghost" @click="timelineOf = null">关闭</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type Application, type Job, type AuthUser } from '../api'

const router = useRouter()
const token = ref(localStorage.getItem('join_session_token') || '')
const me = ref<AuthUser | null>(null)
const entered = ref(false)
const tab = ref('jobs')
const tabs = [
  { id: 'jobs', label: '职位' },
  { id: 'apps', label: '投递审核' },
]
const jobs = ref<Job[]>([])
const apps = ref<Application[]>([])
const stats = ref<any>({ pendingReview: 0 })
const appFilter = ref('')
const refreshing = ref(false)

const jobFormOpen = ref(false)
const editingJob = ref<Job | null>(null)
const jobForm = ref({ title: '', department: '', location: '', type: 'fulltime', headcount: 0, enabled: 1, summary: '', description: '' })
const jobFormError = ref('')

const timelineOf = ref<Application | null>(null)

const isJobTab = computed(() => tab.value === 'jobs')

function tokenOf() {
  const t = token.value.trim()
  localStorage.setItem('join_session_token', t)
  return t
}

async function loadAll() {
  const t = tokenOf()
  if (!t) {
    router.replace('/login')
    return
  }
  try {
    const [m, j, a, s] = await Promise.all([
      api.me(t),
      api.adminJobs(t),
      api.adminApplications(t, appFilter.value),
      api.adminStats(t),
    ])
    if (!m?.is_admin) {
      router.replace('/login')
      return
    }
    me.value = m
    jobs.value = j || []
    apps.value = a || []
    stats.value = s || {}
    entered.value = true
  } catch (e) {
    alert(e instanceof Error ? e.message : '鉴权失败，请重新登录')
    router.replace('/login')
  }
}

async function logout() {
  localStorage.removeItem('join_session_token')
  try { await api.logout() } catch { /* ignore */ }
  router.replace('/login')
}

async function loadJobs() {
  jobs.value = (await api.adminJobs(tokenOf())) || []
}
async function loadApps() {
  apps.value = (await api.adminApplications(tokenOf(), appFilter.value)) || []
}

function openJobForm(j?: Job) {
  editingJob.value = j || null
  jobForm.value = j
    ? { title: j.title, department: j.department, location: j.location, type: j.type, headcount: j.headcount, enabled: j.enabled, summary: j.summary, description: j.description }
    : { title: '', department: '', location: '', type: 'fulltime', headcount: 0, enabled: 1, summary: '', description: '' }
  jobFormError.value = ''
  jobFormOpen.value = true
}

async function saveJob() {
  jobFormError.value = ''
  const payload = { ...jobForm.value }
  try {
    if (editingJob.value) {
      await api.adminUpdateJob(tokenOf(), editingJob.value.id, payload)
    } else {
      await api.adminCreateJob(tokenOf(), payload)
    }
    jobFormOpen.value = false
    await loadJobs()
  } catch (e) {
    jobFormError.value = e instanceof Error ? e.message : '保存失败'
  }
}

async function deleteJob(j: Job) {
  if (!confirm(`确认删除职位「${j.title}」？相关投递记录保留。`)) return
  await api.adminDeleteJob(tokenOf(), j.id)
  await loadJobs()
}

async function pass(a: Application) {
  const msg = a.status === 'pending' ? '确认初审通过并推送到开发者平台 OA 审批？' : '刷新该申请的 OA 状态？'
  if (!confirm(msg)) return
  try {
    await api.adminPassApplication(tokenOf(), a.id)
    await loadApps()
  } catch (e) {
    alert(e instanceof Error ? e.message : '操作失败')
  }
}

async function reject(a: Application) {
  const note = window.prompt('驳回原因（选填）', '')
  if (note === null) return
  await api.adminRejectApplication(tokenOf(), a.id, note)
  await loadApps()
}

async function refreshOa() {
  refreshing.value = true
  try {
    const r = await api.adminRefreshOa(tokenOf())
    alert(`已刷新 ${r.refreshed ?? r.total ?? 0} 条`)
    await loadApps()
  } catch (e) {
    alert(e instanceof Error ? e.message : '刷新失败')
  } finally {
    refreshing.value = false
  }
}

function showTimeline(a: Application) {
  timelineOf.value = a
}

function statusLabel(s: string) {
  return ({ pending: '待初审', passed: '已通过', rejected: '已驳回' } as Record<string, string>)[s] || s
}
function statusClass(s: string) {
  return ({ pending: 'badge-amber', passed: 'badge-green', rejected: 'badge-red' } as Record<string, string>)[s] || 'badge'
}
function oaLabel(s: string) {
  return ({ pending: '待平台审批', approved: '已批准', rejected: '已驳回' } as Record<string, string>)[s] || (s ? s : '未推送')
}
function oaClass(s: string) {
  return ({ pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-red' } as Record<string, string>)[s] || 'badge'
}
function typeLabel(t: string) {
  return ({ fulltime: '全职', intern: '实习', parttime: '兼职' } as Record<string, string>)[t] || t
}
function actionLabel(a: string) {
  return ({ submit: '提交', approve: '通过', reject: '驳回', revoke: '撤回', comment: '备注' } as Record<string, string>)[a] || a
}
function fmt(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(loadAll)
onUnmounted(() => {
  tabs
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 48px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.auth {
  display: flex;
  gap: 8px;
  align-items: center;
}
.actions {
  gap: 8px;
}
.single-line {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}
.tl-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-top: 5px;
  background: #94a3b8;
  flex: none;
}
.dot-approve,
.dot-submit {
  background: #16a34a;
}
.dot-reject,
.dot-revoke {
  background: #dc2626;
}
.tl-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
</style>
