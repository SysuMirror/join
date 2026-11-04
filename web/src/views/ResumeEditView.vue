<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main">
      <div class="editor-top">
        <RouterLink class="back-link" to="/me?tab=resumes">← 返回我的简历</RouterLink>
        <div class="editor-actions">
          <RouterLink v-if="redirectTo" class="btn btn-ghost btn-sm" :to="redirectTo">返回报名</RouterLink>
          <button v-if="!isNew" class="btn btn-danger btn-sm" @click="removeResume">删除简历</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : isNew ? '创建简历' : '保存修改' }}
          </button>
        </div>
      </div>

      <header class="editor-head">
        <h1 class="editor-title">{{ isNew ? '新建简历' : '编辑简历' }}</h1>
        <p class="editor-sub">
          简历信息仅用于本次部门双选评估。上传 PDF 后会自动解析并预填，你可以随时修改。
        </p>
      </header>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <p v-if="notice" class="notice notice-success">{{ notice }}</p>
      <p v-if="parseNote" class="notice notice-info">{{ parseNote }}</p>

      <!-- 新建时上传 PDF -->
      <section v-if="isNew" class="form-section upload-section">
        <div class="upload-copy">
          <h2 class="form-section-title">上传 PDF 简历（可选）</h2>
          <p class="upload-hint">支持 PDF，最大 10MB。上传后自动解析并创建一份可编辑的在线简历。</p>
        </div>
        <div class="upload-actions">
          <button class="btn btn-soft" :disabled="uploading" @click="triggerUpload">
            {{ uploading ? '解析中…' : '选择 PDF 文件' }}
          </button>
          <input ref="fileInput" class="hidden-input" type="file" accept=".pdf,application/pdf" @change="onFile" />
          <span class="upload-or">或直接在下方填写</span>
        </div>
      </section>

      <!-- 编辑时展示附件 -->
      <section v-if="!isNew && hasFile" class="form-section file-section">
        <div>
          <h2 class="form-section-title">PDF 附件</h2>
          <p class="file-name">{{ fileName || 'resume.pdf' }}</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" @click="openFile">查看 PDF</button>
      </section>

      <div v-if="loading" class="editor-loading">加载中…</div>

      <template v-else>
        <!-- 基本信息 -->
        <section class="form-section">
          <h2 class="form-section-title">基本信息</h2>
          <div class="form-grid">
            <div class="field full">
              <label>简历标题</label>
              <input v-model="form.title" maxlength="100" placeholder="如：张三的简历" />
            </div>
            <div class="field">
              <label>姓名 *</label>
              <input v-model="form.name" maxlength="60" placeholder="你的姓名" />
            </div>
            <div class="field">
              <label>手机号</label>
              <input v-model="form.phone" maxlength="40" placeholder="用于联系你" />
            </div>
            <div class="field">
              <label>邮箱</label>
              <input v-model="form.email" maxlength="200" placeholder="you@example.com" />
            </div>
            <div class="field">
              <label>所在城市</label>
              <input v-model="form.city" maxlength="60" placeholder="如：广州" />
            </div>
            <div class="field">
              <label>求职意向</label>
              <input v-model="form.intention" maxlength="100" placeholder="如：前端开发工程师" />
            </div>
            <div class="field">
              <label>工作年限</label>
              <input v-model.number="form.experience_years" type="number" min="0" max="60" />
            </div>
          </div>
        </section>

        <!-- 教育背景 -->
        <section class="form-section">
          <h2 class="form-section-title">教育背景</h2>
          <div class="form-grid">
            <div class="field">
              <label>最高学历</label>
              <select v-model="form.education">
                <option value="">请选择</option>
                <option v-for="e in eduOptions" :key="e" :value="e">{{ e }}</option>
                <option
                  v-if="form.education && !eduOptions.includes(form.education)"
                  :value="form.education"
                >
                  {{ form.education }}
                </option>
              </select>
            </div>
            <div class="field">
              <label>学校</label>
              <input v-model="form.school" maxlength="100" placeholder="如：中山大学" />
            </div>
            <div class="field">
              <label>专业</label>
              <input v-model="form.major" maxlength="100" placeholder="如：软件工程" />
            </div>
            <div class="field">
              <label>毕业年份</label>
              <input v-model="form.graduation_year" maxlength="20" placeholder="如：2026" />
            </div>
            <div class="field full">
              <label>教育经历补充（选填）</label>
              <textarea
                v-model="form.education_experience"
                rows="3"
                placeholder="主修课程、奖项、校园经历等"
              />
            </div>
          </div>
        </section>

        <!-- 工作/实习经历 -->
        <section class="form-section">
          <h2 class="form-section-title">工作 / 实习经历</h2>
          <div class="field">
            <textarea
              v-model="form.work_experience"
              rows="7"
              placeholder="公司 / 时间 / 岗位 / 主要工作与成果，每段经历换行分隔"
            />
          </div>
        </section>

        <!-- 项目经历 -->
        <section class="form-section">
          <h2 class="form-section-title">项目经历</h2>
          <div class="field">
            <textarea
              v-model="form.project_experience"
              rows="6"
              placeholder="项目名称 / 你的角色 / 技术栈 / 解决的问题与结果"
            />
          </div>
        </section>

        <!-- 技能与自我评价 -->
        <section class="form-section">
          <h2 class="form-section-title">技能与自我评价</h2>
          <div class="form-grid">
            <div class="field full">
              <label>专业技能（用逗号分隔）</label>
              <input v-model="form.skills" maxlength="500" placeholder="如：TypeScript, Vue, Node.js" />
            </div>
            <div class="field full">
              <label>自我评价</label>
              <textarea v-model="form.summary" rows="4" placeholder="简单介绍你的优势与方向" />
            </div>
            <div class="field full checkbox-field">
              <label class="checkbox-label">
                <input v-model="form.is_default" type="checkbox" />
                <span>设为默认简历（报名时优先使用）</span>
              </label>
            </div>
          </div>
        </section>

        <div class="editor-bottom">
          <RouterLink class="btn btn-ghost" to="/me?tab=resumes">取消</RouterLink>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : isNew ? '创建简历' : '保存修改' }}
          </button>
        </div>

        <details v-if="parsedText" class="parsed-box">
          <summary>查看 PDF 解析原文</summary>
          <pre class="parsed-text">{{ parsedText }}</pre>
        </details>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuth } from '../stores/auth'

