<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main defense-main">
      <button class="back-link" @click="router.back()">← 返回</button>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <div v-if="loading" class="defense-loading">加载中…</div>

      <template v-else-if="defense">
        <header class="defense-head">
          <div>
            <p class="eyebrow">技术部答辩 · #{{ defense.id }}</p>
            <h1 class="page-title">{{ defense.title }}</h1>
            <p class="page-sub">
              {{ defense.applicant?.name || '申请人' }}
              <span class="dot-sep" />
              {{ defense.department?.name }}
              <span class="dot-sep" />
              发起于 {{ formatDateTime(defense.created_at) }}
            </p>
          </div>
          <div class="head-badges">
            <span class="badge" :class="defenseStatusClass(defense.status)">
              {{ defenseStatusLabel(defense.status) }}
            </span>
            <span v-if="defense.applicant" class="badge" :class="levelClass(defense.applicant.developer_level)">
              {{ defense.applicant.level_label }}
            </span>
          </div>
        </header>

        <!-- 流程条 -->
        <div class="flow card">
          <div
            v-for="(s, i) in flowSteps"
            :key="s.key"
            class="flow-step"
            :class="flowClass(i + 1)"
          >
            <span class="flow-num">{{ i + 1 }}</span>
            <div>
              <b>{{ s.title }}</b>
              <span>{{ s.desc }}</span>
            </div>
          </div>
        </div>

        <p v-if="defense.status === 'waitlist'" class="notice notice-info">
          评审已通过，但本部门技术部席位已满（{{ defense.seat.occupied }}/{{ defense.seat.total }}）。
          已进入候补队列，席位释放时按顺序自动递补。
        </p>

        <div class="detail-layout">
          <div class="detail-main">
            <section class="card content-card">
              <h2>个人陈述</h2>
              <p class="pre">{{ defense.statement }}</p>
            </section>

            <section class="card content-card proposal-card">
              <h2>答辩核心：资源分配主张</h2>
              <p class="pre">{{ defense.proposal }}</p>
            </section>

            <section v-if="defense.achievements" class="card content-card">
              <h2>产出与贡献</h2>
              <p class="pre">{{ defense.achievements }}</p>
            </section>

            <section class="card content-card">
              <div class="row-between">
                <h2>评审记录</h2>
                <span class="muted small">{{ doneReviews }}/{{ defense.reviews.length }} 已提交</span>
              </div>
              <div class="review-list">
                <article v-for="r in defense.reviews" :key="r.id" class="review-item" :class="`lvl-${r.level}`">
                  <div class="review-head">
                    <div>
                      <span class="badge" :class="r.level === 1 ? 'badge-blue' : r.level === 2 ? 'badge-green' : 'badge-amber'">
                        {{ levelTitle(r.level) }}
                      </span>
                      <b class="reviewer">{{ r.reviewer_name }}</b>
                      <span class="muted small">{{ r.role_label }}</span>
                    </div>
                    <span class="badge" :class="reviewBadgeClass(r)">
                      {{ r.status === 'pending' ? '待评审' : decisionLabel(r.decision) }}
                    </span>
                  </div>
                  <p v-if="r.opinion" class="pre review-opinion">{{ r.opinion }}</p>
                  <p v-else class="muted small">尚未提交评审意见。</p>
                  <div class="review-foot">
                    <span v-if="r.score >= 0" class="muted small">评分 {{ r.score }}</span>
                    <span v-if="r.submitted_at" class="muted small mono">{{ formatDateTime(r.submitted_at) }}</span>
                  </div>

                  <form
                    v-if="canReview(r)"
                    class="review-form"
                    @submit.prevent="submitReview(r)"
                  >
                    <div v-if="r.level > 1" class="review-decisions">
                      <button
                        type="button"
                        class="choice"
                        :class="{ active: reviewForms[r.id]?.decision === 'approve' }"
                        @click="setDecision(r.id, 'approve')"
                      >赞成</button>
                      <button
                        type="button"
                        class="choice choice-reject"
                        :class="{ active: reviewForms[r.id]?.decision === 'reject' }"
                        @click="setDecision(r.id, 'reject')"
                      >反对</button>
                      <input
                        v-model.number="reviewForms[r.id].score"
                        class="score-input"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="评分 0-100"
                      />
                    </div>
                    <textarea
                      v-model="reviewForms[r.id].opinion"
                      rows="3"
                      :placeholder="r.level === 1 ? (r.is_fact_only ? '陈述事实：投入、产出、协作情况（回避打分）' : '评审意见') : '评审意见（必填）'"
                    />
                    <p v-if="reviewError[r.id]" class="notice notice-error">{{ reviewError[r.id] }}</p>
                    <button class="btn btn-primary btn-sm" type="submit" :disabled="reviewBusy[r.id]">
                      {{ reviewBusy[r.id] ? '提交中…' : r.level === 1 ? '提交事实陈述' : '提交评审' }}
                    </button>
                  </form>
                </article>
              </div>
            </section>
          </div>

          <aside class="detail-aside">
            <div class="card aside-card">
              <h3>申请人</h3>
              <div v-if="defense.applicant" class="applicant">
                <img v-if="defense.applicant.avatar" class="applicant-avatar" :src="defense.applicant.avatar" alt="" />
                <span v-else class="applicant-avatar initial">{{ (defense.applicant.name || '?').slice(0, 1) }}</span>
                <div>
                  <b>{{ defense.applicant.name }}</b>
                  <p class="muted small mono">{{ defense.applicant.developer_no }}</p>
                  <p class="muted small">{{ defense.applicant.department?.name }}</p>
                </div>
              </div>
            </div>

            <div class="card aside-card">
              <h3>部门席位</h3>
              <div class="seat-summary">
                <div><b>{{ defense.seat.occupied }}/{{ defense.seat.total }}</b><span>已占用</span></div>
                <div><b>{{ defense.seat.available }}</b><span>可用</span></div>
                <div><b>{{ defense.seat.waitlist }}</b><span>候补</span></div>
              </div>
            </div>

            <div v-if="defense.final_note" class="card aside-card">
              <h3>结论说明</h3>
              <p class="small pre">{{ defense.final_note }}</p>
              <p class="muted small">{{ defense.decided_by }} · {{ formatDateTime(defense.decided_at) }}</p>
            </div>

            <button
              v-if="isOwn && ['submitted','level1','level2','level3','waitlist'].includes(defense.status)"
              class="btn btn-danger withdraw-btn"
              :disabled="withdrawing"
              @click="withdraw"
            >
              {{ withdrawing ? '撤回中…' : '撤回答辩' }}
            </button>
          </aside>
        </div>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Defense, type DefenseReview } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuth } from '../stores/auth'
