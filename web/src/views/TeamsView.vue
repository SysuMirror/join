<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main publicity-main">
      <header class="publicity-hero">
        <p class="eyebrow">技术部（圆桌）</p>
        <h1 class="page-title">席位与晋升公示</h1>
        <p class="page-sub">
          记录每次技术部会议的席位分配与晋升结果，自动生成公示文档。<br />
          部门介绍与在招岗位请前往「部门岗位」查看。
        </p>
        <div class="hero-actions">
          <RouterLink class="btn btn-ghost btn-sm" to="/jobs">部门岗位 →</RouterLink>
          <RouterLink class="btn btn-ghost btn-sm" to="/faq">常见问题 →</RouterLink>
        </div>
      </header>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <div v-if="loading" class="empty">加载中…</div>

      <template v-else>
        <section class="section">
          <div class="section-head">
            <div>
              <h2 class="section-title">公示记录</h2>
              <p class="section-sub">每次会议结束后发布，含晋升结果与席位变动。</p>
            </div>
          </div>

          <div v-if="publicities.length" class="publicity-list">
            <RouterLink
              v-for="p in publicities"
              :key="p.id"
              class="publicity-row"
              :to="`/publicity/${p.id}`"
            >
              <time class="publicity-date">{{ p.meeting_date || formatDate(p.created_at) }}</time>
              <div class="publicity-copy">
                <h3>{{ p.title }}</h3>
                <p v-if="p.summary">{{ p.summary }}</p>
              </div>
              <div class="publicity-meta">
                <span v-if="p.promotions">{{ p.promotions }} 项晋升</span>
                <span v-if="p.seats">{{ p.seats }} 个部门席位</span>
              </div>
              <span class="publicity-arrow">→</span>
            </RouterLink>
          </div>
          <div v-else class="empty-inline">还没有已发布的公示。</div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2 class="section-title">技术部席位名额</h2>
              <p class="section-sub">当前各部门的保底 / 浮动席位与占用情况。</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table seats-table">
              <thead>
                <tr>
                  <th>部门</th>
                  <th>保底</th>
                  <th>浮动</th>
                  <th>合计</th>
                  <th>已占</th>
                  <th>空位</th>
                  <th>候补</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in departments" :key="d.id">
                  <td>
                    <RouterLink class="dept-link" :to="`/departments/${d.slug}`">{{ d.name }}</RouterLink>
                  </td>
                  <td>{{ d.seats.base }}</td>
                  <td>{{ d.seats.floating }}</td>
                  <td>{{ d.seats.total }}</td>
                  <td>{{ d.seats.occupied }}</td>
                  <td>{{ d.seats.available }}</td>
                  <td>{{ d.seats.waitlist }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2 class="section-title">部门指标</h2>
              <p class="section-sub">以最近一次已发布公示为准，全体开发者可对照审计。</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table seats-table">
              <thead>
                <tr>
                  <th>部门</th>
                  <th>交付量</th>
                  <th>使用量</th>
                  <th>出人贡献</th>
                  <th>社区活跃</th>
                  <th>综合</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in departments" :key="`m-${d.id}`">
                  <td>
                    <RouterLink class="dept-link" :to="`/departments/${d.slug}`">{{ d.name }}</RouterLink>
                  </td>
                  <td>{{ d.output.delivery }}</td>
                  <td>{{ d.output.usage }}</td>
                  <td>{{ d.output.talent }}</td>
                  <td>{{ d.output.activity }}</td>
                  <td>{{ d.output.score }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, type OrgOverview, type PublicitySummary } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { formatDate } from '../utils/labels'

const org = ref<OrgOverview | null>(null)
const publicities = ref<PublicitySummary[]>([])
const loading = ref(true)
const error = ref('')

const departments = computed(() => org.value?.departments || [])

onMounted(async () => {
  try {
    const [o, p] = await Promise.all([api.orgOverview(), api.orgPublicities()])
    org.value = o
    publicities.value = p || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.publicity-main {
  max-width: 1040px;
}
.publicity-hero {
  padding: 12px 0 8px;
}
.eyebrow {
  margin: 0 0 8px;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.hero-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.publicity-list {
  display: grid;
  gap: 0;
  border-top: 1px solid var(--line);
}
.publicity-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) auto 20px;
  align-items: center;
  gap: 18px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.publicity-date {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 12px;
}
.publicity-copy h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.publicity-copy p {
  margin: 5px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.publicity-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--ink-faint);
  font-size: 11px;
  white-space: nowrap;
}
.publicity-arrow {
  color: var(--ink-faint);
  font-size: 16px;
}
.publicity-row:hover .publicity-copy h3 {
  color: var(--ink);
}
.table-wrap {
  overflow-x: auto;
}
.seats-table {
  min-width: 620px;
}
.seats-table th,
.seats-table td {
  white-space: nowrap;
}
.seats-table td:first-child {
  white-space: normal;
}
.dept-link {
  font-weight: 600;
}
.dept-link:hover {
  color: var(--ink-soft);
}
.empty-inline {
  padding: 26px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 13px;
}
.empty {
  padding: 50px 0;
  text-align: center;
  color: var(--ink-faint);
  font-size: 13px;
}
@media (max-width: 720px) {
  .publicity-row {
    grid-template-columns: 1fr 20px;
    gap: 6px 12px;
  }
  .publicity-date,
  .publicity-meta {
    grid-column: 1 / -1;
  }
  .publicity-meta {
    order: 3;
  }
  .publicity-arrow {
    grid-row: 1 / span 2;
    grid-column: 2;
  }
}
</style>