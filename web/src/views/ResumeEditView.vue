<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main">
      <div class="editor-top">
        <RouterLink class="back-link" to="/me?tab=resumes">← 返回我的简历</RouterLink>
        <div class="editor-actions">
          <span class="save-state" :class="`state-${saveState}`">{{ saveLabel }}</span>
          <RouterLink v-if="redirectTo" class="btn btn-ghost btn-sm" :to="redirectTo">返回继续</RouterLink>
          <button v-if="!isNew" class="btn btn-danger btn-sm" @click="removeResume">删除简历</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : isNew ? '保存简历' : '保存修改' }}
          </button>
        </div>
      </div>

      <header class="editor-head">
        <h1 class="editor-title">{{ isNew ? '完善简历' : '编辑简历' }}</h1>
        <p class="editor-sub">
          填写姓名、年级、邮箱和简介即可。上传 PDF 后 AI 会自动解析，解析结果可以继续修改。
        </p>
      </header>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <p v-if="notice" class="notice notice-success">{{ notice }}</p>
      <p v-if="parseNote" class="notice notice-info">{{ parseNote }}</p>
      <p v-if="draftRestored" class="notice notice-info">
        已恢复上次未提交的本地草稿。
        <button class="link-btn" type="button" @click="discardDraft">清除草稿</button>
      </p>

      <!-- 新建：上传 PDF，AI 自动解析 -->
      <section v-if="isNew" class="upload-section">
        <div>
          <h2 class="upload-title">有现成 PDF？让 AI 帮你填</h2>
          <p class="upload-hint">支持 PDF，最大 10MB。上传后 AI 会提取姓名、年级、邮箱和简介。</p>
        </div>
        <button class="btn btn-soft btn-sm" type="button" :disabled="uploading" @click="triggerUpload">
          {{ uploading ? 'AI 解析中…' : '上传 PDF' }}
        </button>
        <input ref="fileInput" class="hidden-input" type="file" accept=".pdf,application/pdf" @change="onFile" />
      </section>

      <section v-if="!isNew && hasFile" class="file-section">
        <span class="muted small">PDF 附件：{{ fileName || 'resume.pdf' }}</span>
        <button class="link-btn" type="button" @click="openFile">查看 PDF</button>
      </section>

      <div v-if="loading" class="editor-loading">加载中…</div>

      <form v-else class="editor-form" @submit.prevent="save">
        <section class="form-section">
          <div class="form-grid">
            <div class="field">
              <label>姓名 *</label>
              <input v-model="form.name" required maxlength="60" placeholder="你的姓名" />
            </div>
            <div class="field">
              <label>年级 *</label>
              <select v-model="form.grade" required>
                <option value="" disabled>请选择年级</option>
                <option
                  v-if="form.grade && !gradeOptions.includes(form.grade)"
                  :value="form.grade"
                >
                  {{ form.grade }}
                </option>
                <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
            <div class="field">
              <label>邮箱 *</label>
              <input v-model="form.email" required type="email" maxlength="200" placeholder="you@example.com" />
            </div>
            <div class="field">
              <label>手机号（选填）</label>
              <input v-model="form.phone" maxlength="40" placeholder="方便联系你" />
            </div>
            <div class="field full">
              <label>简介 *</label>
              <textarea
                v-model="form.summary"
                required
                rows="7"
                maxlength="2000"
                placeholder="介绍一下你的技术方向、项目/实践经历、兴趣，以及每周大概能投入的时间。"
              />
            </div>
            <div class="field full checkbox-field">
              <label class="checkbox-label">
                <input v-model="form.is_default" type="checkbox" />
                <span>设为默认简历（报名时优先使用）</span>
              </label>
            </div>
          </div>
          <p v-if="missing.length" class="form-hint">还差：{{ missing.join('、') }}</p>
        </section>
      </form>

      <details v-if="parsedText" class="parsed-box">
        <summary>查看 PDF 解析原文</summary>
        <pre class="parsed-text">{{ parsedText }}</pre>
      </details>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Resume } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuth } from '../stores/auth'

type ResumeForm = {
  name: string
  grade: string
  email: string
  phone: string
  summary: string
  is_default: boolean
}

