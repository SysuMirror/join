<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main">
      <div class="breadcrumb">
        <RouterLink to="/">首页</RouterLink>
        <span class="crumb-sep">/</span>
        <RouterLink to="/jobs">部门岗位</RouterLink>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">{{ job?.title || '岗位详情' }}</span>
      </div>

      <div v-if="loading" class="loading-block">
        <span class="spinner" />加载中…
      </div>
      <p v-else-if="error" class="notice notice-error">{{ error }}</p>

      <template v-else-if="job">
        <header class="job-head">
          <div class="job-badges">
            <span class="badge" :class="typeClass(job.type)">{{ typeLabel(job.type) }}</span>
            <span v-if="job.auto_approve" class="badge badge-amber">常驻招聘 · 自动通过</span>
            <span v-if="job.direction" class="badge badge-blue">{{ job.direction }}</span>
            <span v-if="job.updatedAt" class="job-updated">更新于 {{ formatDate(job.updatedAt) }}</span>
          </div>
          <h1 class="job-title">{{ job.title }}</h1>
          <div class="job-meta-row">
            <span>{{ job.department || '未分组' }}</span>
            <span class="dot-sep" />
            <span>{{ job.location || '线上' }}</span>
            <template v-if="job.experience">
              <span class="dot-sep" />
              <span>对象：{{ job.experience }}</span>
            </template>
            <template v-if="job.education">
              <span class="dot-sep" />
              <span>年级：{{ job.education }}</span>
            </template>
            <template v-if="job.headcount">
              <span class="dot-sep" />
              <span>招募 {{ job.headcount }} 人</span>
            </template>
            <span v-if="job.salary" class="job-commitment">时间投入：{{ job.salary }}</span>
          </div>
          <div v-if="job.tags?.length" class="job-tags">
            <span v-for="t in job.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <div class="job-head-actions">
            <button class="btn btn-ghost btn-sm" @click="share">
              {{ copied ? '已复制链接' : '分享岗位' }}
            </button>
          </div>
        </header>

        <div class="detail-layout">
          <article class="detail-main">
            <section v-if="job.summary" class="detail-section lead">
              <p class="job-lead">{{ job.summary }}</p>
            </section>

            <section v-if="responsibilities" class="detail-section">
              <h2 class="block-title">岗位职责</h2>
              <pre class="text-block">{{ responsibilities }}</pre>
            </section>

            <section v-if="job.requirements" class="detail-section">
              <h2 class="block-title">招募要求</h2>
              <pre class="text-block">{{ job.requirements }}</pre>
            </section>

            <section v-if="job.bonus" class="detail-section">
              <h2 class="block-title">加分项</h2>
              <pre class="text-block">{{ job.bonus }}</pre>
            </section>

            <section v-if="job.departmentInfo" class="detail-section">
              <h2 class="block-title">部门介绍</h2>
              <div class="dept-intro">
                <div class="dept-intro-head">
                  <strong>{{ job.departmentInfo.name }}</strong>
                  <span class="dept-intro-links">
                    <RouterLink class="dept-intro-link" :to="`/departments/${job.departmentInfo.slug}`">
                      部门介绍 →
                    </RouterLink>
                    <RouterLink
                      class="dept-intro-link"
                      :to="{ path: '/jobs', query: { department: job.departmentInfo.slug } }"
                    >
                      全部岗位 →
                    </RouterLink>
                  </span>
                </div>
                <p>{{ job.departmentInfo.description || job.departmentInfo.summary || '这个部门正在寻找志同道合的伙伴。' }}</p>
              </div>
            </section>
          </article>

          <aside class="apply-panel">
            <div class="apply-card">
              <div class="apply-card-head">
                <span class="apply-eyebrow">时间投入</span>
                <span class="apply-commitment">{{ job.salary || '时间灵活' }}</span>
                <span class="apply-loc">{{ job.location || '线上' }} · {{ typeLabel(job.type) }}</span>
              </div>

              <template v-if="applied">
                <p class="notice notice-success">{{ applySuccess || '已报名成功，可在「我的报名」查看进度。' }}</p>
                <RouterLink class="btn btn-ghost btn-block" to="/me?tab=applications">
                  查看我的报名 →
                </RouterLink>
              </template>

              <template v-else-if="!authState.user">
                <RouterLink class="btn btn-primary btn-block" :to="loginTo">
                  登录后报名
                </RouterLink>
                <p class="apply-hint">使用集市统一身份登录，无需重复注册。</p>
              </template>

              <template v-else-if="!resumes.length">
                <RouterLink class="btn btn-primary btn-block" :to="resumeNewTo">
                  创建简历后报名
                </RouterLink>
                <p class="apply-hint">你还没有简历。可以先上传 PDF 自动解析，或在线填写。</p>
              </template>

              <template v-else>
                <button class="btn btn-primary btn-block" @click="openApply">报名</button>
                <p class="apply-hint">
                  将使用默认简历「{{ defaultResumeTitle }}」报名。
                  <RouterLink to="/me?tab=resumes" class="inline-link">管理简历</RouterLink>
                </p>
              </template>

              <p v-if="job.auto_approve" class="apply-hint auto-hint">
                常驻招聘：简历信息完整时，报名后自动通过并加入部门。
              </p>
              <p
                v-if="job.auto_approve && defaultResume && defaultResume.complete === false"
                class="apply-hint auto-hint"
              >
                当前默认简历还差：{{ (defaultResume.missing_fields || []).join('、') }}，补全后即可自动通过。
              </p>

              <div class="apply-divider" />
              <ul class="apply-facts">
                <li v-if="job.experience"><span>招募对象</span><strong>{{ job.experience }}</strong></li>
                <li v-if="job.education"><span>年级要求</span><strong>{{ job.education }}</strong></li>
                <li v-if="job.salary"><span>时间投入</span><strong>{{ job.salary }}</strong></li>
                <li v-if="job.headcount"><span>招募人数</span><strong>{{ job.headcount }} 人</strong></li>
                <li><span>报名方式</span><strong>在线报名</strong></li>
              </ul>

              <div v-if="job.contact_wechat" class="wechat-box">
                <div class="wechat-box-head">
                  <span class="wechat-label">咨询微信</span>
                  <button class="wechat-copy" type="button" @click="copyWechat">
                    {{ wechatCopied ? '已复制' : '复制' }}
                  </button>
                </div>
                <span class="wechat-id">{{ job.contact_wechat }}</span>
                <p class="wechat-hint">报名前后都可以加微信沟通。</p>
              </div>
            </div>
          </aside>
        </div>

        <section v-if="job.related?.length" class="related">
          <div class="section-head">
            <div>
              <h2 class="section-title">相关岗位</h2>
              <p class="section-sub">也许你也会感兴趣。</p>
            </div>
            <RouterLink class="btn btn-ghost btn-sm" to="/jobs">全部岗位 →</RouterLink>
          </div>
          <div class="job-list">
            <JobCard v-for="r in job.related" :key="r.id" :job="r" />
          </div>
        </section>
      </template>
    </main>

    <SiteFooter />

    <!-- 报名弹窗 -->
    <div v-if="applyOpen" class="modal-backdrop" @click.self="applyOpen = false">
      <form class="modal" @submit.prevent="submitApply">
        <h3>报名「{{ job?.title }}」</h3>
        <div class="field">
          <label>选择简历</label>
          <select v-model.number="applyResumeId">
            <option v-for="r in resumes" :key="r.id" :value="r.id">
              {{ r.title }}{{ r.is_default ? '（默认）' : '' }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>微信号（选填，方便后续沟通）</label>
          <input v-model="applyWechat" maxlength="60" placeholder="微信号 / 手机号" />
        </div>
        <div class="field">
          <label>补充说明（选填）</label>
          <textarea
            v-model="applyNote"
            rows="4"
            maxlength="2000"
            placeholder="可以补充你的报名动机、可投入的时间等"
          />
        </div>
        <p v-if="applyError" class="notice notice-error">{{ applyError }}</p>
        <p class="hint">提交后可在「我的报名」查看进度；同一岗位请勿重复报名。</p>
        <div class="modal-actions">
          <button class="btn btn-primary" type="submit" :disabled="applying">
            {{ applying ? '提交中…' : '确认报名' }}
          </button>
          <button class="btn btn-ghost" type="button" @click="applyOpen = false">取消</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Application, type Job, type Resume } from '../api'
