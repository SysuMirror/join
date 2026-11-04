<template>
  <div class="card panel roundtable-panel">
    <div class="row-between">
      <div>
        <h3>圆桌与年度复审</h3>
        <p class="hint">技术部席位按部门「基础保底 + 浮动产出」分配。卸任负责人或年度复审不达标时退出圆桌、释放席位，候补按顺序自动递补。</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="loading" @click="load">刷新</button>
    </div>

    <p v-if="loading" class="empty">加载中…</p>
    <template v-else-if="data">
      <div class="seat-grid">
        <article v-for="s in data.seats" :key="s.department.id" class="seat-card">
          <div class="seat-card-head">
            <b>{{ s.department.name }}</b>
            <span class="badge" :class="s.available ? 'badge-green' : 'badge-red'">
              {{ s.occupied }}/{{ s.total }}
            </span>
          </div>
          <div class="seat-bar">
            <span v-for="n in s.total" :key="n" class="seat-dot" :class="{ filled: n <= s.occupied }" />
          </div>
          <div class="seat-meta">
            <span>保底 {{ s.base }}</span>
            <span>浮动 {{ s.floating }}</span>
            <span>候补 {{ s.waitlist }}</span>
            <span>成员 {{ s.members }}</span>
          </div>
          <button
            v-if="s.waitlist"
            class="btn btn-ghost btn-sm promote-btn"
            @click="promote(s.department.id)"
          >
            递补候补（{{ s.waitlist }}）
          </button>
        </article>
      </div>

      <div class="row-between sub-head">
        <div>
          <h4>圆桌成员</h4>
          <p class="hint">共 {{ data.members.length }} 人。</p>
        </div>
      </div>
      <table v-if="data.members.length" class="table">
        <thead>
          <tr>
            <th>成员</th>
            <th>部门</th>
            <th class="hide-sm">进入圆桌</th>
            <th class="hide-sm">最近复审</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in data.members" :key="m.id">
            <td>
              <strong>{{ m.name }}</strong>
              <div class="muted small mono">{{ m.developer_no }}</div>
            </td>
            <td>{{ m.department?.name || '—' }}</td>
            <td class="hide-sm small mono">{{ formatDate(m.roundtable_joined_at) }}</td>
            <td class="hide-sm small">
              <template v-if="m.last_review">
                {{ m.last_review.year }} · {{ m.last_review.output_score }} 分 ·
                <span :class="m.last_review.result === 'exited' ? 'text-danger' : 'text-ok'">
                  {{ m.last_review.result === 'exited' ? '退出' : '保留' }}
                </span>
              </template>
              <span v-else class="muted">暂无</span>
            </td>
            <td class="actions">
              <button class="btn btn-primary btn-sm" @click="review(m)">年度复审</button>
              <button class="btn btn-danger btn-sm" @click="exit(m)">退出圆桌</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">还没有圆桌开发者。</div>

      <div class="row-between sub-head">
        <div>
          <h4>候补队列</h4>
          <p class="hint">答辩已通过但部门席位已满的成员，按发起时间排序。</p>
        </div>
      </div>
      <div v-if="data.waitlist.length" class="waitlist">
        <div v-for="d in data.waitlist" :key="d.id" class="waitlist-row">
          <div>
            <b>{{ d.applicant?.name || '—' }}</b>
            <span class="muted small"> · {{ d.department_name }} · {{ d.title }}</span>
            <div class="muted small">答辩通过于 {{ formatDateTime(d.decided_at) }}</div>
          </div>
          <RouterLink class="btn btn-ghost btn-sm" :to="`/defenses/${d.id}`">查看答辩</RouterLink>
        </div>
      </div>
      <div v-else class="empty">暂无候补。</div>

      <div class="row-between sub-head">
        <div>
          <h4>最近复审记录</h4>
          <p class="hint">用于解释席位释放与人员流动。</p>
        </div>
      </div>
      <table v-if="data.seat_reviews.length" class="table">
        <thead><tr><th>成员</th><th>年度</th><th>产出</th><th>结果</th><th class="hide-sm">说明</th><th class="hide-sm">评审人</th></tr></thead>
        <tbody>
          <tr v-for="r in data.seat_reviews" :key="r.id">
            <td>{{ memberName(r.user_id) }}</td>
            <td>{{ r.year }}</td>
            <td>{{ r.output_score }}</td>
            <td>
              <span class="badge" :class="r.result === 'exited' ? 'badge-red' : 'badge-green'">
                {{ r.result === 'exited' ? '退出圆桌' : '保留' }}
              </span>
            </td>
            <td class="hide-sm small">{{ r.note || '—' }}</td>
            <td class="hide-sm small">{{ r.reviewer }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无复审记录。</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type AdminUser, type RoundtableData } from '../../api'
