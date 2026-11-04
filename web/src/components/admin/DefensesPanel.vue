<template>
  <div class="card panel defenses-panel">
    <div class="row-between">
      <div>
        <h3>答辩管理</h3>
        <p class="hint">发起 → 一级事实陈述 → 二级交叉评审 → 三级资源方评审 → 席位裁决。通过后自动进入圆桌。</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost btn-sm" :disabled="loading" @click="load">刷新</button>
      </div>
    </div>

    <div class="stat-grid mini-stats">
      <div class="stat-card"><b>{{ counts.open }}</b><span>进行中</span></div>
      <div class="stat-card"><b>{{ counts.waitlist }}</b><span>候补席位</span></div>
      <div class="stat-card"><b>{{ counts.passed }}</b><span>已进圆桌</span></div>
      <div class="stat-card"><b>{{ counts.rejected }}</b><span>未通过</span></div>
      <div class="stat-card"><b>{{ myPending }}</b><span>待我评审</span></div>
    </div>

    <div class="toolbar">
      <input v-model="filters.q" class="search" placeholder="搜索申请人 / 部门 / 答辩标题…" @input="debouncedLoad" />
      <select v-model="filters.status" @change="load">
        <option value="">全部状态</option>
        <option value="level1">一级 · 事实陈述</option>
        <option value="level2">二级 · 交叉评审</option>
        <option value="level3">三级 · 资源方评审</option>
        <option value="waitlist">候补席位</option>
        <option value="passed">已进入圆桌</option>
        <option value="rejected">未通过</option>
        <option value="withdrawn">已撤回</option>
      </select>
      <label class="mine-toggle">
        <input v-model="filters.mine" type="checkbox" @change="load" />
        只看待我评审
      </label>
    </div>

    <p v-if="loading" class="empty">加载中…</p>
    <table v-else-if="rows.length" class="table">
      <thead>
        <tr>
          <th>答辩</th>
          <th>申请人</th>
          <th>状态</th>
          <th class="hide-sm">席位</th>
          <th class="hide-sm">评审进度</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in rows" :key="d.id">
          <td>
            <strong>{{ d.title }}</strong>
            <div class="muted small">{{ d.department_name }} · {{ formatDate(d.created_at) }}</div>
          </td>
          <td>
            <div>{{ d.applicant?.name || '—' }}</div>
            <div class="muted small mono">{{ d.applicant?.developer_no }}</div>
          </td>
          <td><span class="badge" :class="defenseStatusClass(d.status)">{{ defenseStatusLabel(d.status) }}</span></td>
          <td class="hide-sm small">{{ d.seat.occupied }}/{{ d.seat.total }}<span v-if="d.seat.waitlist" class="muted"> · 候补 {{ d.seat.waitlist }}</span></td>
          <td class="hide-sm small">
            {{ reviewProgress(d) }}
            <span v-if="d.my_pending_reviews?.length" class="badge badge-amber">待我 {{ d.my_pending_reviews.length }}</span>
          </td>
          <td class="actions">
            <RouterLink class="btn btn-ghost btn-sm" :to="`/defenses/${d.id}`">详情 / 评审</RouterLink>
            <template v-if="global && ['submitted','level1','level2','level3','waitlist'].includes(d.status)">
              <button class="btn btn-primary btn-sm" @click="decide(d, 'pass')">裁决通过</button>
              <button class="btn btn-danger btn-sm" @click="decide(d, 'reject')">裁决未通过</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">没有匹配的答辩。</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, type Defense } from '../../api'
import { defenseStatusClass, defenseStatusLabel, formatDate } from '../../utils/labels'

const props = defineProps<{ global: boolean }>()
const emit = defineEmits<{
  (e: 'notice', msg: string): void
  (e: 'error', msg: string): void
  (e: 'changed'): void
}>()

const rows = ref<Defense[]>([])
const loading = ref(true)
const filters = reactive({ q: '', status: '', mine: false })

const counts = computed(() => {
  const c = { open: 0, waitlist: 0, passed: 0, rejected: 0 }
  for (const d of rows.value) {
    if (['submitted', 'level1', 'level2', 'level3'].includes(d.status)) c.open += 1
    else if (d.status === 'waitlist') c.waitlist += 1
    else if (d.status === 'passed') c.passed += 1
    else if (d.status === 'rejected') c.rejected += 1
  }
  return c
})

const myPending = computed(
  () => rows.value.reduce((n, d) => n + (d.my_pending_reviews?.length || 0), 0),
)

function reviewProgress(d: Defense): string {
  const done = d.reviews.filter((r) => r.status === 'submitted').length
  return `${done}/${d.reviews.length}`
}

let timer: number | undefined
function debouncedLoad() {
  window.clearTimeout(timer)
  timer = window.setTimeout(load, 250)
}

async function load() {
  loading.value = true
  try {
    rows.value =
      (await api.adminDefenses({
        q: filters.q,
        status: filters.status,
        mine: filters.mine ? '1' : '',
      })) || []
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function decide(d: Defense, decision: 'pass' | 'reject') {
  const label = decision === 'pass' ? '裁决通过' : '裁决未通过'
  const note = window.prompt(`${label}「${d.title}」的说明（将记录在答辩结论中）`, '')
  if (note === null) return
  if (!window.confirm(`确认${label}？通过仍需本部门有空余席位，否则进入候补。`)) return
  try {
    await api.adminDecideDefense(d.id, decision, note)
    emit('notice', `已${label}`)
    emit('changed')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.defenses-panel :deep(.hint) {
  margin: 4px 0 0;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.mini-stats {
  margin: 16px 0 12px;
}
.mini-stats .stat-card {
  padding: 14px;
}
.mine-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-soft);
  font-size: 12px;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .mini-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>