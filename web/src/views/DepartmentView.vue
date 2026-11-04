<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main dept-main">
      <button class="back-link" @click="router.back()">← 返回</button>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <div v-if="loading" class="dept-loading">加载中…</div>

      <template v-else-if="dept">
        <header class="dept-hero">
          <p class="eyebrow">项目部门</p>
          <h1 class="page-title">{{ dept.name }}</h1>
          <p v-if="dept.summary" class="page-sub">{{ dept.summary }}</p>
          <p class="dept-head-line">
            <span v-if="dept.head">负责人：{{ dept.head.name }}</span>
            <span v-else>负责人：待任命</span>
            <span class="dot-sep" />
            <span>{{ jobs.length }} 个开放岗位</span>
          </p>
        </header>

        <section v-if="dept.description" class="section">
          <h2 class="section-title">部门介绍</h2>
          <p class="dept-description">{{ dept.description }}</p>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h2 class="section-title">部门岗位</h2>
              <p class="section-sub">选择感兴趣的岗位投递，进入部门双选流程。</p>
            </div>
            <RouterLink class="btn btn-ghost btn-sm" :to="{ path: '/jobs', query: { department: dept.slug } }">
              查看全部 →
            </RouterLink>
          </div>

          <div v-if="jobs.length" class="dept-jobs">
            <JobCard v-for="j in jobs" :key="j.id" :job="j" />
          </div>
          <div v-else class="empty-inline">该部门暂无开放岗位。</div>
        </section>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Department, type Job } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import JobCard from '../components/JobCard.vue'

const route = useRoute()
const router = useRouter()
const dept = ref<Department | null>(null)
const jobs = ref<Job[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const slug = String(route.params.slug || '')
  try {
    const [d, j] = await Promise.all([
      api.department(slug),
      api.jobs({ department: slug }),
    ])
    dept.value = d
    jobs.value = j || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dept-main {
  max-width: 900px;
}
.back-link {
  border: none;
  background: transparent;
  padding: 0;
  margin-bottom: 16px;
  color: var(--ink-soft);
  font-size: 13px;
}
.dept-loading {
  padding: 70px 0;
  text-align: center;
  color: var(--ink-faint);
}
.dept-hero {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
}
.eyebrow {
  margin: 0 0 8px;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dept-head-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0 0;
  color: var(--ink-faint);
  font-size: 12px;
}
.dept-description {
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.dept-jobs {
  border-top: 1px solid var(--line);
}
.empty-inline {
  padding: 26px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 13px;
}
</style>