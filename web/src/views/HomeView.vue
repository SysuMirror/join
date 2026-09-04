<template>
  <div class="page">
    <!-- 全局背景粒子/光斑 -->
    <div class="bg-scene" aria-hidden="true">
      <span class="orb orb-a" />
      <span class="orb orb-b" />
      <span class="orb orb-c" />
      <div class="grid-lines" />
      <div class="noise" />
    </div>

    <!-- 公告栏 -->
    <div v-if="site?.announcement" class="announce">
      <div class="announce-inner">
        <span class="announce-pill">NEW</span>
        <span class="announce-text">{{ site.announcement }}</span>
      </div>
    </div>

    <header class="hero">
      <nav class="nav">
        <div class="nav-brand">
          <span class="logo-mark"><i /></span>
          <span class="brand-name">{{ site?.brand || '软工集市' }}</span>
        </div>
        <div class="nav-links">
          <a class="nav-link" href="https://ssemarket.cn" target="_blank">集市主页</a>
          <RouterLink class="nav-link" to="/login">管理入口</RouterLink>
        </div>
      </nav>

      <div class="hero-inner reveal">
        <div class="hero-eyebrow">WE ARE HIRING · 一起创造</div>
        <h1 class="hero-title">
          <span class="grad-text">{{ site?.heroTitle || '加入软工集市' }}</span>
        </h1>
        <p class="hero-sub">{{ heroLines.join('') }}</p>
        <div class="hero-actions">
          <a href="#jobs" class="btn btn-primary btn-lg">查看职位 <span class="arrow">→</span></a>
          <a href="https://ssemarket.cn" target="_blank" class="btn btn-ghost btn-lg">了解我们</a>
        </div>
        <div class="hero-words">
          <span v-for="w in words" :key="w" class="word">{{ w }}</span>
        </div>
      </div>

      <div class="hero-scroll"><span />SCROLL</div>
    </header>

    <main id="jobs" class="container">
      <section class="section-head reveal">
        <h2 class="section-title">开放职位 <span class="section-count">/ {{ filtered.length }}</span></h2>
        <div class="toolbar">
          <input v-model="q" class="search" placeholder="搜索职位 / 部门…" @input="filterJobs" />
        </div>
      </section>

      <div v-if="loading" class="empty"><span class="spinner" />加载中…</div>
      <p v-if="error" class="error">{{ error }}</p>

      <div v-else-if="filtered.length === 0" class="empty">暂无开放职位</div>

      <div v-else class="job-grid">
        <RouterLink
          v-for="(job, i) in filtered"
          :key="job.id"
          :to="`/jobs/${job.slug}`"
          class="card job-card reveal"
          :class="{ in: true }"
          :style="{ transitionDelay: `${i * 40}ms` }"
        >
          <div class="job-glow" />
          <div class="job-head">
            <h3>{{ job.title }}</h3>
            <span class="badge" :class="badgeClass(job.type)">{{ typeLabel(job.type) }}</span>
          </div>
          <div class="job-meta">
            <svg viewBox="0 0 24 24" class="ico"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>{{ job.department }}</span>
            <span class="dot" />
            <span>{{ job.location || '远程' }}</span>
            <span v-if="job.headcount" class="dot" />
            <span v-if="job.headcount">招 {{ job.headcount }} 人</span>
          </div>
          <p class="job-summary">{{ job.summary }}</p>
          <div class="job-foot">
            <span class="job-cta">投递这个职位 <span class="arrow">→</span></span>
          </div>
        </RouterLink>
      </div>

      <section class="cta reveal">
        <div class="cta-inner">
          <h3>没有合适的职位？</h3>
          <p>把你的简历发给我们，有机会被纳入人才库，未来有合适机会会第一时间联系你。</p>
          <a :href="`mailto:${site?.contactEmail || 'hr@ssemarket.cn'}`" class="btn btn-primary">
            {{ site?.contactEmail || 'hr@ssemarket.cn' }}
          </a>
        </div>
      </section>

      <footer class="foot">
        <span class="foot-brand">{{ site?.brand || '软工集市' }}</span>
        <span class="foot-tag">{{ site?.tagline || '让每个热爱技术的人，都能找到属于他的舞台' }}</span>
        <span class="foot-copy">© {{ year }} Join · {{ site?.contactEmail || 'hr@ssemarket.cn' }}</span>
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

const heroLines = computed(() => (site.value?.heroSubtitle || '').split('\n'))
const words = computed(() =>
  (site.value?.bgWords || '技术 · 创造 · 热爱 · 成长').split('·').map((s) => s.trim()).filter(Boolean),
)

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
    // 重新全量
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
  overflow-x: hidden;
}

/* ===== 背景 ===== */
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
  mask-image: radial-gradient(circle at 50% 30%, #000 0%, transparent 75%);
}
.noise {
  position: absolute;
  inset: -50%;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  animation: floaty 12s ease-in-out infinite;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.6;
}
.orb-a {
  width: 420px;
  height: 420px;
  background: #5b8cff;
  top: -80px;
  left: -60px;
  animation: pulseGlow 9s ease-in-out infinite;
}
.orb-b {
  width: 380px;
  height: 380px;
  background: #9b5bff;
  top: 10%;
  right: -80px;
  animation: pulseGlow 11s ease-in-out infinite;
  animation-delay: 2s;
}
.orb-c {
  width: 320px;
  height: 320px;
  background: #24d8ff;
  bottom: -60px;
  left: 40%;
  animation: pulseGlow 13s ease-in-out infinite;
  animation-delay: 4s;
}

