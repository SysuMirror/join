<template>
  <div class="page">
    <SiteHeader />

    <header class="home-hero">
      <div class="hero-grid" aria-hidden="true" />
      <div class="hero-inner">
        <div class="hero-copy">
          <div class="eyebrow enter" style="--d: 0.05s">
            <span class="eyebrow-line" />
            <span>{{ site?.tagline || '和一群热爱技术的人，一起把想法做出来' }}</span>
          </div>
          <h1 class="hero-title enter" style="--d: 0.16s">
            {{ heroTitleMain }}<span class="hero-title-accent">{{ heroTitleRest }}</span>
          </h1>
          <p class="hero-sub enter" style="--d: 0.28s">{{ heroLines.join(' ') }}</p>
          <div class="hero-actions enter" style="--d: 0.4s">
            <RouterLink class="btn btn-primary btn-lg" to="/jobs">
              查看部门岗位 <span class="arrow">→</span>
            </RouterLink>
            <RouterLink class="btn btn-ghost btn-lg" to="/teams">席位公示</RouterLink>
          </div>
          <p class="hero-note enter" style="--d: 0.52s">
            注册即成为集市开发者 · 部门双选进组 · 多级答辩进入技术部
          </p>
        </div>

        <div class="hero-art" aria-hidden="true">
          <LineOrb :size="orbSize" :lines="72" :alpha="0.15" :speed="0.1" />
        </div>
      </div>

      <div class="hero-stats enter" style="--d: 0.6s">
        <div v-for="s in stats" :key="s.label" class="hero-stat">
          <b>{{ s.value }}</b>
          <span>{{ s.label }}</span>
        </div>
      </div>
    </header>

    <div v-if="site?.announcement" class="announce-band">
      <div class="announce-inner">
        <span class="announce-dot" />
        <span class="announce-text">{{ site.announcement }}</span>
        <RouterLink class="announce-link" to="/jobs">去看看 →</RouterLink>
      </div>
    </div>

    <main class="page-main">
      <p v-if="route.query.denied" class="notice notice-error">你没有后台管理权限。</p>
      <p v-if="error" class="notice notice-error">{{ error }}</p>

      <!-- 为什么加入 -->
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">为什么加入我们</h2>
            <p class="section-sub">我们相信，好的东西来自认真做事的人。</p>
          </div>
        </div>
        <div class="why-grid">
          <article v-for="(w, i) in whyItems" :key="w.title" v-reveal class="why-card" :style="{ transitionDelay: `${i * 80}ms` }">
            <span class="why-index">0{{ i + 1 }}</span>
            <h3>{{ w.title }}</h3>
            <p>{{ w.desc }}</p>
          </article>
        </div>
      </section>

      <!-- 成长路径 -->
      <section id="process" class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">成长路径：从开发者到圆桌</h2>
            <p class="section-sub">全员开发者 → 部门双选进组 → 多级答辩进入技术部。每一步都有明确反馈。</p>
          </div>
          <RouterLink class="btn btn-ghost btn-sm" to="/teams">查看团队与席位 →</RouterLink>
        </div>
        <div class="process-grid">
          <div v-for="(p, i) in processSteps" :key="p.title" v-reveal class="process-step" :style="{ transitionDelay: `${i * 80}ms` }">
            <span class="process-num">{{ i + 1 }}</span>
            <h3>{{ p.title }}</h3>
            <p>{{ p.desc }}</p>
          </div>
        </div>
        <p class="process-note">登录后可在「个人主页」中查看层级、部门、席位与答辩进度。</p>
      </section>

      <!-- 常见问题 -->
      <section v-if="faqPreview.length" class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">常见问题</h2>
            <p class="section-sub">关于报名、简历和交流，你可能想知道的。</p>
          </div>
          <RouterLink class="btn btn-ghost btn-sm" to="/faq">查看全部 →</RouterLink>
        </div>
        <div class="faq-preview">
          <RouterLink
            v-for="f in faqPreview"
            :key="f.id"
            :to="{ path: '/faq', query: { category: f.category } }"
            class="faq-mini"
          >
            <span class="faq-mini-cat">{{ f.category }}</span>
            <span class="faq-mini-q">{{ f.question }}</span>
            <span class="faq-mini-arrow">↗</span>
          </RouterLink>
        </div>
      </section>

      <!-- 底部 CTA -->
      <section class="home-cta" v-reveal>
        <div>
          <h2>找到想一起做的事</h2>
          <p>浏览全部部门岗位，提交你的报名。</p>
        </div>
        <RouterLink class="btn btn-light btn-lg" to="/jobs">
          浏览全部岗位 <span class="arrow">→</span>
        </RouterLink>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Faq, type OrgOverview } from '../api'