import JobCard from '../components/JobCard.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuth } from '../stores/auth'
import { useSiteStore } from '../stores/site'
import { formatDate, typeClass, typeLabel } from '../utils/labels'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const authState = auth.state

const job = ref<Job | null>(null)
const loading = ref(true)
const error = ref('')
const resumes = ref<Resume[]>([])

const applyOpen = ref(false)
const applyResumeId = ref(0)
const applyNote = ref('')
const applyWechat = ref('')
const applying = ref(false)
const applyError = ref('')
const applied = ref(false)
const applySuccess = ref('')
const copied = ref(false)
const wechatCopied = ref(false)

const slug = computed(() => String(route.params.slug || ''))
const loginTo = computed(() => ({
  path: '/login',
  query: { redirect: route.fullPath },
}))
const resumeNewTo = computed(() => ({
  path: '/me/resumes/new',
  query: { redirect: route.fullPath },
}))
const responsibilities = computed(
  () => job.value?.responsibilities || job.value?.description || '',
)
const defaultResume = computed(
  () => resumes.value.find((x) => x.is_default) || resumes.value[0] || null,
)
const defaultResumeTitle = computed(() => defaultResume.value?.title || '我的简历')

async function load() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([useSiteStore().ensure(), auth.ensure()])
    job.value = await api.job(slug.value)
    // 统一使用数字 ID 作为岗位 URL，旧 slug 链接自动跳转
    if (route.params.slug !== String(job.value.id)) {
      router.replace(`/jobs/${job.value.id}`)
    }
    if (authState.user) {
      const [rs, apps] = await Promise.all([
        api.myResumes().catch(() => [] as Resume[]),
        api.myApplications().catch(() => [] as Application[]),
      ])
      resumes.value = rs || []
      const def = resumes.value.find((r) => r.is_default) || resumes.value[0]
      applyResumeId.value = def?.id || 0
      applied.value = (apps || []).some(
        (a) => a.job_id === job.value?.id && a.status !== 'rejected',
      )
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openApply() {
  applyError.value = ''
  applyNote.value = ''
  applyWechat.value = ''
  const def = resumes.value.find((r) => r.is_default) || resumes.value[0]
  applyResumeId.value = def?.id || 0
  applyOpen.value = true
}

async function copyWechat() {
  const value = job.value?.contact_wechat
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    wechatCopied.value = true
    window.setTimeout(() => (wechatCopied.value = false), 2000)
  } catch {
    window.prompt('复制微信号', value)
  }
}

