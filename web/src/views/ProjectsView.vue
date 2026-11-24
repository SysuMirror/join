<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main projects-main">
      <section class="projects-hero">
        <div class="eyebrow">
          <span class="eyebrow-line" />
          <span>Project board</span>
        </div>
        <h1 class="projects-title">项目广场</h1>
        <p class="projects-sub">
          挑一个感兴趣的项目，用简历申请加入。项目 leader 会在开发者平台审批申请。
        </p>
        <form class="projects-search" @submit.prevent="search">
          <input
            v-model="q"
            class="search-input"
            type="search"
            placeholder="搜索项目名称，如「大模型」「官网」"
          />
          <button class="btn btn-primary" type="submit">搜索</button>
        </form>
      </section>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <p v-if="notice" class="notice notice-success">{{ notice }}</p>

      <section v-if="authState.user && myApps.length" class="my-apps card">
        <div class="row-between">
          <h3>我提交的项目申请</h3>
          <span class="muted small">共 {{ myApps.length }} 条</span>
        </div>
        <ul class="my-app-list">
          <li v-for="item in myApps" :key="item.id" class="my-app-row">
            <div class="my-app-main">
              <b>{{ item.project_title }}</b>
              <span class="muted small">
                {{ item.resume_title || '简历' }} · {{ formatDate(item.updated_at || item.created_at) }}
              </span>
            </div>
            <span class="status-badge" :class="`status-${item.status}`">
              {{ statusLabel(item.status) }}
            </span>
          </li>
        </ul>
      </section>

      <section class="projects-results">
        <div class="results-bar">
          <span class="results-count">
            {{ loading ? '正在加载…' : `共 ${total} 个项目` }}
          </span>
        </div>

        <div v-if="loading" class="skeleton-list">
          <div v-for="i in 4" :key="i" class="skeleton-row" />
        </div>

        <div v-else-if="!projects.length" class="empty-state">
          <div class="empty-icon">⌕</div>
          <h3>暂时没有可申请的项目</h3>
          <p>项目由开发者在开发者平台创建；换个关键词，或稍后再来看看。</p>
          <button v-if="q" class="btn btn-primary" @click="clearSearch">查看全部项目</button>
        </div>

        <div v-else class="project-grid">
          <article v-for="p in projects" :key="p.id" class="project-card">
            <div class="project-card-head">
              <span class="project-no">#{{ p.id }}</span>
              <h3>{{ p.title }}</h3>
            </div>
            <button class="btn btn-primary btn-sm" @click="openApply(p)">申请加入</button>
          </article>
        </div>

        <div v-if="!loading && pages > 1" class="pager">
          <button class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">
            上一页
          </button>
          <span class="muted small">{{ page }} / {{ pages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="page >= pages" @click="goPage(page + 1)">
            下一页
          </button>
        </div>
      </section>
    </main>

    <SiteFooter />

    <div v-if="applyOpen && applyTarget" class="modal-mask" @click.self="closeApply">
      <div class="modal-card">
        <h3>申请加入「{{ applyTarget.title }}」</h3>
        <p class="modal-hint">
          申请会以你的统一身份提交到开发者平台，由项目 leader 审批。通过后你会成为项目成员。
        </p>

        <label class="field">
          <span>简历</span>
          <select v-if="resumesWithPdf.length" v-model.number="form.resumeId">
            <option v-for="r in resumesWithPdf" :key="r.id" :value="r.id">
              {{ r.title }}{{ r.is_default ? '（默认）' : '' }}
            </option>
          </select>
          <span v-else class="hint">
            还没有 PDF 简历，<RouterLink to="/me">去个人主页上传</RouterLink>一份再来申请。
          </span>
        </label>

        <label class="field">
          <span>留言（可选）</span>
          <textarea
            v-model="form.note"
            maxlength="500"
            rows="4"
            placeholder="简单介绍一下你能做什么、每周能投入多少时间"
          />
        </label>

        <div class="modal-actions">
          <button class="btn btn-ghost" :disabled="submitting" @click="closeApply">取消</button>
          <button class="btn btn-primary" :disabled="!canSubmit" @click="submit">
            {{ submitting ? '正在提交…' : '提交申请' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  api,
  type DeveloperApplicationRecord,
  type DeveloperProject,
  type Resume,
} from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuth } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const authState = auth.state

const pageSize = 20

const projects = ref<DeveloperProject[]>([])
const total = ref(0)
const page = ref(1)
const q = ref(String(route.query.q || ''))
const loading = ref(true)
const error = ref('')
const notice = ref('')

const myApps = ref<DeveloperApplicationRecord[]>([])
const resumes = ref<Resume[]>([])
const resumesWithPdf = computed(() => resumes.value.filter((r) => r.has_file))

const applyOpen = ref(false)
const applyTarget = ref<DeveloperProject | null>(null)
const submitting = ref(false)
const form = reactive({ resumeId: 0, note: '' })

const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const canSubmit = computed(
  () => Boolean(applyTarget.value) && form.resumeId > 0 && !submitting.value,
)

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : '请求失败'
}

async function loadProjects() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.developerProjects({ q: q.value, page: page.value, pageSize })
    projects.value = res.items
    total.value = res.total
  } catch (e) {
    error.value = messageOf(e)
  } finally {
    loading.value = false
  }
}