import {
  decisionLabel,
  defenseStatusClass,
  defenseStatusLabel,
  formatDateTime,
  levelClass,
} from '../utils/labels'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const user = auth.user

const defense = ref<Defense | null>(null)
const loading = ref(true)
const error = ref('')
const withdrawing = ref(false)
const reviewForms = reactive<Record<number, { decision: string; score: number; opinion: string }>>({})
const reviewBusy = reactive<Record<number, boolean>>({})
const reviewError = reactive<Record<number, string>>({})

const flowSteps = [
  { key: 'l1', title: '一级 · 本部门陈述事实', desc: '负责人回避打分' },
  { key: 'l2', title: '二级 · 交叉评审', desc: '其他 2-3 个部门负责人' },
  { key: 'l3', title: '三级 · 资源方评审', desc: '学院/外院资源方代表' },
  { key: 'seat', title: '席位裁决', desc: '按保底 + 浮动席位进入圆桌' },
]

const isOwn = computed(() => Boolean(user.value && defense.value?.applicant_user_id === user.value.id))
const doneReviews = computed(
  () => defense.value?.reviews.filter((r) => r.status === 'submitted').length || 0,
)

function levelTitle(level: number): string {
  if (level === 1) return '一级'
  if (level === 2) return '二级'
  return '三级'
}

function reviewBadgeClass(r: DefenseReview): string {
  if (r.status === 'pending') return 'badge-amber'
  if (r.decision === 'reject') return 'badge-red'
  if (r.decision === 'approve' || r.decision === 'fact') return 'badge-green'
  return 'badge'
}

function flowClass(step: number): string {
  const d = defense.value
  if (!d) return ''
  if (d.status === 'passed') return 'done'
  if (d.status === 'waitlist') return step <= 4 ? 'done' : ''
  if (d.status === 'rejected' || d.status === 'withdrawn') return ''
  const current =
    d.status === 'level1' || d.status === 'submitted' ? 1 : d.status === 'level2' ? 2 : 3
  if (step < current) return 'done'
  if (step === current) return 'active'
  return ''
}

function canReview(r: DefenseReview): boolean {
  const u = user.value
  const d = defense.value
  if (!u || !d || r.status !== 'pending') return false
  if (d.applicant_user_id === u.id) return false
  if (u.is_super_admin) return true
  if (r.reviewer_user_id === u.id) return true
  if (r.reviewer_user_id === 0 && (u.is_staff || u.is_resource_reviewer)) return true
  return false
}

function setDecision(id: number, decision: string) {
  if (!reviewForms[id]) reviewForms[id] = { decision: '', score: -1, opinion: '' }
  reviewForms[id].decision = decision
}

function ensureForm(r: DefenseReview) {
  if (!reviewForms[r.id]) {
    reviewForms[r.id] = { decision: '', score: -1, opinion: '' }
  }
  return reviewForms[r.id]
}

