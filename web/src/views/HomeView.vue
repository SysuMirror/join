<template>
  <div class="page">
    <header class="hero">
      <!-- 极淡网格，仅存在于 Hero 区 -->
      <div class="grid" aria-hidden="true" />

      <nav class="nav nav-enter">
        <div class="nav-brand">
          <img class="logo-img" src="/logo.png" alt="logo" />
          <span class="brand-name">{{ site?.brand || '软工集市' }}</span>
        </div>
        <div class="nav-links">
          <a class="nav-link" href="https://ssemarket.cn" target="_blank">集市主页 ↗</a>
          <RouterLink class="nav-link" to="/login">管理入口</RouterLink>
        </div>
      </nav>

      <div class="hero-inner">
        <!-- 左：文案（逐级渐显） -->
        <div class="hero-copy">
          <div class="hero-eyebrow enter" style="--d: 0.1s">
            <span class="eyebrow-line" />
            <span>{{ site?.tagline || '让每个热爱技术的人，都能找到属于他的舞台' }}</span>
          </div>
          <h1 class="hero-title enter" style="--d: 0.22s">
            {{ heroTitleMain }}<span class="hero-title-accent">{{ heroTitleRest }}</span>
          </h1>
          <p class="hero-sub enter" style="--d: 0.36s">{{ heroLines.join(' ') }}</p>
          <div class="hero-actions enter" style="--d: 0.5s">
            <a href="#jobs" class="btn btn-primary btn-lg">查看职位 <span class="arrow">→</span></a>
            <a href="https://ssemarket.cn" target="_blank" class="btn btn-ghost btn-lg">了解我们</a>
          </div>
        </div>

        <!-- 右：线条球（Canvas 内部实现从无到有的生长动画） -->
        <div class="hero-art" aria-hidden="true">
          <LineOrb :size="orbSize" :lines="72" :alpha="0.15" :speed="0.1" />
        </div>
      </div>
    </header>

    <!-- 职位区：独立白色色带，与 Hero 灰底形成清晰分界 -->
    <main id="jobs" class="band">
      <div class="container">
        <section v-if="site?.announcement" v-reveal class="announce" style="transition-delay: 80ms">
          <span class="announce-dot" />
          <span class="announce-text">{{ site.announcement }}</span>
        </section>

        <section v-reveal class="section-head" style="transition-delay: 160ms">
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
            v-reveal
            :to="`/jobs/${job.slug}`"
            class="job-row"
            :style="{ transitionDelay: `${Math.min(i * 70, 350)}ms` }"
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

        <footer v-reveal class="foot" style="transition-delay: 240ms">
          <div class="foot-line" />
          <div class="foot-row">
            <span class="foot-brand">{{ site?.brand || '软工集市' }} · 招聘</span>
            <a class="foot-mail" :href="`mailto:${site?.contactEmail || 'hr@ssemarket.cn'}`">
              {{ site?.contactEmail || 'hr@ssemarket.cn' }}
            </a>
            <span class="foot-copy">© {{ year }}</span>
          </div>
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api, type Job, type SiteConfig } from '../api'
import LineOrb from '../components/LineOrb.vue'

const jobs = ref<Job[]>([])
const site = ref<SiteConfig | null>(null)
const q = ref('')
const loading = ref(true)
const error = ref('')
const year = new Date().getFullYear()
const orbSize = ref(440)

const filtered = computed(() => jobs.value)

/**
 * v-reveal：滚动入场指令。
 * 在每个元素挂载时单独 observe，修复「异步渲染的职位行永远透明」的问题
 * （旧实现只在页面挂载时 observe 一次，后加载的元素观察不到）。
 */
const revealObserver =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('in')
              revealObserver?.unobserve(e.target)
            }
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
      )
    : null

const vReveal = {
  mounted(el: HTMLElement) {
    if (!revealObserver) {
      el.classList.add('reveal', 'in')
      return
    }
    el.classList.add('reveal')
    revealObserver.observe(el)
  },
  unmounted(el: HTMLElement) {
    revealObserver?.unobserve(el)
  },
}

/** 主标题拆分：最后一个词用品牌蓝强调 */
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

function syncOrbSize() {
  orbSize.value = window.innerWidth <= 920 ? 280 : window.innerWidth <= 1200 ? 360 : 440
}

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

onMounted(() => {
  load()
  syncOrbSize()
  window.addEventListener('resize', syncOrbSize)
})
onUnmounted(() => {
  window.removeEventListener('resize', syncOrbSize)
  revealObserver?.disconnect()
})
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  background: var(--bg);
}

/* ===== Hero：灰底 + 极淡网格，占满首屏，进入时无底部分割线 ===== */
.hero {
  position: relative;
  overflow: hidden;
  background: var(--bg);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(31, 35, 41, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 35, 41, 0.06) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 95% 78% at 50% 0%, #000 18%, transparent 80%);
}

/* ===== 入场动画 ===== */
.nav-enter {
  animation: navIn 0.8s var(--ease) both;
}
@keyframes navIn {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.enter {
  opacity: 0;
  animation: heroIn 0.9s var(--ease) forwards;
  animation-delay: var(--d, 0s);
}
@keyframes heroIn {
  from {
    opacity: 0;
    transform: translateY(26px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}

/* ===== 导航 ===== */
.nav {
  position: relative;
  z-index: 1;
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
.logo-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  display: block;
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

/* ===== Hero 两栏 ===== */
.hero-inner {
  position: relative;
  z-index: 1;
  flex: 1;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 24px 64px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: center;
  gap: 40px;
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
  animation: lineSlide 3.2s var(--ease) infinite 1.2s;
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
  font-family: var(--font-display);
  font-size: clamp(40px, 6.2vw, 68px);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: var(--letter-tight);
  color: var(--ink);
  transform: skewX(-4deg);
}
/* 入场动画：标题专属，保留 skew 的同时做位移/模糊渐显 */
.hero-title.enter {
  animation-name: heroTitleIn;
}
@keyframes heroTitleIn {
  from {
    opacity: 0;
    transform: skewX(-4deg) translateY(26px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: skewX(-4deg);
    filter: none;
  }
}
.hero-title-accent {
  color: var(--brand);
}
.hero-sub {
  max-width: 520px;
  margin: 0 0 40px;
  font-size: 16px;
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

.hero-art {
  display: flex;
  justify-content: center;
}
.hero-art :deep(canvas) {
  animation: orbFade 1.2s var(--ease) both 0.15s;
}
@keyframes orbFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ===== 职位区：白色色带；顶部快速对齐 Hero 灰底→白过渡 ===== */
.band {
  position: relative;
  z-index: 1;
  background: linear-gradient(180deg, var(--bg) 0%, var(--bg-elevated) 64px);
}
.container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 64px 24px 40px;
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

/* 行式职位：细线分隔 + 滚动渐显 + hover 反馈 */
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
  background: #fafbfc;
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

@media (max-width: 920px) {
  .hero-inner {
    grid-template-columns: 1fr;
    padding: 48px 24px 64px;
    gap: 24px;
  }
  .hero-art {
    order: -1;
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