async function loadMine() {
  await auth.ensure()
  if (!authState.user) return
  try {
    myApps.value = await api.developerApplications()
  } catch {
    /* 留档读取失败不影响项目列表 */
  }
  try {
    resumes.value = await api.myResumes()
  } catch {
    /* 简历列表只用于申请弹窗 */
  }
}

function search() {
  page.value = 1
  loadProjects()
}

function clearSearch() {
  q.value = ''
  search()
}

function goPage(next: number) {
  page.value = Math.min(pages.value, Math.max(1, next))
  loadProjects()
}

function openApply(project: DeveloperProject) {
  if (!authState.user) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  error.value = ''
  notice.value = ''
  applyTarget.value = project
  const preferred = resumesWithPdf.value.find((r) => r.is_default) || resumesWithPdf.value[0]
  form.resumeId = preferred?.id || 0
  form.note = ''
  applyOpen.value = true
}

function closeApply() {
  if (submitting.value) return
  applyOpen.value = false
}

async function submit() {
  if (!canSubmit.value || !applyTarget.value) return
  submitting.value = true
  error.value = ''
  notice.value = ''
  try {
    const record = await api.applyDeveloperProject({
      project_id: applyTarget.value.id,
      project_title: applyTarget.value.title,
      resume_id: form.resumeId,
      note: form.note.trim() || undefined,
    })
    notice.value = statusMessage(record)
    applyOpen.value = false
    await loadMine()
  } catch (e) {
    error.value = messageOf(e)
  } finally {
    submitting.value = false
  }
}

function statusMessage(record: DeveloperApplicationRecord): string {
  if (record.status === 'accepted') return '你已经是该项目成员'
  if (record.reopened) return '已重新提交申请，等待项目 leader 审批'
  if (record.duplicate) return '申请已存在，等待项目 leader 审批'
  return '申请已提交，等待项目 leader 审批'
}

function statusLabel(status: string): string {
  if (status === 'accepted') return '已通过'
  if (status === 'rejected') return '未通过'
  if (status === 'waiting') return '待审批'
  return status || '已提交'
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadProjects()
  loadMine()
})
</script>

<style scoped>
.projects-main {
  max-width: 1040px;
}

.projects-hero {
  padding: 24px 0 8px;
}

.projects-title {
  margin: 8px 0 6px;
  font-size: clamp(28px, 4vw, 40px);
  letter-spacing: var(--letter-tight);
}

.projects-sub {
  color: var(--ink-soft);
  max-width: 620px;
  line-height: 1.7;
}

.projects-search {
  display: flex;
  gap: 10px;
  margin: 18px 0 8px;
  max-width: 560px;
}

.projects-search .search-input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  color: var(--ink);
  font: inherit;
}

.my-apps {
  margin: 18px 0;
  padding: 18px 20px;
}

.my-apps h3 {
  margin: 0;
  font-size: 16px;
}

.my-app-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.my-app-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
  background: var(--bg);
}

.my-app-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.status-badge {
  flex: none;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  background: var(--input-bg);
  color: var(--ink-soft);
}

.status-accepted {
  background: var(--brand-soft);
  color: var(--brand);
}

.status-rejected {
  background: #f4f4f4;
  color: var(--ink-soft);
}

.projects-results {
  margin-top: 18px;
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

.results-bar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
  color: var(--ink-soft);
  font-size: 14px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.project-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  transition: border-color 0.18s var(--ease), transform 0.18s var(--ease);
}

.project-card:hover {
  border-color: var(--ink-faint);
  transform: translateY(-2px);
}

.project-card-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project-no {
  color: var(--ink-faint);
  font: 12px var(--mono);
}

.project-card h3 {
  margin: 0;
  font-size: 17px;
  line-height: 1.45;
  word-break: break-word;
}

.project-card .btn {
  align-self: flex-start;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 22px 0 8px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(20, 20, 20, 0.35);
  backdrop-filter: blur(3px);
}

.modal-card {
  width: min(480px, 100%);
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18);
}

.modal-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.modal-hint {
  margin: 0 0 16px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.65;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--ink-soft);
}

.field select,
.field textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  resize: vertical;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}
</style>