const DRAFT_KEY = 'join_resume_draft_v2'
const gradeOptions = ['大一', '大二', '大三', '大四', '研一', '研二', '研三', '已毕业', '其他']

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const user = auth.user

const isNew = computed(() => !route.params.id || route.params.id === 'new')
const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : ''
})

const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const notice = ref('')
const parseNote = ref('')
const parsedText = ref('')
const hasFile = ref(false)
const fileName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const draftRestored = ref(false)
const lastSavedAt = ref<Date | null>(null)
const saveState = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
const saveError = ref('')

const form = reactive<ResumeForm>({
  name: '',
  grade: '',
  email: '',
  phone: '',
  summary: '',
  is_default: false,
})

const missing = computed(() => {
  const list: string[] = []
  if (!form.name.trim()) list.push('姓名')
  if (!form.grade.trim()) list.push('年级')
  if (!form.email.trim()) list.push('邮箱')
  if (!form.summary.trim()) list.push('简介')
  return list
})

const saveLabel = computed(() => {
  if (saveState.value === 'saving') return '自动保存中…'
  if (saveState.value === 'dirty') return '有未保存修改'
  if (saveState.value === 'error') return saveError.value || '自动保存失败'
  if (saveState.value === 'saved') {
    if (isNew.value) return '草稿已保存在本机'
    const t = lastSavedAt.value
    return t ? `已自动保存 ${t.toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)}` : '已自动保存'
  }
  return ''
})

let hydrating = false
let autosaveTimer: number | undefined
let autoSaving = false
let pendingAutosave = false

function payload() {
  return {
    name: form.name.trim(),
    grade: form.grade.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    summary: form.summary.trim(),
    is_default: form.is_default,
  }
}

function resetForm() {
  form.name = user.value?.name || ''
  form.grade = ''
  form.email = user.value?.email || ''
  form.phone = ''
  form.summary = ''
  form.is_default = true
  parseNote.value = ''
  parsedText.value = ''
  hasFile.value = false
  fileName.value = ''
}

function fillForm(r: Awaited<ReturnType<typeof api.myResume>>) {
  form.name = r.name || ''
  form.grade = r.grade || ''
  form.email = r.email || user.value?.email || ''
  form.phone = r.phone || ''
  form.summary = r.summary || ''
  form.is_default = Boolean(r.is_default)
  parseNote.value = r.parse_note || ''
  parsedText.value = r.parsed_text || ''
  hasFile.value = Boolean(r.has_file)
  fileName.value = r.file_name || ''
}

function restoreDraft(): boolean {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return false
    const draft = JSON.parse(raw) as Partial<ResumeForm>
    if (!draft || typeof draft !== 'object') return false
    for (const key of ['name', 'grade', 'email', 'phone', 'summary'] as const) {
      if (typeof draft[key] === 'string') form[key] = draft[key] as string
    }
    if (draft.is_default != null) form.is_default = Boolean(draft.is_default)
    return true
  } catch {
    return false
  }
}

function persistDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form }))
    lastSavedAt.value = new Date()
    saveState.value = 'saved'
  } catch {
    saveState.value = 'error'
    saveError.value = '本地草稿保存失败'
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

function discardDraft() {
  clearDraft()
  draftRestored.value = false
  resetForm()
  saveState.value = 'idle'
  lastSavedAt.value = null
}

async function load() {
  loading.value = true
  hydrating = true
  error.value = ''
  notice.value = ''
  try {
    await auth.ensure()
    if (isNew.value) {
      resetForm()
      draftRestored.value = restoreDraft()
    } else {
      const r = await api.myResume(Number(route.params.id))
      fillForm(r)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    await nextTick()
    hydrating = false
    loading.value = false
  }
}

function validate(): string {
  if (!form.name.trim()) return '请填写姓名'
  if (!form.grade.trim()) return '请选择年级'
  if (!form.email.trim()) return '请填写邮箱'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return '邮箱格式不正确'
  if (!form.summary.trim()) return '请填写简介'
  return ''
}

async function save() {
  error.value = ''
  notice.value = ''
  const msg = validate()
  if (msg) {
    error.value = msg
    return
  }
  saving.value = true
  saveState.value = 'saving'
  try {
    if (isNew.value) {
      const r = await api.createResume(payload())
      clearDraft()
      draftRestored.value = false
      lastSavedAt.value = new Date()
      saveState.value = 'saved'
      if (redirectTo.value) {
        await router.replace(redirectTo.value)
        return
      }
      notice.value = '简历已保存'
      await router.replace(`/me/resumes/${r.id}`)
      await load()
    } else {
      await api.updateResume(Number(route.params.id), payload())
      lastSavedAt.value = new Date()
      saveState.value = 'saved'
      if (redirectTo.value) {
        await router.replace(redirectTo.value)
        return
      }
      notice.value = '已保存'
    }
  } catch (e) {
    saveState.value = 'error'
    saveError.value = e instanceof Error ? e.message : '保存失败'
    error.value = saveError.value
  } finally {
    saving.value = false
  }
}

async function autosave() {
  if (hydrating || loading.value) return
  if (saving.value) {
    pendingAutosave = true
    return
  }
  if (autoSaving) {
    pendingAutosave = true
    return
  }
  if (isNew.value) {
    persistDraft()
    return
  }
  autoSaving = true
  saveState.value = 'saving'
  try {
    await api.updateResume(Number(route.params.id), payload())
    lastSavedAt.value = new Date()
    saveState.value = 'saved'
  } catch (e) {
    saveState.value = 'error'
    saveError.value = e instanceof Error ? e.message : '自动保存失败'
  } finally {
    autoSaving = false
    if (pendingAutosave) {
      pendingAutosave = false
      scheduleAutosave()
    }
  }
}

function scheduleAutosave() {
  if (hydrating) return
  saveState.value = 'dirty'
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
  autosaveTimer = window.setTimeout(() => {
    void autosave()
  }, 1200)
}

watch(form, scheduleAutosave, { deep: true })

function triggerUpload() {
  error.value = ''
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
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    error.value = '仅支持 PDF 格式的简历'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    error.value = '文件不能超过 10MB'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const dataUrl = await readAsDataURL(file)
    const res = await api.uploadResume(file.name, dataUrl.split(',')[1] || '')
    clearDraft()
    await router.replace({
      path: `/me/resumes/${res.resume.id}`,
      query: redirectTo.value ? { redirect: redirectTo.value } : {},
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    uploading.value = false
  }
}

async function removeResume() {
  if (!window.confirm('确认删除这份简历？已报名的记录不受影响。')) return
  try {
    await api.deleteResume(Number(route.params.id))
    router.replace('/me?tab=resumes')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

function openFile() {
  window.open(api.resumeFileUrl(Number(route.params.id)), '_blank')
}

onMounted(load)
onBeforeUnmount(() => {
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
})
watch(
  () => route.params.id,
  () => {
    void load()
  },
)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.editor-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.back-link {
  color: var(--ink-soft);
  font-size: 13px;
}
.back-link:hover {
  color: var(--ink);
}
.editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.save-state {
  color: var(--ink-faint);
  font-size: 11px;
}
.state-dirty {
  color: #7a5a2e;
}
.state-error {
  color: #8a4a42;
}
.editor-head {
  margin-bottom: 22px;
}
.editor-title {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.025em;
}
.editor-sub {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
}
.upload-section,
.file-section {
  max-width: 880px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  margin-bottom: 8px;
}
.upload-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
}
.upload-hint {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.6;
}
.file-section {
  border-top: none;
  padding-top: 0;
}
.hidden-input {
  display: none;
}
.editor-form {
  max-width: 880px;
}
.editor-form .form-section {
  padding-top: 20px;
}
.form-hint {
  margin: 14px 0 0;
  color: #7a5a2e;
  font-size: 12px;
}
.checkbox-field {
  padding-top: 4px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
}
.editor-loading {
  padding: 60px 0;
  text-align: center;
  color: var(--ink-soft);
}
.parsed-box {
  max-width: 880px;
  margin-top: 18px;
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  padding: 14px 0;
}
.parsed-box summary {
  cursor: pointer;
  color: var(--ink-soft);
  font-size: 13px;
}
.parsed-text {
  margin: 12px 0 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  font-family: var(--font);
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-soft);
}
.link-btn {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--ink);
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 2px;
}
@media (max-width: 640px) {
  .upload-section,
  .file-section {
    align-items: flex-start;
    flex-direction: column;
  }
  .editor-actions .save-state {
    flex-basis: 100%;
  }
}
</style>