/* ===== 公告 ===== */
.announce {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid var(--line);
  background: rgba(10, 15, 36, 0.5);
  backdrop-filter: blur(10px);
}
.announce-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--ink-soft);
}
.announce-pill {
  background: var(--grad);
  color: #06101f;
  font-weight: 700;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  flex: none;
}
.announce-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== Hero ===== */
.hero {
  position: relative;
  z-index: 1;
  padding: 24px 24px 0;
  background: var(--grad-hero);
  border-bottom: 1px solid var(--line);
}
.nav {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 24px;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--grad);
  display: grid;
  place-items: center;
  box-shadow: 0 4px 20px rgba(91, 140, 255, 0.4);
}
.logo-mark i {
  width: 12px;
  height: 12px;
  background: #06101f;
  border-radius: 4px;
  transform: rotate(45deg);
}
.brand-name {
  font-weight: 800;
  font-size: 19px;
  letter-spacing: 0.02em;
}
.nav-links {
  display: flex;
  gap: 22px;
}
.nav-link {
  color: var(--ink-soft);
  font-size: 14px;
  transition: color 0.2s ease;
  position: relative;
}
.nav-link:hover {
  color: #fff;
}
.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -4px;
  width: 0;
  height: 2px;
  background: var(--grad);
  transition: width 0.25s var(--ease-spring);
}
.nav-link:hover::after {
  width: 100%;
}

.hero-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 120px 0 90px;
}
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-3);
  margin-bottom: 22px;
}
.hero-eyebrow::before {
  content: '';
  width: 26px;
  height: 2px;
  background: var(--grad);
}
.hero-title {
  font-size: clamp(42px, 8vw, 84px);
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: -0.03em;
  margin: 0 0 26px;
  max-width: 900px;
}
.hero-sub {
  font-size: clamp(16px, 2.4vw, 20px);
  line-height: 1.8;
  color: var(--ink-soft);
  margin: 0 0 40px;
  max-width: 620px;
}
.hero-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.btn-lg {
  padding: 14px 28px;
  font-size: 16px;
  border-radius: 14px;
}
.arrow {
  display: inline-block;
  transition: transform 0.25s var(--ease-spring);
}
.btn:hover .arrow {
  transform: translateX(4px);
}
.hero-words {
  display: flex;
  gap: 40px;
  margin-top: 70px;
  flex-wrap: wrap;
  opacity: 0.9;
}
.word {
  font-size: 15px;
  color: var(--ink-faint);
  font-weight: 500;
  letter-spacing: 0.06em;
  animation: floaty 6s ease-in-out infinite;
}
.word:nth-child(2n) {
  animation-delay: 1.2s;
}
.word:nth-child(3n) {
  animation-delay: 2.4s;
}

.hero-scroll {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 0 26px;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.14em;
}
.hero-scroll span {
  width: 1px;
  height: 40px;
  background: linear-gradient(var(--accent), transparent);
  animation: floaty 2s ease-in-out infinite;
}

/* ===== 职位列表 ===== */
.container {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 0 auto;
  padding: 60px 24px 48px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}
.section-title {
  font-size: 32px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
}
.section-count {
  color: var(--ink-faint);
  font-weight: 500;
  font-size: 20px;
}

.job-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.job-card {
  position: relative;
  padding: 26px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  transition: transform 0.35s var(--ease-spring), border-color 0.3s ease, box-shadow 0.35s ease;
}
.job-card:hover {
  transform: translateY(-6px);
  border-color: rgba(91, 140, 255, 0.4);
  box-shadow: var(--shadow-glow);
}
.job-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 140px;
  height: 140px;
  background: var(--grad-soft);
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0;
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.job-card:hover .job-glow {
  opacity: 1;
  transform: scale(1.2);
}
.job-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.job-head h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.job-meta {
  color: var(--ink-soft);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.job-meta .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ink-faint);
}
.ico {
  width: 15px;
  height: 15px;
  color: var(--accent);
}
.job-summary {
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.7;
  margin: 0;
  flex: 1;
}
.job-foot {
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
.job-cta {
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ===== CTA ===== */
.cta {
  margin-top: 56px;
}
.cta-inner {
  background: var(--grad-soft);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 48px;
  text-align: center;
}
.cta-inner h3 {
  font-size: 26px;
  margin: 0 0 10px;
  font-weight: 800;
}
.cta-inner p {
  color: var(--ink-soft);
  margin: 0 0 24px;
  line-height: 1.7;
}

/* ===== 页脚 ===== */
.foot {
  margin-top: 70px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: space-between;
  color: var(--ink-faint);
  font-size: 13px;
}
.foot-brand {
  color: var(--ink);
  font-weight: 700;
}
.foot-copy {
  font-size: 12px;
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
  .hero-inner {
    padding: 70px 0 50px;
  }
  .hero-words {
    gap: 20px;
  }
  .section-title {
    font-size: 26px;
  }
  .cta-inner {
    padding: 32px 22px;
  }
}
</style>