async function submitReview(r: DefenseReview) {
  const f = ensureForm(r)
  reviewError[r.id] = ''
  if (r.level === 1) {
    if (!f.opinion.trim()) {
      reviewError[r.id] = '一级评审需陈述事实（可只记录产出、投入与协作情况，回避打分）'
      return
    }
  } else {
    if (f.decision !== 'approve' && f.decision !== 'reject') {
      reviewError[r.id] = '请选择赞成或反对'
      return
    }
    if (!f.opinion.trim()) {
      reviewError[r.id] = '请填写评审意见'
      return
    }
  }
  reviewBusy[r.id] = true
  try {
    const updated = await api.submitMyReview(r.id, {
      decision: r.level === 1 ? 'fact' : f.decision,
      score: f.score,
      opinion: f.opinion.trim(),
    })
    if (updated) defense.value = updated
    else await load()
  } catch (e) {
    reviewError[r.id] = e instanceof Error ? e.message : '提交失败'
  } finally {
    reviewBusy[r.id] = false
  }
}

async function withdraw() {
  if (!window.confirm('确认撤回这场答辩？撤回后可重新发起。')) return
  withdrawing.value = true
  try {
    await api.withdrawDefense(Number(route.params.id))
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '撤回失败'
  } finally {
    withdrawing.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    defense.value = await api.myDefense(Number(route.params.id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.defense-main {
  max-width: 1080px;
}
.back-link {
  border: none;
  background: transparent;
  padding: 0;
  margin-bottom: 14px;
  color: var(--ink-soft);
  font-size: 13px;
}
.defense-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.eyebrow {
  margin: 0 0 8px;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.page-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.head-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.defense-loading {
  padding: 80px 0;
  text-align: center;
  color: var(--ink-soft);
}
.flow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  padding: 14px 0;
  margin-bottom: 18px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.flow-step {
  display: flex;
  gap: 10px;
  padding: 8px 12px;
  border-right: 1px solid var(--line-soft);
  opacity: 0.5;
}
.flow-step:last-child {
  border-right: none;
}
.flow-step.done,
.flow-step.active {
  opacity: 1;
}
.flow-num {
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--input-bg);
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 11px;
}
.flow-step.done .flow-num {
  background: var(--ink);
  color: #fff;
}
.flow-step.active .flow-num {
  background: var(--ink);
  color: #fff;
}
.flow-step b {
  display: block;
  font-size: 12px;
}
.flow-step span {
  color: var(--ink-faint);
  font-size: 11px;
}
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 16px;
  align-items: start;
}
.detail-main {
  display: grid;
  gap: 0;
}
.content-card {
  padding: 18px 0;
  border-top: 1px solid var(--line);
}
.content-card h2 {
  margin: 0 0 12px;
  font-size: 16px;
  letter-spacing: -0.01em;
}
.pre {
  white-space: pre-wrap;
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.85;
}
.proposal-card {
  border: none;
  border-top: 1px solid var(--line);
  background: transparent;
}
.review-list {
  display: grid;
  gap: 0;
}
.review-item {
  padding: 12px 0;
  border: none;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.review-item.lvl-1 {
  background: transparent;
}
.review-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.review-head > div {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.reviewer {
  font-size: 13px;
}
.review-opinion {
  margin-top: 10px;
  font-size: 12px;
}
.review-foot {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
.review-form {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
  display: grid;
  gap: 8px;
}
.review-form textarea {
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 9px 11px;
  background: #fff;
  outline: none;
  font-size: 12px;
  resize: vertical;
}
.review-form textarea:focus {
  border-color: var(--ink);
}
.review-decisions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.choice {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
}
.choice.active {
  background: transparent;
  color: var(--ink);
  border-color: var(--ink);
}
.choice-reject.active {
  background: transparent;
  color: #8a4a42;
  border-color: #8a4a42;
}
.score-input {
  width: 110px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 12px;
}
.detail-aside {
  display: grid;
  gap: 14px;
  position: sticky;
  top: 88px;
}
.aside-card {
  padding: 14px 0;
  border-top: 1px solid var(--line);
}
.aside-card h3 {
  margin: 0 0 12px;
  font-size: 14px;
}
.applicant {
  display: flex;
  align-items: center;
  gap: 10px;
}
.applicant-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex: none;
  object-fit: cover;
}
.applicant-avatar.initial {
  display: grid;
  place-items: center;
  background: #f2f2f2;
  color: var(--ink-soft);
  font-weight: 600;
}
.applicant b {
  font-size: 14px;
}
.applicant p {
  margin: 2px 0 0;
}
.seat-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.seat-summary div {
  text-align: center;
}
.seat-summary b {
  display: block;
  font-size: 17px;
}
.seat-summary span {
  color: var(--ink-faint);
  font-size: 10px;
}
.withdraw-btn {
  width: 100%;
}
@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  .detail-aside {
    position: static;
  }
  .flow {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .flow-step {
    border-right: none;
  }
}
</style>