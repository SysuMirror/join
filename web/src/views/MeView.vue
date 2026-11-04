<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main">
      <div class="me-head">
        <div class="me-user">
          <img v-if="user?.avatar" class="me-avatar-img" :src="user.avatar" alt="" />
          <span v-else class="me-avatar">{{ initial }}</span>
          <div class="me-user-meta">
            <h1 class="me-name">{{ user?.name || '我的账号' }}</h1>
            <p class="me-email">{{ user?.email || '' }}</p>
            <div class="me-tags">
              <span class="badge badge-blue">{{ user?.provider === 'sso' ? '统一身份' : '邮箱登录' }}</span>
              <span v-if="user?.internal" class="badge badge-green">院内用户</span>
              <span v-if="isAdmin" class="badge badge-amber">管理员</span>
              <span v-else-if="user?.is_staff" class="badge badge-amber">部门管理员</span>
            </div>
          </div>
        </div>
        <div class="me-head-actions">
          <RouterLink v-if="isStaff" class="btn btn-ghost btn-sm" to="/admin">管理后台</RouterLink>
          <RouterLink class="btn btn-ghost btn-sm" to="/jobs">浏览岗位</RouterLink>
        </div>
      </div>

      <div v-if="overview" class="me-summary">
        <span>累计报名 <b>{{ overview.applications }}</b></span>
        <span>待处理 <b>{{ overview.pending }}</b></span>
        <span>初审通过 <b>{{ overview.passed }}</b></span>
        <span>简历 <b>{{ overview.resumes }}</b></span>
      </div>

      <div class="me-layout">
        <aside class="me-nav">
          <button
            v-for="t in tabs"
            :key="t.id"
            class="me-nav-item"
            :class="{ active: tab === t.id }"
            @click="setTab(t.id)"
          >
            <span>{{ t.label }}</span>
            <span v-if="t.id === 'applications' && overview" class="me-nav-count">{{ overview.applications }}</span>
            <span v-else-if="t.id === 'resumes' && overview" class="me-nav-count">{{ overview.resumes }}</span>
          </button>
        </aside>

        <section class="me-content">
          <div v-if="loading" class="me-loading">加载中…</div>
          <p v-else-if="error" class="notice notice-error">{{ error }}</p>

          <template v-else>
            <!-- 个人主页 -->
            <div v-show="tab === 'identity'">
              <div class="row-between content-head">
                <div>
                  <h2 class="content-title">开发者身份</h2>
                  <p class="content-sub">从集市开发者到项目开发者，再到圆桌开发者（技术部）。</p>
                </div>
                <RouterLink class="btn btn-ghost btn-sm" to="/teams">查看公示 →</RouterLink>
              </div>

              <div v-if="developer" class="identity-card">
                <div class="identity-top">
                  <div class="identity-meta">
                    <span class="mono">{{ developer.developer_no }}</span>
                    <span v-if="developer.department"> · {{ developer.department.name }}</span>
                    <span v-else> · 尚未进组</span>
                  </div>
                  <div class="identity-badges">
                    <span class="badge" :class="levelClass(developer.developer_level)">{{ developer.level_label }}</span>
                    <span v-if="developer.department" class="badge badge-blue">{{ developer.department.name }}</span>
                    <span v-if="developer.is_resource_reviewer" class="badge badge-amber">资源方代表</span>
                    <span v-if="developer.is_department_admin" class="badge badge-amber">部门管理员</span>
                  </div>
                </div>

                <div class="level-track">
                  <div v-for="(l, i) in ['集市开发者', '项目开发者', '圆桌开发者']" :key="l" class="track-step" :class="{ done: progressStep > i, current: progressStep === i + 1 }">
                    <span class="track-dot" />
                    <b>{{ l }}</b>
                    <span class="track-desc">{{ ['注册即获得', '部门双选确认', '多级答辩通过'][i] }}</span>
                  </div>
                </div>

                <div class="identity-stats">
                  <div>
                    <b>{{ developer.department?.name || '尚未进组' }}</b>
                    <span>所属部门</span>
                  </div>
                  <div>
                    <b>{{ developer.seat ? `${developer.seat.occupied}/${developer.seat.total}` : '—' }}</b>
                    <span>部门圆桌席位</span>
                  </div>
                  <div>
                    <b>{{ developer.seat?.available ?? '—' }}</b>
                    <span>可用席位</span>
                  </div>
                  <div>
                    <b>{{ developer.defenses.length }}</b>
                    <span>答辩次数</span>
                  </div>
                </div>

                <div class="identity-actions">
                  <RouterLink v-if="canInitiateDefense" class="btn btn-primary" to="/me/defense/new">
                    发起技术部答辩
                  </RouterLink>
                  <RouterLink v-else-if="activeDefense" class="btn btn-primary" :to="`/defenses/${activeDefense.id}`">
                    查看进行中的答辩
                  </RouterLink>
                  <RouterLink v-else-if="developer.developer_level === 'market'" class="btn btn-primary" to="/jobs">
                    投递意向部门
                  </RouterLink>
                  <RouterLink v-else-if="developer.developer_level === 'roundtable'" class="btn btn-ghost" to="/teams">
                    查看圆桌
                  </RouterLink>
                </div>

                <p class="identity-hint">
                  <template v-if="developer.developer_level === 'market'">
                    你已拥有「集市开发者」身份。在部门岗位投递意向部门，通过 15 分钟轻沟通并双向确认后成为项目开发者；之后本页会出现「发起技术部答辩」按钮。
                  </template>
                  <template v-else-if="developer.developer_level === 'project'">
                    你已是项目开发者。可发起技术部答辩：准备个人陈述与「如何帮助学院更好分配资源」的具体主张。
                  </template>
                  <template v-else>
                    你是圆桌开发者（技术部成员）。年度复审未达产出要求或卸任产品负责人时，会自动退出圆桌并释放席位。
                  </template>
                </p>
              </div>

              <div v-if="pendingReviews.length" class="review-tasks">
                <div class="row-between content-head">
                  <div>
                    <h2 class="content-title">待我评审</h2>
                    <p class="content-sub">你被指派为答辩评审人，请在答辩详情中提交评审。</p>
                  </div>
                </div>
                <article v-for="r in pendingReviews" :key="r.review_id" class="review-task">
                  <div>
                    <span class="badge badge-blue">{{ r.level === 1 ? '一级 · 事实陈述' : r.level === 2 ? '二级 · 交叉评审' : '三级 · 资源方' }}</span>
                    <RouterLink class="review-task-title" :to="`/defenses/${r.defense_id}`">{{ r.title }}</RouterLink>
                    <p class="muted small">{{ r.applicant_name }} · {{ r.department_name }}</p>
                  </div>
                  <RouterLink class="btn btn-primary btn-sm" :to="`/defenses/${r.defense_id}`">去评审</RouterLink>
                </article>
              </div>

              <div v-if="developer?.defenses.length" class="defense-history">
                <div class="row-between content-head">
                  <div>
                    <h2 class="content-title">我的答辩记录</h2>
                    <p class="content-sub">查看每一级评审进度与结论。</p>
                  </div>
                </div>
                <article v-for="d in developer.defenses" :key="d.id" class="defense-row">
                  <div class="defense-row-main">
                    <RouterLink class="defense-row-title" :to="`/defenses/${d.id}`">{{ d.title }}</RouterLink>
                    <p class="muted small">{{ d.department_name }} · 发起于 {{ formatDate(d.created_at) }}</p>
                    <p v-if="d.final_note" class="muted small defense-note">{{ d.final_note }}</p>
                  </div>
                  <span class="badge" :class="defenseStatusClass(d.status)">{{ defenseStatusLabel(d.status) }}</span>
                </article>
              </div>
            </div>

            <!-- 我的报名 -->
            <div v-show="tab === 'applications'">
              <div class="row-between content-head">
                <div>
                  <h2 class="content-title">我的报名</h2>
                  <p class="content-sub">查看每一份报名的处理进度。</p>
                </div>
                <RouterLink class="btn btn-ghost btn-sm" to="/jobs">继续报名 →</RouterLink>
              </div>

              <div v-if="!applications.length" class="empty-card">
                <h3>还没有报名记录</h3>
                <p>浏览部门岗位，找到合适的方向后提交第一份报名。</p>
                <RouterLink class="btn btn-primary" to="/jobs">去看看岗位</RouterLink>
              </div>

              <div v-else class="app-list">
                <article v-for="a in applications" :key="a.id" class="app-card">
                  <div class="app-head">
                    <div class="app-main">
                      <RouterLink class="app-title" :to="`/jobs/${a.jobSlug}`">
                        {{ a.jobTitle || '岗位已关闭' }}
                      </RouterLink>
                      <p class="app-meta">
                        {{ a.department || '—' }}
                        <span class="dot-sep" />
                        {{ a.location || '—' }}
                        <span class="dot-sep" />
                        报名于 {{ formatDate(a.created_at) }}
                      </p>
                    </div>
                    <span class="badge" :class="stageClass(a.stage)">{{ stageLabel(a.stage) }}</span>
                  </div>

                  <div class="app-sub">
                    <span class="app-resume">简历：{{ a.resume_title || '—' }}</span>
                    <span v-if="a.wechat" class="app-resume">微信：{{ a.wechat }}</span>
                    <span v-if="a.interview_at" class="app-resume">沟通时间：{{ formatDateTime(a.interview_at) }}</span>
                  </div>

                  <p v-if="a.interview_note" class="app-note">沟通记录：{{ a.interview_note }}</p>
                  <p v-if="a.review_note" class="app-note">审核意见：{{ a.review_note }}</p>
                  <p v-if="a.note" class="app-note">补充说明：{{ a.note }}</p>

                  <div v-if="a.stage === 'offered'" class="offer-box">
                    <div>
                      <b>部门已通过，等待你确认</b>
                      <p class="small muted">确认后你将加入「{{ a.department }}」，身份转为项目开发者。双向确认后才会进组。</p>
                    </div>
                    <button class="btn btn-primary btn-sm" :disabled="confirmBusy === a.id" @click="confirmApplication(a)">
                      {{ confirmBusy === a.id ? '确认中…' : '确认加入' }}
                    </button>
                  </div>

                  <button
                    v-if="a.oa_timeline?.length"
                    class="app-timeline-toggle"
                    @click="toggleTimeline(a.id)"
                  >
                    {{ expandedApp === a.id ? '收起审批进度' : `查看审批进度（${a.oa_timeline.length}）` }}
                  </button>
                  <ol v-if="expandedApp === a.id" class="timeline">
                    <li v-for="(e, i) in a.oa_timeline" :key="i" class="tl-item">
                      <span class="tl-dot" :class="`dot-${e.action}`" />
                      <div>
                        <div class="tl-head">
                          <strong>{{ actionLabel(e.action) }}</strong>
                          <span class="muted small">{{ e.by || e.viaModule || '' }}</span>
                        </div>
                        <div v-if="e.note" class="small">{{ e.note }}</div>
                        <div class="muted small">{{ formatDateTime(e.at) }}</div>
                      </div>
                    </li>
                  </ol>
                </article>
              </div>
            </div>

            <!-- 我的简历 -->
            <div v-show="tab === 'resumes'">
              <div class="row-between content-head">
                <div>
                  <h2 class="content-title">我的简历</h2>
                  <p class="content-sub">在线简历或 PDF 简历，报名时可选择使用。</p>
                </div>
                <div class="resume-head-actions">
                  <RouterLink class="btn btn-ghost btn-sm" to="/me/resumes/new">新建在线简历</RouterLink>
                  <button class="btn btn-primary btn-sm" :disabled="uploadBusy" @click="triggerUpload">
                    {{ uploadBusy ? '解析中…' : '上传 PDF 简历' }}
                  </button>
                  <input ref="fileInput" class="hidden-input" type="file" accept=".pdf,application/pdf" @change="onFile" />
                </div>
              </div>

              <p v-if="uploadError" class="notice notice-error">{{ uploadError }}</p>
              <p v-if="uploadNotice" class="notice notice-info">{{ uploadNotice }}</p>

              <div v-if="!resumes.length" class="empty-card">
                <h3>还没有简历</h3>
                <p>上传 PDF 自动解析，或手动在线填写。创建后即可报名岗位。</p>
                <div class="empty-actions">
                  <button class="btn btn-primary" :disabled="uploadBusy" @click="triggerUpload">上传 PDF</button>
                  <RouterLink class="btn btn-ghost" to="/me/resumes/new">在线填写</RouterLink>
                </div>
              </div>

              <div v-else class="resume-list">
                <article v-for="r in resumes" :key="r.id" class="resume-card">
                  <div class="resume-head">
                    <div class="resume-title-row">
                      <h3 class="resume-title">{{ r.title }}</h3>
                      <span v-if="r.is_default" class="badge badge-blue">默认</span>
                    </div>
                    <span v-if="r.has_file" class="resume-file">PDF · {{ fileSize(r.file_size) }}</span>
                  </div>
                  <p class="resume-meta">
                    {{ r.name || '未填写姓名' }}
                    <span class="dot-sep" />
                    {{ r.phone || r.email || '未填写联系方式' }}
                    <span v-if="r.education || r.school" class="dot-sep" />
                    <span v-if="r.education || r.school">{{ [r.education, r.school].filter(Boolean).join(' · ') }}</span>
                  </p>
                  <p v-if="r.summary || r.skills" class="resume-summary">
                    {{ r.summary || r.skills }}
                  </p>
                  <p v-if="r.parse_note" class="notice notice-info resume-note">{{ r.parse_note }}</p>
                  <div class="resume-actions">
                    <RouterLink class="btn btn-ghost btn-sm" :to="`/me/resumes/${r.id}`">编辑</RouterLink>
                    <button v-if="r.has_file" class="btn btn-ghost btn-sm" @click="download(r)">查看 PDF</button>
                    <button v-if="!r.is_default" class="btn btn-ghost btn-sm" @click="makeDefault(r)">设为默认</button>
                    <button class="btn btn-danger btn-sm" @click="removeResume(r)">删除</button>
                  </div>
                </article>
              </div>
            </div>

            <!-- 账号信息 -->
            <div v-show="tab === 'account'">
              <div class="row-between content-head">
                <div>
                  <h2 class="content-title">账号信息</h2>
                  <p class="content-sub">账号由集市统一身份提供。</p>
                </div>
              </div>
              <div class="form-section">
                <dl class="account-list">
                  <div><dt>昵称</dt><dd>{{ user?.name || '—' }}</dd></div>
                  <div><dt>邮箱</dt><dd>{{ user?.email || '未返回' }}</dd></div>
                  <div><dt>登录方式</dt><dd>{{ user?.provider === 'sso' ? '集市统一身份（UniSSO）' : '管理员邮箱验证码' }}</dd></div>
                  <div><dt>身份类型</dt><dd>{{ user?.internal ? '院内用户' : '院外用户' }}</dd></div>
                  <div v-if="user?.roles?.length"><dt>角色</dt><dd>{{ user.roles.join('、') }}</dd></div>
                  <div v-if="user?.admin_departments?.length">
                    <dt>管理部门</dt>
                    <dd>{{ user.admin_departments.map((d) => d.name).join('、') }}</dd>
                  </div>
                </dl>
                <p class="hint">如需修改头像、昵称或绑定账号，请前往集市账号中心。</p>
                <div class="account-actions">
                  <RouterLink v-if="isStaff" class="btn btn-primary" to="/admin">进入管理后台</RouterLink>
                  <button class="btn btn-ghost" @click="onLogout">退出登录</button>
                  <a class="btn btn-ghost" href="https://ssemarket.cn" target="_blank" rel="noopener">集市主页 ↗</a>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Application, type MeOverview, type MyDeveloperProfile, type Resume } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuth } from '../stores/auth'
