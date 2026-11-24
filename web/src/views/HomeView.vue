<template>
  <div class="page">
    <SiteHeader />

    <header class="home-hero">
      <div class="hero-grid" aria-hidden="true" />
      <div class="hero-inner">
        <div class="hero-copy">
          <div class="eyebrow">
            <span class="eyebrow-line" />
            <span>{{ site?.tagline || '软工集市' }}</span>
          </div>
          <h1 class="hero-title">
            {{ heroTitleMain }}<span class="hero-title-accent">{{ heroTitleRest }}</span>
          </h1>
          <p v-if="heroLines.length" class="hero-sub">{{ heroLines.join(' ') }}</p>
          <div class="hero-actions">
            <RouterLink class="btn btn-primary btn-lg" to="/jobs">
              查看岗位 <span class="arrow">→</span>
            </RouterLink>
            <RouterLink class="btn btn-ghost btn-lg" to="/join-team">成为开发者</RouterLink>
          </div>
          <div v-if="site?.stats" class="hero-stats">
            <span><b>{{ site.stats.openJobs }}</b> 个岗位在招</span>
            <span><b>{{ site.stats.departments }}</b> 个项目部门</span>
          </div>
        </div>

        <div class="hero-art" aria-hidden="true">
          <LineOrb :size="orbSize" :lines="72" :alpha="0.15" :speed="0.1" />
        </div>
      </div>
    </header>

    <main class="page-main">
      <p v-if="route.query.denied" class="notice notice-error">你没有后台管理权限。</p>
      <p v-if="error" class="notice notice-error">{{ error }}</p>

      <!-- 团队介绍：只有管理员填写了内容才显示 -->
      <section
        v-if="hasTeam"
        class="team-section"
        :class="{ 'team-section--solo': !highlights.length }"
      >
        <div v-reveal class="team-copy">
          <h2 class="team-title">{{ site?.teamTitle || '关于我们' }}</h2>
          <MarkdownDoc v-if="site?.teamIntro" :content="site.teamIntro" />
        </div>
        <div v-if="highlights.length" class="team-highlights">
          <div
            v-for="(item, i) in highlights"
            :key="item"
            v-reveal
            class="team-highlight"
            :style="{ transitionDelay: `${i * 90}ms` }"
          >
            <span class="highlight-index">0{{ i + 1 }}</span>
            <p>{{ item }}</p>
          </div>
        </div>
      </section>

      <!-- 常见问题 -->
      <section v-if="faqs.length" class="faq-preview">
        <div v-reveal class="section-head">
          <div>
            <h2 class="section-title">常见问题</h2>
            <p class="section-sub">关于报名、简历和交流，你可能想知道的。</p>
          </div>
          <RouterLink class="btn btn-ghost btn-sm" to="/faq">全部问答 →</RouterLink>
        </div>

        <div class="faq-list">
          <RouterLink
            v-for="(f, i) in faqs"
            :key="f.id"
            v-reveal
            :to="{ path: '/faq', query: { category: f.category } }"
            class="faq-item"
            :style="{ transitionDelay: `${i * 60}ms` }"
          >
            <span class="faq-cat">{{ f.category }}</span>
            <span class="faq-q">{{ f.question }}</span>
            <span class="faq-arrow" aria-hidden="true">↗</span>
          </RouterLink>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Faq } from '../api'
import LineOrb from '../components/LineOrb.vue'
import MarkdownDoc from '../components/MarkdownDoc.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useSiteStore } from '../stores/site'

const route = useRoute()
const siteState = useSiteStore().state
const site = computed(() => siteState.site)

const faqs = ref<Faq[]>([])
const error = ref('')
const orbSize = ref(420)

const heroTitleMain = computed(() => {
  const t = site.value?.heroTitle || '加入软工集市'
  const parts = t.split(/(\s+)/)
  if (parts.length > 1) return parts.slice(0, -1).join('')
  // 中文标题把最后两个字（如「集市」）用品牌蓝强调
  return t.slice(0, Math.max(t.length - 2, 0))
})
const heroTitleRest = computed(() => {
  const t = site.value?.heroTitle || '加入软工集市'
  const parts = t.split(/(\s+)/)
  if (parts.length > 1) return parts[parts.length - 1]
  return t.slice(Math.max(t.length - 2, 0))
})
const heroLines = computed(() => (site.value?.heroSubtitle || '').split('\n').filter(Boolean))
const highlights = computed(() =>
  (site.value?.teamHighlights || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6),
)
const hasTeam = computed(() =>
  Boolean((site.value?.teamIntro || '').trim() || highlights.value.length),
)

