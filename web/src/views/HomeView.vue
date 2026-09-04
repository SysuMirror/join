<template>
  <div class="page">
    <!-- 细线背景：网格 + 流动光线，克制点缀 -->
    <div class="scene" aria-hidden="true">
      <div class="grid" />
      <div class="beam" />
    </div>

    <header class="hero">
      <nav class="nav">
        <div class="nav-brand">
          <span class="logo-mark"><i /></span>
          <span class="brand-name">{{ site?.brand || '软工集市' }}</span>
        </div>
        <div class="nav-links">
          <a class="nav-link" href="https://ssemarket.cn" target="_blank">集市主页 ↗</a>
          <RouterLink class="nav-link" to="/login">管理入口</RouterLink>
        </div>
      </nav>

      <div class="hero-inner reveal in">
        <div class="hero-eyebrow">
          <span class="eyebrow-line" />
          <span>{{ site?.tagline || '让每个热爱技术的人，都能找到属于他的舞台' }}</span>
        </div>
        <h1 class="hero-title">{{ heroTitleMain }}<span class="hero-title-accent">{{ heroTitleRest }}</span></h1>
        <p class="hero-sub">{{ heroLines.join(' ') }}</p>
        <div class="hero-actions">
          <a href="#jobs" class="btn btn-primary btn-lg">查看职位 <span class="arrow">→</span></a>
          <a href="https://ssemarket.cn" target="_blank" class="btn btn-ghost btn-lg">了解我们</a>
        </div>
      </div>

      <div class="hero-strip" aria-hidden="true">
        <div class="strip-track">
          <span v-for="(w, i) in stripWords" :key="i" class="strip-word">{{ w }}</span>
        </div>
      </div>
    </header>

    <main id="jobs" class="container">
      <section v-if="site?.announcement" class="announce reveal">
        <span class="announce-dot" />
        <span class="announce-text">{{ site.announcement }}</span>
      </section>

      <section class="section-head reveal">
        <div>
          <h2 class="section-title">开放职位</h2>
          <p class="section-sub">共 {{ filtered.length }} 个职位正在招聘</p>
        </div>
        <input v-model="q" class="search" placeholder="搜索职位 / 部门…" @input="filterJobs" />
      </section>

      <div v-if="loading" class="empty"><span class="spinner" />加载中…</div>
      <p v-if="error" class="error">{{ error }}</p>

      <div v-else-if="filtered.length === 0" class="empty">暂无开放职位</div>

      <div v-else class="job-list">
        <RouterLink
          v-for="(job, i) in filtered"
          :key="job.id"
          :to="`/jobs/${job.slug}`"
          class="job-row reveal"
          :style="{ transitionDelay: `${Math.min(i * 60, 300)}ms` }"
        >
          <div class="job-main">
            <div class="job-title-row">
              <h3 class="job-title">{{ job.title }}</h3>
              <span class="badge" :class="badgeClass(job.type)">{{ typeLabel(job.type) }}</span>
            </div>
            <p class="job-summary">{{ job.summary }}</p>
            <div class="job-meta">
              <span>{{ job.department }}</span>
              <span class="sep" />
              <span>{{ job.location || '远程' }}</span>
              <span v-if="job.headcount" class="sep" />
              <span v-if="job.headcount">招 {{ job.headcount }} 人</span>
            </div>
          </div>
          <div class="job-side">
            <span class="job-cta">投递 <span class="arrow">→</span></span>
          </div>
        </RouterLink>
      </div>

      <footer class="foot reveal">
        <div class="foot-line" />
        <div class="foot-row">
          <span class="foot-brand">{{ site?.brand || '软工集市' }} · 招聘</span>
          <a class="foot-mail" :href="`mailto:${site?.contactEmail || 'hr@ssemarket.cn'}`">
            {{ site?.contactEmail || 'hr@ssemarket.cn' }}
          </a>
          <span class="foot-copy">© {{ year }}</span>
        </div>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api, type Job, type SiteConfig } from '../api'

const jobs = ref<Job[]>([])
const site = ref<SiteConfig | null>(null)
const q = ref('')
const loading = ref(true)
const error = ref('')
const year = new Date().getFullYear()

const filtered = computed(() => jobs.value)

/** 主标题拆分：最后一个词用品牌蓝强调（如「加入软工集市」→「加入」+「软工集市」） */
const heroTitleMain = computed(() => {
  const t = site.value?.heroTitle || '加入软工集市'
  const parts = t.split(/(\s+)/)
  if (parts.length > 1) return parts.slice(0, -1).join('')
  return t.slice(0, Math.max(t.length - 2, 0))
})
const heroTitleRest = computed(() => {
  const t = site.value?.heroTitle || '加入软工集市'
  const parts = t.split(/(\s+)/)
  if (parts.length > 1) return parts[parts.length - 1]
  return t.slice(Math.max(t.length - 2, 0))
})

const heroLines = computed(() => (site.value?.heroSubtitle || '').split('\n').filter(Boolean))