import {
  actionLabel,
  defenseStatusClass,
  defenseStatusLabel,
  formatDate,
  formatDateTime,
  levelClass,
  stageClass,
  stageLabel,
} from '../utils/labels'

type Tab = 'identity' | 'applications' | 'resumes' | 'account'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const user = auth.user
const isAdmin = auth.isAdmin
const isStaff = auth.isStaff

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'identity', label: '个人主页' },
  { id: 'applications', label: '我的报名' },
  { id: 'resumes', label: '我的简历' },
  { id: 'account', label: '账号信息' },
]

function normalizeTab(v: unknown): Tab {
  return v === 'applications' || v === 'resumes' || v === 'account' ? v : 'identity'
}

const tab = ref<Tab>(normalizeTab(route.query.tab))
const overview = ref<MeOverview | null>(null)
const developer = ref<MyDeveloperProfile | null>(null)
const confirmBusy = ref(0)
const applications = ref<Application[]>([])
const resumes = ref<Resume[]>([])
const loading = ref(true)
const error = ref('')
const uploadBusy = ref(false)
const uploadError = ref('')
const uploadNotice = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const expandedApp = ref<number | null>(null)

const initial = computed(() => (user.value?.name || user.value?.email || '?').slice(0, 1).toUpperCase())

const activeDefense = computed(
  () =>
    developer.value?.defenses.find((d) =>
      ['submitted', 'level1', 'level2', 'level3', 'waitlist'].includes(d.status),
    ) || null,
)