function syncOrbSize() {
  orbSize.value = window.innerWidth <= 920 ? 240 : window.innerWidth <= 1200 ? 340 : 420
}

async function load() {
  error.value = ''
  try {
    await useSiteStore().ensure(true)
    const rows = await api.faqs()
    faqs.value = (rows || []).slice(0, 6)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

onMounted(() => {
  void load()
  syncOrbSize()
  window.addEventListener('resize', syncOrbSize)
})
onUnmounted(() => {
  window.removeEventListener('resize', syncOrbSize)
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}

/* ===== Hero ===== */
.home-hero {
  position: relative;
  overflow: hidden;
  background: var(--bg);
}
.hero-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(31, 35, 41, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 35, 41, 0.06) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 95% 82% at 50% 0%, #000 18%, transparent 82%);
}
.hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 0 auto;
  padding: 84px 24px 64px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: center;
  gap: 40px;
  min-height: 480px;
}
.hero-title {
  margin: 22px 0 18px;
  font-family: var(--font-display);
  font-size: clamp(40px, 6vw, 64px);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: var(--letter-tight);
  color: var(--ink);
  transform: skewX(-4deg);
}
.hero-title-accent {
  color: var(--brand);
}
.hero-sub {
  max-width: 560px;
  margin: 0 0 28px;
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
.hero-stats {
  display: flex;
  gap: 10px 24px;
  flex-wrap: wrap;
  margin-top: 30px;
  color: var(--ink-faint);
  font-size: 12px;
}
.hero-stats b {
  color: var(--ink);
  font-weight: 700;
  font-size: 15px;
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

/* ===== 团队介绍 ===== */
.team-section {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 0.9fr);
  gap: 64px;
  align-items: start;
  padding: 68px 0;
  border-bottom: 1px solid var(--line);
}
.team-section--solo {
  grid-template-columns: 1fr;
}
.team-copy {
  max-width: 760px;
}
.team-section--solo .team-copy {
  max-width: 780px;
}
.team-title {
  margin: 0 0 18px;
  font-family: var(--font-cn-display);
  font-size: clamp(30px, 3.6vw, 40px);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.28;
  color: var(--ink);
  text-wrap: balance;
}
.team-title::after {
  content: '';
  display: block;
  width: 48px;
  height: 2px;
  margin-top: 20px;
  border-radius: 2px;
  background: var(--brand);
}
.team-copy :deep(.md-doc) {
  font-family: var(--font-cn-body);
  font-size: 15px;
  line-height: 2.05;
  letter-spacing: 0.012em;
  color: var(--ink-soft);
  text-align: justify;
  text-justify: inter-ideograph;
}
.team-copy :deep(.md-doc p) {
  margin-bottom: 20px;
}
.team-copy :deep(.md-doc strong) {
  color: var(--ink);
  font-weight: 650;
}
.team-highlights {
  display: grid;
  gap: 0;
}
.team-highlight {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 18px 0;
  border-top: 1px solid var(--line);
}
.team-highlight:first-child {
  border-top: none;
  padding-top: 0;
}
.highlight-index {
  color: var(--brand);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  flex: none;
}
.team-highlight p {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink);
}

/* ===== 常见问题 ===== */
.faq-preview {
  padding: 56px 0 16px;
}
.faq-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 36px;
}
.faq-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  transition: color 0.15s ease;
}
.faq-item:hover {
  color: var(--brand);
}
.faq-cat {
  flex: none;
  color: var(--brand);
  font-size: 11px;
  width: 64px;
}
.faq-q {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.faq-arrow {
  flex: none;
  color: var(--ink-faint);
  font-size: 13px;
}

@media (max-width: 960px) {
  .hero-inner {
    grid-template-columns: 1fr;
    padding: 56px 24px 40px;
    min-height: 0;
    gap: 16px;
  }
  .hero-art {
    order: -1;
  }
  .team-section {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 40px 0;
  }
  .faq-list {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
@media (max-width: 640px) {
  .hero-inner {
    padding: 40px 18px 28px;
  }
  .hero-title {
    font-size: 38px;
  }
  .team-title {
    font-size: 30px;
    letter-spacing: 0.02em;
  }
  .team-copy :deep(.md-doc) {
    font-size: 14px;
    line-height: 1.95;
    text-align: left;
  }
  .faq-preview {
    padding-top: 40px;
  }
  .faq-cat {
    width: auto;
  }
}
</style>