const stripWords = computed(() => {
  const base = (site.value?.bgWords || '技术 · 创造 · 热爱 · 成长').split('·').map((s) => s.trim()).filter(Boolean)
  return [...base, ...base, ...base]
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [j, s] = await Promise.all([api.jobs(), api.site()])
    jobs.value = j || []
    site.value = s || null
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function filterJobs() {
  const term = q.value.trim().toLowerCase()
  if (!term) {
    load()
    return
  }
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
function badgeClass(t: string) {
  const map: Record<string, string> = { fulltime: 'badge', intern: 'badge-green', parttime: 'badge-amber' }
  return map[t] || 'badge'
}

let observer: IntersectionObserver | null = null
onMounted(() => {
  load()
  observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
    { threshold: 0.1 },
  )
  document.querySelectorAll('.reveal').forEach((n) => observer?.observe(n))
})
onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  background: var(--bg);
}

/* ===== 细线场景：极淡网格 + 一条流动的蓝色光带 ===== */
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
  mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, #000 20%, transparent 80%);
}
.beam {
  position: absolute;
  top: 0;
  left: 10%;
  width: 1px;
  height: 42%;
  background: linear-gradient(180deg, transparent, rgba(51, 112, 255, 0.55), transparent);
  transform: rotate(24deg);
  transform-origin: top center;
  animation: beamDrift 11s ease-in-out infinite;
}
.beam::after {
  content: '';
  position: absolute;
  top: 18%;
  left: 480px;
  width: 1px;
  height: 30%;
  background: linear-gradient(180deg, transparent, rgba(51, 112, 255, 0.3), transparent);
}
@keyframes beamDrift {
  0%,
  100% {
    opacity: 0.5;
    transform: rotate(24deg) translateX(0);
  }
  50% {
    opacity: 1;
    transform: rotate(24deg) translateX(26px);
  }
}

/* ===== 导航 ===== */
.hero {
  position: relative;
  z-index: 1;
}
.nav {
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--brand);
  display: grid;
  place-items: center;
}
.logo-mark i {
  width: 10px;
  height: 10px;
  background: #fff;
  border-radius: 3px;
  transform: rotate(45deg);
}
.brand-name {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
}
.nav-links {
  display: flex;
  gap: 26px;
}
.nav-link {
  color: var(--ink-soft);
  font-size: 14px;
  transition: color 0.15s ease;
}
.nav-link:hover {
  color: var(--brand);
}

/* ===== Hero：大留白 + 大字号排版 ===== */
.hero-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 96px 24px 72px;
}
.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ink-faint);
  font-size: 14px;
  margin-bottom: 26px;
}
.eyebrow-line {
  width: 40px;
  height: 1px;
  background: var(--line);
  position: relative;
  overflow: hidden;
}
.eyebrow-line::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--brand);
  transform: translateX(-100%);
  animation: lineSlide 3.2s var(--ease) infinite;
}
@keyframes lineSlide {
  0% {
    transform: translateX(-100%);
  }
  55%,
  100% {
    transform: translateX(100%);
  }
}
.hero-title {
  margin: 0 0 22px;
  font-size: clamp(44px, 7.4vw, 82px);
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.035em;
  color: var(--ink);
}
.hero-title-accent {
  color: var(--brand);
}
.hero-sub {
  max-width: 560px;
  margin: 0 0 40px;
  font-size: 17px;
  line-height: 1.85;
  color: var(--ink-soft);
}
.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.arrow {
  display: inline-block;
  transition: transform 0.25s var(--ease);
}
.btn:hover .arrow {
  transform: translateX(3px);
}

/* ===== 滚动词条：细字 + 大间距，一条极淡分隔线 ===== */
.hero-strip {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 24px 30px;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
}
.strip-track {
  display: flex;
  gap: 72px;
  width: max-content;
  animation: marquee 26s linear infinite;
}
.strip-word {
  color: var(--ink-faint);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.22em;
  white-space: nowrap;
}
@keyframes marquee {
  to {
    transform: translateX(-33.333%);
  }
}

/* ===== 职位列表：细分隔线的行式布局 ===== */
.container {
  position: relative;
  z-index: 1;
  max-width: 1080px;
  margin: 0 auto;
  padding: 56px 24px 40px;
}
.announce {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--brand-tint);
  color: var(--ink-soft);
  font-size: 14px;
  margin-bottom: 44px;
}
.announce-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
  flex: none;
  animation: pulse 2.4s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(51, 112, 255, 0.25);
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 0 6px rgba(51, 112, 255, 0);
  }
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.section-title {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.025em;
}
.section-sub {
  margin: 6px 0 0;
  color: var(--ink-faint);
  font-size: 14px;
}

/* 行式职位：靠细线分隔，hover 时轻抬升 + 右侧箭头 */
.job-list {
  border-top: 1px solid var(--line);
}
.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 26px 12px;
  border-bottom: 1px solid var(--line);
  transition: background 0.2s ease, padding-left 0.25s var(--ease);
}
.job-row:hover {
  background: #fdfefe;
  padding-left: 20px;
}
.job-main {
  min-width: 0;
}
.job-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.job-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.015em;
}
.job-summary {
  margin: 8px 0 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.7;
  max-width: 640px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.job-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  color: var(--ink-faint);
  font-size: 13px;
}
.sep {
  width: 1px;
  height: 12px;
  background: var(--line);
}
.job-side {
  flex: none;
}
.job-cta {
  color: var(--ink-soft);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.2s ease;
}
.job-row:hover .job-cta {
  color: var(--brand);
}

/* ===== 页脚 ===== */
.foot {
  margin-top: 72px;
}
.foot-line {
  height: 1px;
  background: var(--line);
  margin-bottom: 22px;
}
.foot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--ink-faint);
  font-size: 13px;
  padding-bottom: 24px;
}
.foot-brand {
  color: var(--ink);
  font-weight: 600;
}
.foot-mail {
  color: var(--ink-soft);
  transition: color 0.15s ease;
}
.foot-mail:hover {
  color: var(--brand);
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
  .hero-inner {
    padding: 60px 0 48px;
  }
  .job-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .section-title {
    font-size: 24px;
  }
}
</style>