import LineOrb from '../components/LineOrb.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useSiteStore } from '../stores/site'

const route = useRoute()
const siteState = useSiteStore().state
const site = computed(() => siteState.site)

const faqs = ref<Faq[]>([])
const org = ref<OrgOverview | null>(null)
const error = ref('')
const orbSize = ref(440)

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

const stats = computed(() => [
  { value: org.value?.stats.developers ?? site.value?.stats?.openJobs ?? '—', label: '活跃开发者' },
  { value: org.value?.stats.departments ?? site.value?.stats?.departments ?? '—', label: '项目部门' },
  { value: org.value?.stats.roundtable ?? '—', label: '圆桌开发者' },
  {
    value: org.value ? `${org.value.stats.seatsOccupied}/${org.value.stats.seats}` : '—',
    label: '技术部席位',
  },
])

const whyItems = [
  {
    title: '一起做点真东西',
    desc: '从想法、设计到做出来，你参与的每一个项目都会真正被大家使用，而不是停留在讨论里。',
  },
  {
    title: '和一群同好一起',
    desc: '扁平、直接的协作方式。遇到问题时，你可以随时找到方向里的同学一起讨论，把精力花在把事情做好上。',
  },
  {
    title: '一起成长',
    desc: '技术分享、作品交流与一对一沟通是日常的一部分。我们更关心你能否在这里长出自己的方法。',
  },
]

const processSteps = [
  {
    title: '注册即成为集市开发者',
    desc: '统一身份登录自动获得开发者身份，无需审批，享有集市公开资源与开发者工坊资格。',
  },
  {
    title: '部门双选',
    desc: '在部门岗位投递意向部门。15 分钟轻沟通，重点看动机与时间投入，不卡技术门槛。',
  },
  {
    title: '双向确认进组',
    desc: '部门发出确认后本人确认，身份转为项目开发者；未匹配成功仍保留集市开发者身份。',
  },
  {
    title: '发起技术部答辩',
    desc: '本部门陈述事实、其他部门负责人交叉评审、学院/外院资源方评估资源分配主张。',
  },
  {
    title: '圆桌与年度复审',
    desc: '通过后按部门保底 + 浮动席位进入圆桌；年度复审不达标自动退出并释放席位。',
  },
]

const faqPreview = computed(() => faqs.value.slice(0, 4))

function syncOrbSize() {
  orbSize.value = window.innerWidth <= 920 ? 260 : window.innerWidth <= 1200 ? 360 : 440
}

