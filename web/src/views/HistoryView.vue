<template>
  <div class="page history-page">
    <SiteHeader />

    <main class="history-main">
      <header class="history-hero">
        <div class="history-hero-copy">
          <div class="eyebrow history-eyebrow">
            <span class="eyebrow-line" />
            <span>关于软工集市</span>
          </div>
          <h1 class="history-title">{{ settings.title }}</h1>
          <p class="history-title-en">SSE MARKET</p>
          <p class="history-sub">{{ settings.subtitle }}</p>
          <div class="history-meta">
            <span>{{ chapters.length }} 个章节</span>
            <span class="dot-sep" />
            <span>{{ hallOfFame.length }} 位名人堂成员</span>
            <template v-if="updatedAt">
              <span class="dot-sep" />
              <span>更新于 {{ formatDate(updatedAt) }}</span>
            </template>
          </div>
        </div>
      </header>

      <div v-if="loading" class="history-loading">正在加载年鉴…</div>
      <p v-else-if="error" class="notice notice-error history-error">{{ error }}</p>

      <div v-else class="history-layout">
        <aside class="history-toc" aria-label="目录">
          <p class="history-toc-title">目录</p>
          <a
            v-for="(c, i) in chapters"
            :key="c.id"
            :href="`#chapter-${c.id}`"
            class="history-toc-link"
            :class="{ active: activeId === `chapter-${c.id}` }"
            @click.prevent="jump(`chapter-${c.id}`)"
          >
            <span class="history-toc-index">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="history-toc-text">{{ c.title }}</span>
          </a>
          <a
            href="#hall-of-fame"
            class="history-toc-link hall"
            :class="{ active: activeId === 'hall-of-fame' }"
            @click.prevent="jump('hall-of-fame')"
          >
            <span class="history-toc-index">★</span>
            <span class="history-toc-text">{{ settings.hall_title }}</span>
          </a>
          <div class="history-toc-foot">
            <RouterLink to="/jobs">加入集市 →</RouterLink>
          </div>
        </aside>

        <div class="history-doc">
          <article
            v-for="(c, i) in chapters"
            :id="`chapter-${c.id}`"
            :key="c.id"
            class="history-chapter"
            :data-chapter="`chapter-${c.id}`"
          >
            <header class="chapter-head">
              <div class="chapter-topline">
                <span class="chapter-kicker">{{ c.kicker || `第 ${i + 1} 章` }}</span>
                <span v-if="c.era" class="chapter-era">{{ c.era }}</span>
              </div>
              <h2 class="chapter-title">{{ c.title }}</h2>
              <p v-if="c.summary" class="chapter-summary">{{ c.summary }}</p>
            </header>
            <MarkdownDoc :content="c.content" />
          </article>

          <section
            id="hall-of-fame"
            data-chapter="hall-of-fame"
            class="history-chapter hall-section"
          >
            <header class="chapter-head">
              <div class="chapter-topline">
                <span class="chapter-kicker">终章</span>
                <span class="chapter-era">Hall of Fame</span>
              </div>
              <h2 class="chapter-title">{{ settings.hall_title }}</h2>
              <p v-if="settings.hall_intro" class="chapter-summary">{{ settings.hall_intro }}</p>
            </header>

            <div v-if="hallOfFame.length" class="hall-grid">
              <button
                v-for="(m, i) in hallOfFame"
                :key="m.id"
                type="button"
                class="hall-card"
                :aria-label="`查看 ${m.name} 的集市主页、招聘主页展示与联系方式`"
                @click="openMember(m)"
              >
                <span class="hall-card-index">{{ String(i + 1).padStart(2, '0') }}</span>
                <span class="hall-avatar">
                  <img v-if="m.avatar" :src="m.avatar" :alt="m.name" loading="lazy" />
                  <span v-else>{{ initial(m.name) }}</span>
                </span>
                <span class="hall-card-body">
                  <span class="hall-name-row">
                    <strong>{{ m.name }}</strong>
                    <span v-if="m.year" class="hall-year">{{ m.year }}</span>
                  </span>
                  <span v-if="m.title || m.department" class="hall-role">
                    {{ [m.title, m.department].filter(Boolean).join(' · ') }}
                  </span>
                  <span v-if="m.quote" class="hall-quote">“{{ m.quote }}”</span>
                  <span class="hall-card-more">
                    查看主页与联系方式 <span class="hall-arrow">→</span>
                  </span>
                </span>
              </button>
            </div>
            <div v-else class="hall-empty">
              <p class="hall-empty-title">名人堂还没有成员</p>
              <p class="hall-empty-sub">成员资料确认后会展示在这里。</p>
            </div>
          </section>

          <footer class="history-end">
            <span class="history-end-line" />
            <p>年鉴由每一位参与者共同写就。</p>
            <RouterLink class="btn btn-ghost btn-sm" to="/jobs">看看现在的部门岗位 →</RouterLink>
          </footer>
        </div>
      </div>
    </main>

    <SiteFooter />

    <Teleport to="body">
      <div v-if="activeMember" class="fame-backdrop" @click.self="closeMember">
        <article
          class="fame-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="`${activeMember.name} 的名人堂资料`"
        >
          <button class="fame-close" type="button" aria-label="关闭" @click="closeMember">×</button>

          <header class="fame-head">
            <div class="fame-avatar">
              <img v-if="activeMember.avatar" :src="activeMember.avatar" :alt="activeMember.name" />
              <span v-else>{{ initial(activeMember.name) }}</span>
            </div>
            <div class="fame-head-copy">
              <p class="fame-eyebrow">
                名人堂 · 招聘主页<template v-if="activeMember.year"> · {{ activeMember.year }}</template>
              </p>
              <h2 class="fame-name">{{ activeMember.name }}</h2>
              <p class="fame-role">
                {{ [activeMember.title, activeMember.department].filter(Boolean).join(' · ') || '软工集市成员' }}
              </p>
            </div>
          </header>

          <blockquote v-if="activeMember.quote" class="fame-quote">
            “{{ activeMember.quote }}”
          </blockquote>

          <section v-if="activeMember.bio" class="fame-section">
            <h3>自我介绍</h3>
            <MarkdownDoc :content="activeMember.bio" />
          </section>

          <section v-if="activeMember.achievements" class="fame-section">
            <h3>贡献</h3>
            <MarkdownDoc :content="activeMember.achievements" />
          </section>

          <section class="fame-section">
            <h3>主页与联系方式</h3>
            <div v-if="hasContact(activeMember)" class="fame-links">
              <a
                v-if="activeMember.market_url"
                class="fame-link"
                :href="activeMember.market_url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="fame-link-label">集市主页账号</span>
                <span class="fame-link-value">打开主页 ↗</span>
              </a>
              <a
                v-if="activeMember.contact_email"
                class="fame-link"
                :href="`mailto:${activeMember.contact_email}`"
              >
                <span class="fame-link-label">邮箱</span>
                <span class="fame-link-value">{{ activeMember.contact_email }}</span>
              </a>
              <div v-if="activeMember.contact_wechat" class="fame-link">
                <span class="fame-link-label">微信</span>
                <span class="fame-link-value">
                  {{ activeMember.contact_wechat }}
                  <button type="button" class="fame-copy" @click="copyWechat(activeMember.contact_wechat)">
                    {{ copied ? '已复制' : '复制' }}
                  </button>
                </span>
              </div>
              <a
                v-if="activeMember.contact_other && isUrl(activeMember.contact_other)"
                class="fame-link"
                :href="activeMember.contact_other"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="fame-link-label">其他</span>
                <span class="fame-link-value">{{ activeMember.contact_other }} ↗</span>
              </a>
              <div v-else-if="activeMember.contact_other" class="fame-link">
                <span class="fame-link-label">其他</span>
                <span class="fame-link-value">{{ activeMember.contact_other }}</span>
              </div>
            </div>
            <p v-else class="fame-no-contact">该成员暂未公开联系方式。</p>
          </section>
        </article>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { api, type HallOfFameMember, type HistoryDocument } from '../api'