const canInitiateDefense = computed(() => {
  const d = developer.value
  if (!d) return false
  return (
    d.status === 'active' &&
    d.developer_level === 'project' &&
    Boolean(d.department) &&
    !activeDefense.value
  )
})

const progressStep = computed(() => {
  const level = developer.value?.developer_level
  if (level === 'roundtable') return 3
  if (level === 'project') return 2
  return 1
})

const pendingReviews = computed(() => developer.value?.pending_reviews || [])

async function confirmApplication(a: Application) {
  if (!window.confirm(`确认加入「${a.department}」？确认后你将成为该部门的项目开发者。`)) return
  confirmBusy.value = a.id
  error.value = ''
  try {
    await api.confirmApplication(a.id)
    await loadData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '确认失败'
  } finally {
    confirmBusy.value = 0
  }
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [o, a, r, d] = await Promise.all([
      api.myOverview(),
      api.myApplications(),
      api.myResumes(),
      api.myDeveloper(),
    ])
    overview.value = o
    applications.value = a || []
    resumes.value = r || []
    developer.value = d
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function setTab(t: Tab) {
  tab.value = t
  router.replace({ path: '/me', query: { tab: t } })
}

function toggleTimeline(id: number) {
  expandedApp.value = expandedApp.value === id ? null : id
}

function fileSize(n: number): string {
  if (!n) return '0 KB'
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function triggerUpload() {
  uploadError.value = ''
  uploadNotice.value = ''
  fileInput.value?.click()
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadError.value = ''
  uploadNotice.value = ''
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    uploadError.value = '仅支持 PDF 格式的简历'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    uploadError.value = '文件不能超过 10MB'
    return
  }
  uploadBusy.value = true
  try {
    const dataUrl = await readAsDataURL(file)
    const base64 = dataUrl.split(',')[1] || ''
    const res = await api.uploadResume(file.name, base64)
    if (res.warning) uploadNotice.value = res.warning
    await loadData()
    router.push(`/me/resumes/${res.resume.id}`)
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    uploadBusy.value = false
  }
}

async function makeDefault(r: Resume) {
  try {
    await api.setDefaultResume(r.id)
    await loadData()
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : '操作失败'
  }
}

async function removeResume(r: Resume) {
  if (!window.confirm(`确认删除简历「${r.title}」？已报名的记录不受影响。`)) return
  try {
    await api.deleteResume(r.id)
    await loadData()
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : '删除失败'
  }
}

function download(r: Resume) {
  window.open(api.resumeFileUrl(r.id), '_blank')
}

async function onLogout() {
  await auth.logout()
  router.push('/')
}

onMounted(loadData)
watch(
  () => route.query.tab,
  (v) => {
    const t = normalizeTab(v)
    if (t !== tab.value) tab.value = t
  },
)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.me-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 26px;
}
.me-user {
  display: flex;
  align-items: center;
  gap: 16px;
}
.me-avatar,
.me-avatar-img {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  flex: none;
}
.me-avatar {
  display: grid;
  place-items: center;
  background: #f2f2f2;
  color: var(--ink-soft);
  font-size: 22px;
  font-weight: 600;
}
.me-avatar-img {
  object-fit: cover;
}
.me-name {
  margin: 0 0 3px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.me-email {
  margin: 0 0 8px;
  color: var(--ink-soft);
  font-size: 13px;
}
.me-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.badge-blue {
  color: var(--ink-soft);
}
.me-head-actions {
  display: flex;
  gap: 8px;
}
.me-summary {
  display: flex;
  gap: 8px 22px;
  flex-wrap: wrap;
  padding: 14px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  margin-bottom: 24px;
  color: var(--ink-faint);
  font-size: 12px;
}
.me-summary b {
  color: var(--ink);
  font-weight: 600;
}
.me-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 40px;
  align-items: start;
}
.me-nav {
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.me-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 9px 12px;
  border-radius: 9px;
  color: var(--ink-soft);
  font-size: 14px;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}
