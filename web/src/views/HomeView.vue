<template>
  <div class="page">
    <header class="hero">
      <div class="hero-inner">
        <div class="brand-row">
          <span class="brand-mark">软工集市</span>
          <a class="brand-link" href="https://ssemarket.cn" target="_blank">ssemarket.cn ↗</a>
        </div>
        <h1 class="hero-title">加入软工集市</h1>
        <p class="hero-sub">
          我们正在寻找热爱技术与创造的同学。<br />
          投递后我们将尽快联系，合适的候选人会进入团队面试。
        </p>
      </div>
    </header>

    <main class="container">
      <div class="toolbar">
        <input v-model="q" class="search" placeholder="搜索职位 / 部门…" @input="filterJobs" />
        <span class="muted small">共 {{ filtered.length }} 个职位</span>
      </div>

      <div v-if="loading" class="empty">加载中…</div>
      <p v-if="error" class="error">{{ error }}</p>

      <div v-else-if="filtered.length === 0" class="empty">暂无开放职位</div>

      <div v-else class="job-grid">
        <div v-for="job in filtered" :key="job.id" class="card job-card">
          <div class="job-head">
            <h3>{{ job.title }}</h3>
            <span class="badge" :class="typeClass(job.type)">{{ typeLabel(job.type) }}</span>
          </div>
          <div class="job-meta">
            <span>{{ job.department }}</span>
            <span>·</span>
            <span>{{ job.location || '远程' }}</span>
            <span v-if="job.headcount"> · 招 {{ job.headcount }} 人</span>
          </div>
          <p class="job-summary">{{ job.summary }}</p>
          <RouterLink class="btn btn-ghost btn-sm" :to="`/jobs/${job.slug}`">查看详情并投递</RouterLink>
        </div>
      </div>

      <p class="foot muted">
        招聘由软工集市负责，最终录用需经团队审核。有问题请联系
        <a class="mailto" :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>。
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, type Job } from '../api'

const jobs = ref<Job[]>([])
const q = ref('')
const loading = ref(true)
const error = ref('')
const contactEmail = ref('hr@ssemarket.cn')

const filtered = computed(() => jobs.value)

async function load() {
  loading.value = true
  error.value = ''
  try {
    jobs.value = (await api.jobs()) || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function filterJobs() {
  const term = q.value.trim().toLowerCase()
  if (!term) return
  // 前端本地过滤（职位量小，够用）
  jobs.value = jobs.value.filter(
    (j) =>
      j.title.toLowerCase().includes(term) ||
      j.department.toLowerCase().includes(term) ||
      j.summary.toLowerCase().includes(term),
  )
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
.hero {
  background: linear-gradient(135deg, #1f2a44 0%, #2b3a63 55%, #3370ff 130%);
  color: #fff;
  padding: 56px 24px 48px;
}
.hero-inner {
  max-width: 960px;
  margin: 0 auto;
}
.brand-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}
.brand-mark {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.02em;
}
.brand-link {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  transition: color 0.15s ease;
}
.brand-link:hover {
  color: #fff;
}
.hero-title {
  font-size: 40px;
  font-weight: 800;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
}
.hero-sub {
  font-size: 16px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
  margin: 0;
}
.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 48px;
}
.toolbar {
  margin-bottom: 20px;
}
.job-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.job-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.job-card:hover {
  box-shadow: 0 4px 16px rgba(31, 35, 41, 0.08);
  transform: translateY(-2px);
}
.job-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.job-head h3 {
  margin: 0;
  font-size: 18px;
}
.job-meta {
  color: var(--ink-soft);
  font-size: 13px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.job-summary {
  color: var(--ink);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  flex: 1;
}
.job-card .btn {
  align-self: flex-start;
}
.foot {
  margin-top: 40px;
  text-align: center;
}
.mailto {
  color: var(--accent);
}
@media (max-width: 720px) {
  .job-grid {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: 30px;
  }
}
</style>
