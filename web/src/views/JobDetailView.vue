<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink class="brand" to="/">
          <span class="brand-mark">软工集市</span>
          <span class="brand-suffix">· 招聘</span>
        </RouterLink>
      </div>
    </header>

    <main class="container">
      <div v-if="loading" class="empty">加载中…</div>
      <p v-if="error" class="error">{{ error }}</p>

      <template v-if="job">
        <RouterLink class="back" to="/">← 返回职位列表</RouterLink>
        <div class="card panel job-header">
          <div class="job-head">
            <div>
              <h1 class="job-title">{{ job.title }}</h1>
              <div class="job-meta">
                <span class="badge" :class="typeClass(job.type)">{{ typeLabel(job.type) }}</span>
                <span>{{ job.department }}</span>
                <span>·</span>
                <span>{{ job.location || '远程' }}</span>
                <span v-if="job.headcount">· 招 {{ job.headcount }} 人</span>
              </div>
            </div>
          </div>
        </div>

        <div class="layout">
          <section class="card panel desc">
            <h3>职位描述</h3>
            <p class="desc-text">{{ job.summary }}</p>
            <pre class="desc-block">{{ job.description }}</pre>
          </section>

          <aside class="card panel apply">
            <h3>投递此职位</h3>
            <form @submit.prevent="submit">
              <div class="field">
                <label>姓名</label>
                <input v-model="form.name" maxlength="50" placeholder="选填" />
              </div>
              <div class="field">
                <label>联系方式（邮箱或手机）*</label>
                <input v-model="form.contact" required placeholder="用于我们联系你" />
              </div>
              <div class="field">
                <label>简历链接</label>
                <input v-model="form.resume_url" placeholder="https://… （选填，GitHub/网盘等）" />
              </div>
              <div class="field">
                <label>自我介绍</label>
                <textarea v-model="form.note" rows="4" placeholder="简单介绍自己（选填）" />
              </div>
              <p v-if="formError" class="error">{{ formError }}</p>
              <p v-if="success" class="success">{{ success }}</p>
              <button class="btn btn-primary" type="submit" :disabled="busy || !!success">
                {{ busy ? '提交中…' : '提交投递' }}
              </button>
            </form>
            <p class="hint">提交即表示同意我们联系你；投递信息仅用于本次招聘。</p>
          </aside>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Job } from '../api'

const route = useRoute()
const slug = route.params.slug as string

const job = ref<Job | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const success = ref('')
const formError = ref('')

const form = ref({ name: '', contact: '', resume_url: '', note: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    job.value = await api.job(slug)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function submit() {
  busy.value = true
  formError.value = ''
  success.value = ''
  try {
    await api.apply(slug, {
      name: form.value.name.trim(),
      contact: form.value.contact.trim(),
      resume_url: form.value.resume_url.trim(),
      note: form.value.note.trim(),
    })
    success.value = '投递成功！我们会尽快与你联系。'
    form.value = { name: '', contact: '', resume_url: '', note: '' }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '提交失败'
  } finally {
    busy.value = false
  }
}

function typeLabel(t: string) {
  const map: Record<string, string> = { fulltime: '全职', intern: '实习', parttime: '兼职' }
  return map[t] || t
}
function typeClass(t: string) {
  const map: Record<string, string> = { fulltime: 'badge', intern: 'badge-green', parttime: 'badge-amber' }
  return map[t] || 'badge'
}

onMounted(load)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.topbar {
  background: #fff;
  border-bottom: 1px solid var(--line);
}
.topbar-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 14px 24px;
}
.brand {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-weight: 700;
}
.brand-mark {
  font-size: 18px;
}
.brand-suffix {
  color: var(--ink-soft);
  font-weight: 500;
}
.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}
.back {
  color: var(--ink-soft);
  font-size: 13px;
  display: inline-block;
  margin-bottom: 16px;
}
.back:hover {
  color: var(--accent);
}
.job-header {
  margin-bottom: 20px;
}
.job-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.job-title {
  margin: 0 0 10px;
  font-size: 26px;
}
.job-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--ink-soft);
  font-size: 14px;
  flex-wrap: wrap;
}
.layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  align-items: start;
}
.desc h3 {
  margin-bottom: 12px;
}
.desc-text {
  font-size: 15px;
  line-height: 1.7;
}
.desc-block {
  white-space: pre-wrap;
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.8;
  color: var(--ink);
  background: var(--bg);
  padding: 14px;
  border-radius: 10px;
  margin: 16px 0 0;
}
.apply form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.apply .btn {
  margin-top: 4px;
}
@media (max-width: 720px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
