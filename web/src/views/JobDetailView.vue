<template>
  <div class="page">
    <div class="bg-scene" aria-hidden="true">
      <span class="orb orb-a" />
      <span class="orb orb-b" />
      <div class="grid-lines" />
    </div>

    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink class="brand" to="/">
          <span class="logo-mark"><i /></span>
          <span class="brand-mark">软工集市</span>
          <span class="brand-suffix">· 招聘</span>
        </RouterLink>
      </div>
    </header>

    <main class="container">
      <div v-if="loading" class="empty"><span class="spinner" />加载中…</div>
      <p v-if="error" class="error">{{ error }}</p>

      <template v-if="job">
        <RouterLink class="back" to="/">← 返回职位列表</RouterLink>

        <section class="card panel job-header reveal in">
          <div class="job-badge-glow" />
          <div class="job-head">
            <div>
              <h1 class="job-title">{{ job.title }}</h1>
              <div class="job-meta">
                <span class="badge" :class="badgeClass(job.type)">{{ typeLabel(job.type) }}</span>
                <span>{{ job.department }}</span>
                <span class="dot" />
                <span>{{ job.location || '远程' }}</span>
                <span v-if="job.headcount" class="dot" />
                <span v-if="job.headcount">招 {{ job.headcount }} 人</span>
              </div>
            </div>
          </div>
        </section>

        <div class="layout">
          <section class="card panel desc reveal in">
            <h3>职位描述</h3>
            <p class="desc-text">{{ job.summary }}</p>
            <pre class="desc-block">{{ job.description }}</pre>
          </section>

          <aside class="card panel apply reveal in">
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
function badgeClass(t: string) {
  const map: Record<string, string> = { fulltime: 'badge', intern: 'badge-green', parttime: 'badge-amber' }
  return map[t] || 'badge'
}

onMounted(load)
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
}
.bg-scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.grid-lines {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(circle at 50% 20%, #000 0%, transparent 70%);
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.55;
}
.orb-a {
  width: 400px;
  height: 400px;
  background: #5b8cff;
  top: -60px;
  left: -60px;
  animation: pulseGlow 10s ease-in-out infinite;
}
.orb-b {
  width: 360px;
  height: 360px;
  background: #9b5bff;
  top: 20%;
  right: -60px;
  animation: pulseGlow 12s ease-in-out infinite;
  animation-delay: 2s;
}

.topbar {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid var(--line);
  background: rgba(10, 15, 36, 0.5);
  backdrop-filter: blur(12px);
}
.topbar-inner {
  max-width: 1020px;
  margin: 0 auto;
  padding: 14px 24px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}
.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--grad);
  display: grid;
  place-items: center;
}
.logo-mark i {
  width: 9px;
  height: 9px;
  background: #06101f;
  border-radius: 3px;
  transform: rotate(45deg);
}
.brand-mark {
  font-size: 18px;
}
.brand-suffix {
  color: var(--ink-soft);
  font-weight: 500;
}

.container {
  position: relative;
  z-index: 1;
  max-width: 1020px;
  margin: 0 auto;
  padding: 30px 24px 60px;
}
.back {
  color: var(--ink-soft);
  font-size: 13px;
  display: inline-block;
  margin-bottom: 18px;
  transition: color 0.2s ease, transform 0.2s ease;
}
.back:hover {
  color: var(--accent);
  transform: translateX(-2px);
}
.job-header {
  position: relative;
  margin-bottom: 22px;
  overflow: hidden;
}
.job-badge-glow {
  position: absolute;
  top: -60px;
  right: -30px;
  width: 240px;
  height: 240px;
  background: var(--grad-soft);
  border-radius: 50%;
  filter: blur(40px);
}
.job-head {
  position: relative;
}
.job-title {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.job-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--ink-soft);
  font-size: 14px;
  flex-wrap: wrap;
}
.job-meta .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ink-faint);
}

.layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 22px;
  align-items: start;
}
.desc h3 {
  margin-bottom: 12px;
  font-size: 18px;
}
.desc-text {
  font-size: 15px;
  line-height: 1.8;
}
.desc-block {
  white-space: pre-wrap;
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.85;
  color: var(--ink-soft);
  background: rgba(255, 255, 255, 0.03);
  padding: 18px;
  border-radius: 14px;
  margin: 16px 0 0;
  border: 1px solid var(--line);
}
.apply form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.apply .btn {
  margin-top: 6px;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  vertical-align: middle;
  animation: spinSlow 0.8s linear infinite;
}

@media (max-width: 720px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .job-title {
    font-size: 26px;
  }
}
</style>