async function submitApply() {
  if (!applyResumeId.value) {
    applyError.value = '请选择一份简历'
    return
  }
  applying.value = true
  applyError.value = ''
  try {
    const res = (await api.apply(slug.value, {
      resume_id: applyResumeId.value,
      note: applyNote.value.trim(),
      wechat: applyWechat.value.trim(),
    })) as { message?: string; auto_approved?: boolean }
    applied.value = true
    applySuccess.value = res?.message || ''
    applyOpen.value = false
  } catch (e) {
    applyError.value = e instanceof Error ? e.message : '报名失败'
  } finally {
    applying.value = false
  }
}

async function share() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 2000)
  } catch {
    window.prompt('复制岗位链接', window.location.href)
  }
}

onMounted(load)
watch(
  () => route.params.slug,
  (v, old) => {
    if (v && v !== old) {
      applied.value = false
      applySuccess.value = ''
      load()
    }
  },
)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-faint);
  margin-bottom: 28px;
}
.breadcrumb a:hover {
  color: var(--ink);
}
.crumb-current {
  color: var(--ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.loading-block {
  padding: 80px 0;
  color: var(--ink-soft);
  font-size: 14px;
}

.job-head {
  position: relative;
  padding-bottom: 30px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 36px;
}
.job-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.job-updated {
  color: var(--ink-faint);
  font-size: 12px;
  margin-left: 4px;
}
.job-title {
  margin: 18px 0 14px;
  font-size: clamp(30px, 4.6vw, 44px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
}
.job-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--ink-soft);
  font-size: 14px;
}
.job-commitment {
  margin-left: 4px;
  color: var(--ink-soft);
  font-weight: 600;
}
.job-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.job-head-actions {
  position: absolute;
  right: 0;
  bottom: 30px;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 56px;
  align-items: start;
}
.detail-section {
  margin-bottom: 36px;
}
.job-lead {
  margin: 0;
  color: var(--ink-soft);
  font-size: 16px;
  line-height: 1.85;
  max-width: 680px;
}
.block-title {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.text-block {
  margin: 0;
  white-space: pre-wrap;
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.9;
  color: var(--ink);
}
.dept-intro {
  padding: 16px 0;
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.dept-intro-head {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 14px;
}
.dept-intro-links {
  display: flex;
  gap: 12px;
  margin-left: auto;
}
.dept-intro-link {
  color: var(--ink);
  font-size: 12px;
}
.dept-intro p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.8;
}

.apply-panel {
  position: sticky;
  top: 88px;
}
.apply-card {
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  padding: 16px 0;
  box-shadow: none;
}
.apply-card-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.apply-eyebrow {
  color: var(--ink-faint);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
}
.apply-commitment {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.apply-loc {
  color: var(--ink-soft);
  font-size: 13px;
}
.apply-hint {
  margin: 10px 0 0;
  color: var(--ink-faint);
  font-size: 12px;
  line-height: 1.6;
}
.auto-hint {
  color: #7a5a2e;
}
.inline-link {
  color: var(--ink);
}
.apply-divider {
  height: 1px;
  background: var(--line);
  margin: 18px 0 14px;
}
.apply-facts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.apply-facts li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.apply-facts span {
  color: var(--ink-faint);
}
.apply-facts strong {
  font-weight: 600;
}
.wechat-box {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.wechat-box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.wechat-label {
  color: var(--ink-faint);
  font-size: 12px;
}
.wechat-copy {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
}
.wechat-copy:hover {
  text-decoration: underline;
}
.wechat-id {
  display: block;
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
  word-break: break-all;
}
.wechat-hint {
  margin: 6px 0 0;
  color: var(--ink-faint);
  font-size: 11px;
  line-height: 1.6;
}
.related {
  margin-top: 64px;
}

.spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 8px;
  border: 2px solid var(--line);
  border-top-color: var(--ink);
  border-radius: 50%;
  vertical-align: middle;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .apply-panel {
    position: static;
  }
  .job-head-actions {
    position: static;
    margin-top: 18px;
  }
}
</style>