import MarkdownDoc from '../components/MarkdownDoc.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { formatDate } from '../utils/labels'

const doc = ref<HistoryDocument | null>(null)
const loading = ref(true)
const error = ref('')
const activeId = ref('')
const activeMember = ref<HallOfFameMember | null>(null)
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
let scrollRaf = 0

const settings = computed(
  () =>
    doc.value?.settings || {
      title: '软工集市年鉴',
      subtitle: '从第一行代码到今天的开发者平台，记录一群人如何把想法做出来。',
      hall_title: '名人堂',
      hall_intro: '',
    },
)
const chapters = computed(() => doc.value?.chapters || [])
const hallOfFame = computed(() => doc.value?.hallOfFame || [])
const updatedAt = computed(() => doc.value?.updatedAt || '')

function initial(name: string): string {
  return (name || '?').trim().slice(0, 1).toUpperCase()
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function hasContact(m: HallOfFameMember): boolean {
  return Boolean(m.market_url || m.contact_email || m.contact_wechat || m.contact_other)
}

function jump(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  activeId.value = id
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openMember(member: HallOfFameMember) {
  copied.value = false
  activeMember.value = member
}

function closeMember() {
  activeMember.value = null
}

async function copyWechat(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
  } catch {
    const input = document.createElement('textarea')
    input.value = text
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    try {
      document.execCommand('copy')
      copied.value = true
    } finally {
      document.body.removeChild(input)
    }
  }
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1600)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeMember.value) closeMember()
}

