<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main">
      <section class="faq-hero">
        <div class="eyebrow">
          <span class="eyebrow-line" />
          <span>FAQ · {{ site?.brand || '软工集市' }}</span>
        </div>
        <h1 class="faq-title">常见问题</h1>
        <p class="faq-sub">关于报名、简历、交流和社团生活，这里有你想要的答案。</p>
        <div class="faq-search">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input v-model="q" type="search" placeholder="搜索问题关键词…" />
        </div>
      </section>

      <div class="faq-layout">
        <section class="faq-main">
          <div class="faq-cats">
            <button
              class="chip"
              :class="{ active: !activeCategory }"
              @click="activeCategory = ''"
            >
              全部
            </button>
            <button
              v-for="c in categories"
              :key="c"
              class="chip"
              :class="{ active: activeCategory === c }"
              @click="activeCategory = activeCategory === c ? '' : c"
            >
              {{ c }}
            </button>
          </div>

          <div v-if="loading" class="faq-loading">加载中…</div>
          <p v-else-if="error" class="notice notice-error">{{ error }}</p>
          <div v-else-if="!filtered.length" class="faq-empty">
            <p>没有找到相关问题。</p>
            <button class="btn btn-ghost btn-sm" @click="reset">查看全部问题</button>
          </div>
          <div v-else class="faq-list">
            <article
              v-for="f in filtered"
              :key="f.id"
              class="faq-item"
              :class="{ open: isOpen(f.id) }"
            >
              <button class="faq-q" @click="toggle(f.id)">
                <span class="faq-cat">{{ f.category }}</span>
                <span class="faq-q-text">{{ f.question }}</span>
                <span class="faq-toggle">{{ isOpen(f.id) ? '−' : '+' }}</span>
              </button>
              <div v-if="isOpen(f.id)" class="faq-a">
                <p>{{ f.answer }}</p>
              </div>
            </article>
          </div>
        </section>

        <aside class="faq-aside">
          <div class="faq-card">
            <h3>还有疑问？</h3>
            <p>没找到答案？可以直接联系社团，我们会尽快回复。</p>
            <a class="btn btn-primary btn-block" :href="`mailto:${site?.contactEmail || 'ssemarket@163.com'}`">
              联系社团
            </a>
            <RouterLink class="btn btn-ghost btn-block faq-card-btn" to="/jobs">
              浏览部门岗位
            </RouterLink>
          </div>
          <div class="faq-card faq-card-soft">
            <h3>第一次报名？</h3>
            <p>使用集市统一身份登录，上传 PDF 简历即可自动解析并报名。</p>
            <RouterLink class="faq-text-link" to="/login">去登录 →</RouterLink>
          </div>
        </aside>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Faq } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useSiteStore } from '../stores/site'

const route = useRoute()
const siteState = useSiteStore().state
const site = computed(() => siteState.site)

const faqs = ref<Faq[]>([])
const loading = ref(true)
const error = ref('')
const q = ref(String(route.query.q || ''))
const activeCategory = ref(String(route.query.category || ''))
const openIds = ref<number[]>([])

const categories = computed(() => Array.from(new Set(faqs.value.map((f) => f.category))))

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return faqs.value.filter((f) => {
    if (activeCategory.value && f.category !== activeCategory.value) return false
    if (!term) return true
    return `${f.question} ${f.answer} ${f.category}`.toLowerCase().includes(term)
  })
})

function isOpen(id: number): boolean {
  return openIds.value.includes(id)
}

function toggle(id: number) {
  openIds.value = isOpen(id) ? openIds.value.filter((x) => x !== id) : [...openIds.value, id]
}

function reset() {
  q.value = ''
  activeCategory.value = ''
}

onMounted(async () => {
  useSiteStore().ensure()
  try {
    faqs.value = (await api.faqs()) || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.faq-hero {
  margin-bottom: 34px;
}
.faq-title {
  margin: 18px 0 10px;
  font-size: clamp(34px, 5vw, 48px);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.1;
}
.faq-sub {
  margin: 0 0 24px;
  color: var(--ink-soft);
  font-size: 15px;
}
.faq-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  max-width: 620px;
}
.faq-search:focus-within {
  border-color: #c9cdd4;
  box-shadow: 0 0 0 4px rgba(23, 23, 23, 0.04);
}
.search-icon {
  color: var(--ink-faint);
  font-size: 18px;
}
.faq-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
}
.faq-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 48px;
  align-items: start;
}
.faq-cats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.faq-list {
  border-top: 1px solid var(--line);
}
.faq-item {
  border-bottom: 1px solid var(--line);
}
.faq-q {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 18px 8px;
  border: none;
  background: transparent;
  text-align: left;
}
.faq-q:hover .faq-q-text {
  color: var(--ink);
}
.faq-cat {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--input-bg);
  color: var(--ink-faint);
  font-size: 11px;
}
.faq-q-text {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  transition: color 0.15s ease;
}
.faq-toggle {
  flex: none;
  color: var(--ink-faint);
  font-size: 18px;
  font-weight: 300;
}
.faq-item.open .faq-q-text {
  color: var(--ink);
}
.faq-a {
  padding: 0 8px 20px 8px;
}
.faq-a p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.85;
  white-space: pre-wrap;
}
.faq-loading,
.faq-empty {
  padding: 56px 0;
  text-align: center;
  color: var(--ink-soft);
  font-size: 14px;
}
.faq-empty p {
  margin: 0 0 14px;
}
.faq-aside {
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.faq-card {
  padding: 18px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.faq-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
}
.faq-card p {
  margin: 0 0 16px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
}
.faq-card-btn {
  margin-top: 8px;
}
.faq-card-soft {
  background: transparent;
  border: none;
}
.faq-text-link {
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}
@media (max-width: 900px) {
  .faq-layout {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .faq-aside {
    position: static;
  }
}
</style>