.me-nav-item:hover {
  background: transparent;
  color: var(--ink);
}
.me-nav-item.active {
  background: transparent;
  color: var(--ink);
  font-weight: 600;
}
.me-nav-count {
  font-size: 11px;
  opacity: 0.7;
}
.me-loading {
  padding: 60px 0;
  text-align: center;
  color: var(--ink-soft);
  font-size: 14px;
}
.content-head {
  margin-bottom: 18px;
  align-items: flex-end;
}
.content-title {
  margin: 0;
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.content-sub {
  margin: 5px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
}
.empty-card {
  padding: 40px 0;
  border: none;
  text-align: center;
  background: transparent;
}
.empty-card h3 {
  margin: 0 0 8px;
  font-size: 17px;
}
.empty-card p {
  margin: 0 0 20px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
}
.empty-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 报名 */
.app-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.app-card {
  padding: 18px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.app-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.app-main {
  min-width: 0;
}
.app-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.app-title:hover {
  color: var(--ink);
}
.app-meta {
  margin: 6px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--ink-faint);
  font-size: 12px;
}
.app-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}
.app-resume {
  color: var(--ink-soft);
  font-size: 12px;
}
.app-note {
  margin: 10px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
}
.app-timeline-toggle {
  margin-top: 12px;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
}
.timeline {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.tl-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.tl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
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

/* 简历 */
.resume-head-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hidden-input {
  display: none;
}
.resume-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.resume-card {
  padding: 18px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.resume-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.resume-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.resume-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.resume-file {
  color: var(--ink-faint);
  font-size: 12px;
  flex: none;
}
.resume-meta {
  margin: 8px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--ink-soft);
  font-size: 12px;
}
.resume-summary {
  margin: 10px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.resume-note {
  margin-top: 10px;
}
.resume-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

/* 账号 */
.account-list {
  margin: 0;
  display: grid;
  gap: 0;
}
.account-list > div {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line-soft);
  font-size: 14px;
}
.account-list dt {
  color: var(--ink-faint);
  font-size: 13px;
}
.account-list dd {
  margin: 0;
}
.account-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 20px;
}