function updateActiveFromScroll() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'))
  if (!nodes.length) return
  const marker = window.innerHeight * 0.3
  let current = nodes[0]
  for (const node of nodes) {
    if (node.getBoundingClientRect().top <= marker) current = node
  }
  activeId.value = current.dataset.chapter || ''
}

function onPageScroll() {
  if (scrollRaf) return
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = 0
    updateActiveFromScroll()
  })
}

function setupScrollSpy() {
  window.addEventListener('scroll', onPageScroll, { passive: true })
  window.addEventListener('resize', onPageScroll)
  updateActiveFromScroll()
}

watch(activeMember, (member) => {
  document.body.style.overflow = member ? 'hidden' : ''
})

onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  try {
    doc.value = await api.history()
    if (chapters.value.length) activeId.value = `chapter-${chapters.value[0].id}`
    await nextTick()
    setupScrollSpy()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onPageScroll)
  window.removeEventListener('resize', onPageScroll)
  if (scrollRaf) window.cancelAnimationFrame(scrollRaf)
  if (copiedTimer) clearTimeout(copiedTimer)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.history-page {
  --display-font: 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
    'Source Han Sans SC', sans-serif;
  background: var(--bg);
}

.history-main {
  max-width: 1160px;
  margin: 0 auto;
  padding: 56px 24px 0;
}

/* ===== 头图 ===== */
.history-hero {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  padding-bottom: 44px;
  border-bottom: 1px solid var(--line);
}

.history-eyebrow {
  margin: 0;
  color: var(--brand);
}

.history-eyebrow .eyebrow-line {
  background: var(--brand);
  opacity: 0.35;
}

.history-title {
  width: fit-content;
  max-width: 100%;
  margin: 18px 0 0;
  padding: 0 0.14em 0.1em 0;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC',
    'STSong', 'SimSun', Georgia, serif;
  font-size: clamp(42px, 6vw, 78px);
  font-style: italic;
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.015em;
  color: #1d335f;
  transform: rotate(-0.35deg);
  transform-origin: left bottom;
}

