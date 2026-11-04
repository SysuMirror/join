<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main document-main">
      <button class="back-link" @click="router.back()">← 返回公示列表</button>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <div v-if="loading" class="doc-loading">加载中…</div>

      <article v-else-if="doc" class="document">
        <header class="doc-head">
          <p class="doc-kicker">技术部会议公示</p>
          <h1>{{ doc.title }}</h1>
          <p class="doc-meta">
            会议时间：{{ doc.meeting_date || '—' }}
            <span class="dot-sep" />
            发布：{{ doc.created_by || '技术部' }}
          </p>
          <div class="doc-actions">
            <button class="btn btn-ghost btn-sm" @click="printDoc">打印 / 导出 PDF</button>
            <button class="btn btn-ghost btn-sm" @click="copyText">
              {{ copied ? '已复制' : '复制文本' }}
            </button>
          </div>
        </header>

        <section v-if="doc.summary" class="doc-section">
          <h2>说明</h2>
          <p class="doc-text">{{ doc.summary }}</p>
        </section>

        <section class="doc-section">
          <h2>一、晋升与席位变动</h2>
          <table v-if="doc.promotions.length" class="table doc-table">
            <thead>
              <tr><th>姓名</th><th>开发者编号</th><th>部门</th><th>结果</th><th>说明</th></tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in doc.promotions" :key="i">
                <td>{{ p.name }}</td>
                <td class="mono">{{ p.developer_no || '—' }}</td>
                <td>{{ p.department_name || '—' }}</td>
                <td>{{ p.result }}</td>
                <td>{{ p.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="doc-empty">本次会议无晋升或席位变动。</p>
        </section>

        <section class="doc-section">
          <h2>二、技术部席位分配</h2>
          <table class="table doc-table">
            <thead>
              <tr><th>部门</th><th>保底席位</th><th>浮动席位</th><th>合计</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in doc.seats" :key="s.department_id">
                <td>{{ s.department_name }}</td>
                <td>{{ s.base }}</td>
                <td>{{ s.floating }}</td>
                <td>{{ s.total }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="doc-section">
          <h2>三、部门指标</h2>
          <table class="table doc-table">
            <thead>
              <tr><th>部门</th><th>交付量</th><th>使用量</th><th>出人贡献</th><th>社区活跃</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in doc.seats" :key="`m-${s.department_id}`">
                <td>{{ s.department_name }}</td>
                <td>{{ s.delivery || 0 }}</td>
                <td>{{ s.usage || 0 }}</td>
                <td>{{ s.talent || 0 }}</td>
                <td>{{ s.activity || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer class="doc-foot">
          <span>本公示由软工集市技术部发布</span>
          <span>{{ doc.meeting_date }}</span>
        </footer>
      </article>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Publicity } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'

const route = useRoute()
const router = useRouter()
const doc = ref<Publicity | null>(null)
const loading = ref(true)
const error = ref('')
const copied = ref(false)

async function load() {
  try {
    doc.value = await api.orgPublicity(Number(route.params.id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function printDoc() {
  window.print()
}

async function copyText() {
  if (!doc.value) return
  try {
    await navigator.clipboard.writeText(doc.value.content)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 2000)
  } catch {
    window.prompt('复制公示文本', doc.value.content)
  }
}

onMounted(load)
</script>

<style scoped>
.document-main {
  max-width: 900px;
}
.back-link {
  border: none;
  background: transparent;
  padding: 0;
  margin-bottom: 18px;
  color: var(--ink-soft);
  font-size: 13px;
}
.doc-loading {
  padding: 70px 0;
  text-align: center;
  color: var(--ink-faint);
}
.document {
  padding-bottom: 40px;
}
.doc-head {
  padding-bottom: 22px;
  border-bottom: 1px solid var(--line);
}
.doc-kicker {
  margin: 0 0 10px;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.doc-head h1 {
  margin: 0 0 10px;
  font-size: 30px;
  letter-spacing: -0.025em;
}
.doc-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}
.doc-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.doc-section {
  padding-top: 24px;
}
.doc-section h2 {
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 700;
}
.doc-text {
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.doc-table {
  font-size: 13px;
}
.doc-empty {
  color: var(--ink-faint);
  font-size: 13px;
}
.doc-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 34px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 12px;
}
@media print {
  :global(.site-header),
  :global(.site-footer),
  .back-link,
  .doc-actions {
    display: none !important;
  }
  .document-main {
    max-width: none;
  }
}
</style>