/* 开发者身份 */
.identity-card {
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}
.identity-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.identity-meta {
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: var(--ink-faint);
  font-size: 12px;
}
.identity-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.level-track {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 20px;
  padding: 16px;
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.track-step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-left: 22px;
  opacity: 0.55;
}
.track-step.done,
.track-step.current {
  opacity: 1;
}
.track-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #cfd4dc;
}
.track-step.done .track-dot {
  background: var(--ink);
}
.track-step.current .track-dot {
  background: var(--ink);
}
.track-step b {
  font-size: 13px;
}
.track-desc {
  color: var(--ink-faint);
  font-size: 11px;
}
.identity-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 16px;
}
.identity-stats div {
  padding: 10px 0 0;
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
}
.identity-stats b {
  display: block;
  font-size: 16px;
  margin-bottom: 2px;
}
.identity-stats span {
  color: var(--ink-faint);
  font-size: 11px;
}
.identity-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.identity-hint {
  margin: 14px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.75;
}
.review-tasks,
.defense-history {
  margin-top: 26px;
}
.review-task,
.defense-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  margin-top: 0;
}
.review-task-title,
.defense-row-title {
  display: block;
  margin-top: 5px;
  font-size: 14px;
  font-weight: 700;
}
.review-task-title:hover,
.defense-row-title:hover {
  color: var(--ink);
}
.review-task p,
.defense-row p {
  margin: 3px 0 0;
}
.defense-row-main {
  min-width: 0;
}
.defense-note {
  max-width: 620px;
}
.offer-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding: 12px 0;
  border: none;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.offer-box b {
  font-size: 13px;
}
.offer-box p {
  margin: 3px 0 0;
}

@media (max-width: 900px) {
  .me-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .me-nav {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