@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .history-title {
    background: linear-gradient(100deg, #131b2f 0%, #1f3a6e 52%, #3370ff 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }
}

.history-sub {
  max-width: 620px;
  margin: 16px 0 0;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', 'Kaiti TC', 'Noto Serif SC', 'Songti SC',
    serif;
  font-size: 18px;
  line-height: 1.95;
  letter-spacing: 0.04em;
  color: #566072;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 28px;
  color: var(--ink-faint);
  font-size: 12px;
}

.history-title-en {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 0;
  font-family: 'Bodoni 72', 'Didot', 'Bodoni MT', 'Playfair Display', 'Times New Roman',
    Georgia, serif;
  font-size: 15px;
  font-style: italic;
  font-weight: 700;
  letter-spacing: 0.26em;
  color: var(--brand);
  transform: rotate(-0.35deg);
  transform-origin: left center;
}

.history-title-en::before {
  content: '';
  width: 28px;
  height: 1px;
  background: rgba(51, 112, 255, 0.4);
}

/* ===== 两栏：目录 + 长文档 ===== */
.history-layout {
  display: grid;
  grid-template-columns: 196px minmax(0, 760px);
  justify-content: center;
  gap: 72px;
  padding-top: 48px;
}

.history-toc {
  position: sticky;
  top: 104px;
  align-self: start;
  max-height: calc(100vh - 132px);
  overflow-y: auto;
}

.history-toc-title {
  margin: 0 0 14px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.history-toc-link {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 0;
  color: var(--ink-faint);
  font-size: 13px;
  line-height: 1.5;
  transition: color 0.15s ease, transform 0.2s var(--ease);
}

.history-toc-link:hover {
  color: var(--ink);
  transform: translateX(2px);
}

.history-toc-link.active {
  color: var(--ink);
  font-weight: 600;
}

.history-toc-index {
  flex: none;
  font-family: var(--mono);
  font-size: 10px;
  opacity: 0.65;
}

.history-toc-link.hall {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.history-toc-foot {
  margin-top: 30px;
  font-size: 12px;
}

.history-toc-foot a {
  color: var(--ink-soft);
}

.history-toc-foot a:hover {
  color: var(--ink);
}

/* ===== 章节 ===== */
.history-doc {
  min-width: 0;
}

.history-chapter {
  scroll-margin-top: 104px;
  padding-bottom: 64px;
  margin-bottom: 64px;
  border-bottom: 1px solid var(--line);
}

.chapter-topline {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.chapter-kicker {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brand);
}

.chapter-era {
  padding-left: 12px;
  border-left: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 11px;
}

.chapter-title {
  position: relative;
  margin: 0;
  padding-bottom: 18px;
  font-family: var(--display-font);
  font-size: clamp(30px, 4vw, 42px);
  line-height: 1.18;
  letter-spacing: -0.035em;
  font-weight: 800;
}

.chapter-title::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 34px;
  height: 2px;
  background: linear-gradient(90deg, var(--brand), rgba(51, 112, 255, 0));
}

.chapter-summary {
  max-width: 640px;
  margin: 18px 0 30px;
  color: var(--ink-soft);
  font-size: 16px;
  line-height: 1.75;
}

/* ===== 名人堂 ===== */
.hall-section {
  border-bottom: none;
}

.hall-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 36px;
  border-top: 1px solid var(--line);
}

.hall-card {
  position: relative;
  display: flex;
  gap: 16px;
  width: 100%;
  padding: 24px 4px 24px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  transition: padding-left 0.25s var(--ease);
}

.hall-card:hover {
  padding-left: 8px;
}

.hall-card-index {
  position: absolute;
  top: 24px;
  right: 0;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--ink-faint);
}

.hall-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  border: 1px solid var(--line);
  border-radius: 50%;
  overflow: hidden;
  background: transparent;
  color: var(--ink-soft);
  font-size: 17px;
  font-weight: 700;
}

.hall-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hall-card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding-right: 24px;
}

.hall-name-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.hall-name-row strong {
  font-family: var(--display-font);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.hall-year {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--ink-faint);
}

.hall-role {
  color: var(--ink-faint);
  font-size: 12px;
}