import { formatDate, formatDateTime } from '../../utils/labels'

const props = defineProps<{ global: boolean }>()
const emit = defineEmits<{
  (e: 'notice', msg: string): void
  (e: 'error', msg: string): void
  (e: 'changed'): void
}>()

const data = ref<RoundtableData | null>(null)
const loading = ref(true)

function memberName(id: number): string {
  const m = data.value?.members.find((x: AdminUser) => x.id === id)
  return m?.name || `#${id}`
}

async function load() {
  loading.value = true
  try {
    data.value = await api.adminRoundtable()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function review(m: AdminUser) {
  const year = window.prompt('复审年度', String(new Date().getFullYear()))
  if (year === null) return
  const score = window.prompt(`「${m.name}」年度产出评分（0-100）`, '60')
  if (score === null) return
  const passed = window.confirm('是否达到产出要求？\n确定 = 达标保留席位；取消 = 未达标退出圆桌')
  const note = window.prompt('复审说明（选填）', '') ?? ''
  try {
    await api.adminSeatReview(m.id, {
      year: Number(year) || new Date().getFullYear(),
      output_score: Number(score),
      passed,
      note,
    })
    emit('notice', passed ? '年度复审已记录' : '未达标，已退出圆桌并释放席位')
    emit('changed')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '操作失败')
  }
}

async function exit(m: AdminUser) {
  const reason = window.prompt(`退出圆桌「${m.name}」的原因（会记录在复审记录中）`, '卸任产品负责人')
  if (reason === null) return
  if (!window.confirm(`确认让「${m.name}」退出圆桌？席位会立即释放并自动递补候补者。`)) return
  try {
    await api.adminExitRoundtable(m.id, { reason })
    emit('notice', '已退出圆桌，席位已释放')
    emit('changed')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '操作失败')
  }
}

async function promote(departmentId: number) {
  try {
    const res = await api.adminPromoteWaitlist(departmentId)
    emit('notice', res.promoted ? `已递补 ${res.promoted} 人` : '没有可递补的候补者')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.roundtable-panel :deep(.hint) {
  margin: 4px 0 0;
}
.seat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 20px;
}
.seat-card {
  padding: 12px 0 0;
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.seat-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.seat-card-head b {
  flex: 1;
  font-size: 14px;
}
.seat-bar {
  display: flex;
  gap: 4px;
  margin: 12px 0 8px;
}
.seat-dot {
  flex: 1;
  height: 7px;
  border-radius: 4px;
  background: #e4e7ec;
}
.seat-dot.filled {
  background: var(--ink);
}
.seat-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--ink-faint);
  font-size: 11px;
}
.promote-btn {
  margin-top: 10px;
  width: 100%;
}
.sub-head {
  margin: 22px 0 8px;
}
.sub-head h4 {
  margin: 0;
  font-size: 14px;
}
.waitlist {
  display: grid;
  gap: 8px;
}
.waitlist-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
}
.text-ok {
  color: #3f5546;
}
.text-danger {
  color: #6f453f;
}
@media (max-width: 900px) {
  .seat-grid {
    grid-template-columns: 1fr;
  }
}
</style>