type ResumeForm = {
  title: string
  name: string
  phone: string
  email: string
  city: string
  intention: string
  education: string
  school: string
  major: string
  graduation_year: string
  experience_years: number
  skills: string
  summary: string
  work_experience: string
  project_experience: string
  education_experience: string
  is_default: boolean
}

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const user = auth.user

const eduOptions = ['高中', '大专', '本科', '硕士', '博士']

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

const form = reactive<ResumeForm>({
  title: '',
  name: '',
  phone: '',
  email: '',
  city: '',
  intention: '',
  education: '',
  school: '',
  major: '',
  graduation_year: '',
  experience_years: 0,
  skills: '',
  summary: '',
  work_experience: '',
  project_experience: '',
  education_experience: '',
  is_default: false,
})

function resetForm() {
  form.title = ''
  form.name = user.value?.name || ''
  form.phone = ''
  form.email = user.value?.email || ''
  form.city = ''
  form.intention = ''
  form.education = ''
  form.school = ''
  form.major = ''
  form.graduation_year = ''
  form.experience_years = 0
  form.skills = ''
  form.summary = ''
  form.work_experience = ''
  form.project_experience = ''
  form.education_experience = ''
  form.is_default = true
  parseNote.value = ''
  parsedText.value = ''
  hasFile.value = false
  fileName.value = ''
}

function fillForm(r: Awaited<ReturnType<typeof api.myResume>>) {
  form.title = r.title || ''
  form.name = r.name || ''
  form.phone = r.phone || ''
  form.email = r.email || ''
  form.city = r.city || ''
  form.intention = r.intention || ''
  form.education = r.education || ''
  form.school = r.school || ''
  form.major = r.major || ''
  form.graduation_year = r.graduation_year || ''
  form.experience_years = r.experience_years || 0
  form.skills = r.skills || ''
  form.summary = r.summary || ''
  form.work_experience = r.work_experience || ''
  form.project_experience = r.project_experience || ''
  form.education_experience = r.education_experience || ''
  form.is_default = Boolean(r.is_default)
  parseNote.value = r.parse_note || ''
  parsedText.value = r.parsed_text || ''
  hasFile.value = Boolean(r.has_file)
  fileName.value = r.file_name || ''
}

async function load() {
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    await auth.ensure()
    if (isNew.value) {
      resetForm()
      return
    }
    const r = await api.myResume(Number(route.params.id))
    fillForm(r)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function validate(): string {
  if (!form.name.trim()) return '请填写姓名'
  if (!form.phone.trim() && !form.email.trim()) return '请至少填写手机号或邮箱'
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
  try {
    const payload = {
      title: form.title.trim(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      intention: form.intention.trim(),
      education: form.education.trim(),
      school: form.school.trim(),
      major: form.major.trim(),
      graduation_year: form.graduation_year.trim(),
      experience_years: form.experience_years,
      skills: form.skills.trim(),
      summary: form.summary.trim(),
      work_experience: form.work_experience.trim(),
      project_experience: form.project_experience.trim(),
      education_experience: form.education_experience.trim(),
      is_default: form.is_default,
    }
    if (isNew.value) {
      const r = await api.createResume(payload)
      if (redirectTo.value) {
        // 从岗位详情页跳转来创建简历：保存后直接回去继续报名
        await router.replace(redirectTo.value)
        return
      }
      notice.value = '简历已创建'
      await router.replace(`/me/resumes/${r.id}`)
      await load()
    } else {
      await api.updateResume(Number(route.params.id), payload)
      notice.value = '已保存'
      const def = form.is_default
      if (def) form.is_default = true
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

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
watch(
  () => route.params.id,
  () => load(),
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
  margin-bottom: 22px;
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
  gap: 8px;
}
.editor-head {
  margin-bottom: 24px;
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
.page-main :deep(.form-section) {
  max-width: 880px;
}
.upload-section,
.file-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  max-width: 880px;
  background: transparent;
  border: none;
}
.upload-copy .form-section-title {
  margin-bottom: 6px;
}
.upload-hint {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.6;
}
.upload-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.upload-or {
  color: var(--ink-faint);
  font-size: 12px;
}
.hidden-input {
  display: none;
}
.file-section {
  background: transparent;
  border: none;
}
.file-section .form-section-title {
  margin-bottom: 4px;
}
.file-name {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}
.editor-loading {
  padding: 60px 0;
  text-align: center;
  color: var(--ink-soft);
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
.editor-bottom {
  max-width: 880px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 8px 0 16px;
}
.parsed-box {
  max-width: 880px;
  margin-top: 10px;
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
@media (max-width: 640px) {
  .upload-section,
  .file-section {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