.hall-quote {
  display: -webkit-box;
  margin-top: 4px;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.hall-card-more {
  margin-top: 10px;
  color: var(--ink-faint);
  font-size: 12px;
  transition: color 0.15s ease;
}

.hall-card:hover .hall-card-more {
  color: var(--ink);
}

.hall-arrow {
  display: inline-block;
  transition: transform 0.2s var(--ease);
}

.hall-card:hover .hall-arrow {
  transform: translateX(3px);
}

.hall-empty {
  padding: 44px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.hall-empty-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
}

.hall-empty-sub {
  margin: 0;
  color: var(--ink-faint);
  font-size: 13px;
}

/* ===== 结尾 ===== */
.history-end {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 12px 0 76px;
}

.history-end-line {
  width: 40px;
  height: 1px;
  background: var(--line);
}

.history-end p {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.02em;
}

.history-loading {
  padding: 90px 0;
  color: var(--ink-faint);
  font-size: 13px;
  text-align: center;
}

.history-error {
  margin-top: 28px;
}

/* ===== 名人堂详情弹层 ===== */
.fame-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.46);
  backdrop-filter: blur(3px);
  animation: fameFade 0.2s ease;
}

.fame-panel {
  position: relative;
  width: min(680px, 100%);
  max-height: 88vh;
  overflow: auto;
  padding: 36px 40px 40px;
  border-radius: 16px;
  background: #fff;
  animation: fameIn 0.3s var(--ease);
}

.fame-close {
  position: absolute;
  top: 16px;
  right: 18px;
  padding: 4px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-faint);
  font-size: 24px;
  line-height: 1;
}

.fame-close:hover {
  color: var(--ink);
}

.fame-head {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-right: 30px;
}

.fame-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 68px;
  height: 68px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--ink-soft);
  font-size: 24px;
  font-weight: 700;
}

.fame-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fame-eyebrow {
  margin: 0 0 6px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.fame-name {
  margin: 0;
  font-family: var(--display-font);
  font-size: 29px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.fame-role {
  margin: 6px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
}

.fame-quote {
  margin: 26px 0 6px;
  padding: 2px 0 2px 18px;
  border-left: 2px solid var(--ink);
  color: var(--ink);
  font-size: 16px;
  line-height: 1.8;
}

.fame-section {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
}

.fame-section h3 {
  margin: 0 0 14px;
  color: var(--ink-faint);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fame-links {
  display: flex;
  flex-direction: column;
}

.fame-link {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line-soft);
}

.fame-link:last-child {
  border-bottom: none;
}

.fame-link-label {
  flex: none;
  color: var(--ink-faint);
  font-size: 12px;
}

.fame-link-value {
  color: var(--ink);
  font-size: 13px;
  text-align: right;
  word-break: break-all;
}

a.fame-link:hover .fame-link-value {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.fame-copy {
  margin-left: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 11px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.fame-copy:hover {
  color: var(--ink);
}

.fame-no-contact {
  margin: 0;
  color: var(--ink-faint);
  font-size: 13px;
}

@keyframes fameFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fameIn {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .history-layout {
    grid-template-columns: 1fr;
    gap: 0;
    padding-top: 32px;
  }

  .history-toc {
    position: static;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 18px;
    margin-bottom: 38px;
    padding-bottom: 22px;
    border-bottom: 1px solid var(--line);
  }

  .history-toc-title {
    flex: 0 0 100%;
    margin-bottom: 6px;
  }

  .history-toc-link.hall {
    margin-top: 0;
    padding-top: 7px;
    border-top: none;
  }

  .history-toc-foot {
    display: none;
  }

  .hall-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .history-main {
    padding: 34px 18px 0;
  }

  .history-hero {
    padding-bottom: 28px;
  }

  .history-title {
    font-size: 42px;
  }

  .history-sub {
    font-size: 15px;
  }

  .history-layout {
    padding-top: 24px;
  }

  .history-chapter {
    padding-bottom: 44px;
    margin-bottom: 44px;
  }

  .chapter-title {
    font-size: 28px;
  }

  .chapter-summary {
    font-size: 15px;
  }

  .hall-card {
    padding-right: 0;
  }

  .fame-backdrop {
    padding: 10px;
  }

  .fame-panel {
    padding: 28px 22px 30px;
    border-radius: 14px;
  }

  .fame-head {
    gap: 14px;
  }

  .fame-avatar {
    width: 56px;
    height: 56px;
    font-size: 20px;
  }

  .fame-name {
    font-size: 24px;
  }

  .fame-link {
    flex-direction: column;
    gap: 4px;
  }

  .fame-link-value {
    text-align: left;
  }
}
</style>