<template>
  <div class="page">
    <div class="scene" aria-hidden="true">
      <div class="grid" />
    </div>

    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink class="brand" to="/">
          <img class="logo-img" src="/logo.png" alt="logo" />
          <span class="brand-name">软工集市</span>
          <span class="brand-suffix">· 招聘</span>
        </RouterLink>
        <RouterLink class="back" to="/">← 返回职位列表</RouterLink>
      </div>
    </header>

    <main class="container">
      <div v-if="loading" class="empty"><span class="spinner" />加载中…</div>
      <p v-if="error" class="error">{{ error }}</p>

      <template v-if="job">
        <section class="job-header reveal in">
          <div class="job-meta-top">
            <span class="badge" :class="badgeClass(job.type)">{{ typeLabel(job.type) }}</span>
            <span class="meta-item">{{ job.department }}</span>
            <span class="sep" />
            <span class="meta-item">{{ job.location || '远程' }}</span>
            <span v-if="job.headcount" class="sep" />
            <span v-if="job.headcount" class="meta-item">招 {{ job.headcount }} 人</span>
          </div>
          <h1 class="job-title">{{ job.title }}</h1>
          <p class="job-lead">{{ job.summary }}</p>
        </section>

        <div class="layout">
          <section class="desc reveal in">
            <h3 class="block-title">职位描述</h3>
            <pre class="desc-block">{{ job.description }}</pre>
          </section>

          <aside class="apply reveal in">
            <div class="apply-sticky">
              <h3 class="block-title">投递此职位</h3>
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
                  <input v-model="form.resume_url" placeholder="https://… （选填）" />
                </div>
                <div class="field">
                  <label>自我介绍</label>
                  <textarea v-model="form.note" rows="4" placeholder="简单介绍自己（选填）" />
                </div>
                <p v-if="formError" class="error">{{ formError }}</p>
                <p v-if="success" class="success">{{ success }}</p>
                <button class="btn btn-primary btn-block" type="submit" :disabled="busy || !!success">
                  {{ busy ? '提交中…' : '提交投递' }}
                </button>
              </form>
              <p class="hint">提交即表示同意我们联系你；投递信息仅用于本次招聘。</p>
            </div>
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
  background: var(--bg);
}
.scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(31, 35, 41, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 35, 41, 0.028) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(ellipse 90% 50% at 50% 0%, #000 15%, transparent 75%);
}

.topbar {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.topbar-inner {
  max-width: 1000px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.logo-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  display: block;
}
.brand-name {
  font-weight: 700;
  font-size: 15px;
}
.brand-suffix {
  color: var(--ink-faint);
  font-weight: 500;
}
.back {
  color: var(--ink-soft);
  font-size: 13px;
  transition: color 0.15s ease;
}
.back:hover {
  color: var(--brand);
}

.container {
  position: relative;
  z-index: 1;
  max-width: 1000px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}

.job-header {
  margin-bottom: 40px;
}
.job-meta-top {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.meta-item {
  color: var(--ink-soft);
  font-size: 14px;
}
.sep {
  width: 1px;
  height: 12px;
  background: var(--line);
}
.job-title {
  margin: 0 0 14px;
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
}
.job-lead {
  margin: 0;
  max-width: 640px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--ink-soft);
}

.layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 56px;
  align-items: start;
}
.block-title {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.desc-block {
  white-space: pre-wrap;
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.9;
  color: var(--ink);
  margin: 0;
}
.apply-sticky {
  position: sticky;
  top: 24px;
}
.apply form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.btn-block {
  width: 100%;
}

.spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 8px;
  border: 2px solid var(--line);
  border-top-color: var(--brand);
  border-radius: 50%;
  vertical-align: middle;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 720px) {
  .layout {
    grid-template-columns: 1fr;
    gap: 36px;
  }
  .apply-sticky {
    position: static;
  }
}
</style>