async function load() {
  error.value = ''
  try {
    // 强制刷新站点概览（部门岗位数等），避免使用会话内旧缓存
    await useSiteStore().ensure(true)
    const [f, o] = await Promise.all([api.faqs(), api.orgOverview()])
    faqs.value = f || []
    org.value = o
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

onMounted(() => {
  load()
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
  padding-bottom: 40px;
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
.enter {
  opacity: 0;
  animation: heroIn 0.9s var(--ease) forwards;
  animation-delay: var(--d, 0s);
}
@keyframes heroIn {
  from {
    opacity: 0;
    transform: translateY(24px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
.hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 0 auto;
  padding: 72px 24px 24px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: center;
  gap: 40px;
  min-height: 560px;
}
.hero-title {
  margin: 22px 0 20px;
  font-family: var(--font-display);
  font-size: clamp(40px, 6vw, 66px);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: var(--letter-tight);
  color: var(--ink);
  transform: skewX(-4deg);
}
.hero-title.enter {
  animation-name: heroTitleIn;
}
@keyframes heroTitleIn {
  from {
    opacity: 0;
    transform: skewX(-4deg) translateY(24px);
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
  max-width: 540px;
  margin: 0 0 32px;
  font-size: 16px;
  line-height: 1.85;
  color: var(--ink-soft);
}
.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.hero-note {
  margin: 22px 0 0;
  color: var(--ink-faint);
  font-size: 13px;
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

.hero-stats {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.hero-stat {
  border-top: 1px solid var(--line);
  padding-top: 16px;
}
.hero-stat b {
  display: block;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.hero-stat span {
  color: var(--ink-soft);
  font-size: 13px;
}

/* ===== 公告 ===== */
.announce-band {
  background: var(--brand-tint);
  border-top: 1px solid #e6efff;
  border-bottom: 1px solid #e6efff;
}
.announce-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--ink-soft);
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
.announce-text {
  flex: 1;
  min-width: 0;
}
.announce-link {
  color: var(--brand);
  font-weight: 600;
  flex: none;
}

/* ===== 为什么加入 ===== */
.why-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.why-card {
  padding: 18px 0 0;
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.why-index {
  display: inline-block;
  margin-bottom: 18px;
  color: var(--brand);
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.why-card h3 {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.015em;
}
.why-card p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.8;
}

/* ===== 流程 ===== */
#process {
  scroll-margin-top: 88px;
}
.process-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.process-step {
  padding: 26px 16px 28px;
  border-right: 1px solid var(--line);
}
.process-step:last-child {
  border-right: none;
}
.process-num {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-bottom: 16px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.process-step h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
}
.process-step p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
}
.process-note {
  margin: 14px 0 0;
  color: var(--ink-faint);
  font-size: 12px;
}

/* ===== FAQ 预览 ===== */
.faq-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.faq-mini {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  transition: color 0.15s ease;
}
.faq-mini:hover {
  color: var(--brand);
}
.faq-mini-cat {
  flex: none;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--brand);
  font-size: 11px;
}
.faq-mini-q {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.faq-mini-arrow {
  color: var(--ink-faint);
  font-size: 13px;
}

/* ===== CTA ===== */
.home-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 30px 0;
  border: none;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  margin-bottom: 20px;
}
.home-cta h2 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.025em;
}
.home-cta p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
}
.home-cta .btn-light {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--brand);
}
.home-cta .btn-light:hover {
  border-color: var(--brand);
}
.btn-light {
  background: #fff;
  color: var(--ink);
}
.btn-light:hover {
  background: #f0f0f0;
}

@media (max-width: 960px) {
  .hero-inner {
    grid-template-columns: 1fr;
    padding: 48px 24px 20px;
    min-height: 0;
    gap: 16px;
  }
  .hero-art {
    order: -1;
  }
  .hero-stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .why-grid {
    grid-template-columns: 1fr 1fr;
  }
  .process-grid {
    grid-template-columns: 1fr 1fr;
  }
  .process-step {
    border-bottom: 1px solid var(--line);
  }
  .process-step:nth-child(2n) {
    border-right: none;
  }
  .process-step:nth-last-child(-n + 2) {
    border-bottom: none;
  }
}
@media (max-width: 640px) {
  .hero-inner {
    padding: 36px 18px 12px;
  }
  .hero-title {
    font-size: 38px;
  }
  .hero-stats {
    padding: 0 18px;
  }
  .why-grid,
  .faq-preview {
    grid-template-columns: 1fr;
  }
  .process-grid {
    grid-template-columns: 1fr;
  }
  .process-step {
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
  .process-step:last-child {
    border-bottom: none;
  }
  .home-cta {
    padding: 24px 0;
  }
  .home-cta h2 {
    font-size: 23px;
  }
}
</style>
