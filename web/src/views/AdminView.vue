<template>
  <div class="page">
    <div class="wrap">
      <header class="head">
        <div>
          <h1 class="page-title">招聘管理</h1>
          <p class="page-sub">管理职位、调配站点文案、审核投递，初审通过后自动推送到开发者平台 OA 审批。</p>
        </div>
        <div class="auth" v-if="me">
          <RouterLink class="btn btn-ghost btn-sm" to="/">← 返回主页</RouterLink>
          <div class="user-chip">
            <span class="user-avatar">{{ (me.name || me.email)[0]?.toUpperCase() }}</span>
            <span class="user-meta">
              <span class="user-name">{{ me.name || me.email.split('@')[0] }}</span>
              <span class="user-email">{{ me.email }}</span>
            </span>
          </div>
          <button class="btn btn-ghost btn-sm" @click="logout">退出</button>
        </div>
      </header>

      <div v-if="entered">
        <div class="tabs">
          <button v-for="t in tabs" :key="t.id" class="tab" :class="{ active: tab === t.id }" @click="tab = t.id">
            {{ t.label }}
            <span v-if="t.id === 'apps' && stats.pendingReview" class="tab-badge">{{ stats.pendingReview }}</span>
          </button>
        </div>

        <!-- ===== 站点文案配置 ===== -->
        <section v-show="tab === 'site'" class="card panel">
          <div class="row-between">
            <h3>站点文案配置</h3>
            <button class="btn btn-primary btn-sm" @click="saveSite" :disabled="siteSaving">
              {{ siteSaving ? '保存中…' : '保存配置' }}
            </button>
          </div>
          <p class="hint">调整首页 Hero、公告、品牌与联系方式，保存后前台即时生效。</p>
          <div class="fields">
            <div class="field">
              <label>品牌名</label>
              <input v-model="siteForm.brand" maxlength="60" />
            </div>
            <div class="field">
              <label>联系邮箱</label>
              <input v-model="siteForm.contactEmail" maxlength="120" />
            </div>
            <div class="field full">
              <label>管理员邮箱（逗号分隔，登记后可登录后台）</label>
              <input v-model="siteForm.adminEmails" placeholder="如：admin@ssemarket.cn,xxx@qq.com" />
              <span class="hint">保存后即时生效；只有在此登记的邮箱才能用验证码登录管理后台。</span>
            </div>
            <div class="field full">
              <label>首页主标题（Hero）</label>
              <input v-model="siteForm.heroTitle" maxlength="120" />
            </div>
            <div class="field full">
              <label>首页副标题（换行用 \n）</label>
              <textarea v-model="siteForm.heroSubtitle" rows="3" />
            </div>
            <div class="field full">
              <label>顶部公告（留空则不显示）</label>
              <input v-model="siteForm.announcement" maxlength="120" />
            </div>
            <div class="field full">
              <label>页脚标语</label>
              <input v-model="siteForm.tagline" maxlength="120" />
            </div>
            <div class="field full">
              <label>背景装饰词（用 · 分隔）</label>
              <input v-model="siteForm.bgWords" maxlength="300" />
            </div>
          </div>
          <p v-if="siteMsg" class="site-msg" :class="siteMsgType">{{ siteMsg }}</p>
        </section>

        <!-- ===== 职位管理 ===== -->
        <section v-show="tab === 'jobs'" class="card panel">
          <div class="row-between">
            <h3>职位</h3>
            <button class="btn btn-ghost btn-sm" @click="openJobForm()">+ 新建职位</button>
          </div>
          <div class="stats-row" v-if="stats">
            <div class="stat"><b>{{ stats.jobs }}</b><span>在招职位</span></div>
            <div class="stat"><b>{{ stats.pendingReview }}</b><span>待初审</span></div>
            <div class="stat"><b>{{ stats.passed }}</b><span>已通过</span></div>
            <div class="stat"><b>{{ stats.oaApproved }}</b><span>OA 批准</span></div>
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

        <!-- ===== 投递审核 ===== -->
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
        <form class="modal wide" @submit.prevent="saveJob">
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
        <div class="modal">
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type Application, type Job, type AuthUser, type SiteConfig } from '../api'

const router = useRouter()
const token = ref(localStorage.getItem('join_session_token') || '')
const me = ref<AuthUser | null>(null)
const entered = ref(false)
const tab = ref('site')
const tabs = [
  { id: 'site', label: '站点配置' },
  { id: 'jobs', label: '职位管理' },
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

// 站点配置
const siteForm = ref<SiteConfig>({
  brand: '', heroTitle: '', heroSubtitle: '', announcement: '', tagline: '', contactEmail: '', bgWords: '', adminEmails: '', updatedAt: '',
})
const siteSaving = ref(false)
const siteMsg = ref('')
const siteMsgType = ref<'success' | 'error'>('success')

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
    const [m, j, a, s, site] = await Promise.all([
      api.me(t),
      api.adminJobs(t),
      api.adminApplications(t, appFilter.value),
      api.adminStats(t),
      api.adminSite(t),
    ])
    if (!m?.is_admin) {
      router.replace('/login')
      return
    }
    me.value = m
    jobs.value = j || []
    apps.value = a || []
    stats.value = s || {}
    if (site) siteForm.value = { ...siteForm.value, ...site }
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

async function saveSite() {
  siteSaving.value = true
  siteMsg.value = ''
  try {
    const updated = await api.adminUpdateSite(tokenOf(), {
      brand: siteForm.value.brand,
      heroTitle: siteForm.value.heroTitle,
      heroSubtitle: siteForm.value.heroSubtitle,
      announcement: siteForm.value.announcement,
      tagline: siteForm.value.tagline,
      contactEmail: siteForm.value.contactEmail,
      bgWords: siteForm.value.bgWords,
      adminEmails: siteForm.value.adminEmails,
    })
    siteForm.value = { ...siteForm.value, ...updated }
    siteMsg.value = '已保存并生效'
    siteMsgType.value = 'success'
  } catch (e) {
    siteMsg.value = e instanceof Error ? e.message : '保存失败'
    siteMsgType.value = 'error'
  } finally {
    siteSaving.value = false
  }
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
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.wrap {
  max-width: 1000px;
  margin: 0 auto;
  padding: 36px 24px 56px;
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
  gap: 10px;
  align-items: center;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px 5px 5px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}
.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 14px;
}
.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.user-name {
  font-size: 13px;
  font-weight: 600;
}
.user-email {
  font-size: 11px;
  color: var(--ink-soft);
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

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin: 12px 0 18px;
}
.stat {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.stat b {
  font-size: 26px;
  font-weight: 800;
  color: var(--ink);
  letter-spacing: -0.02em;
}
.stat span {
  font-size: 12px;
  color: var(--ink-soft);
}

.site-msg {
  margin: 12px 0 0;
  font-size: 13px;
}
.site-msg.success {
  color: #059669;
}
.site-msg.error {
  color: #dc2626;
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
