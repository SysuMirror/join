<template>
  <div class="page">
    <SiteHeader />

    <main class="page-main defense-main">
      <button class="back-link" @click="router.back()">← 返回</button>

      <header class="defense-head">
        <div>
          <p class="eyebrow">技术部（圆桌）答辩</p>
          <h1 class="page-title">发起答辩</h1>
          <p class="page-sub">
            由部门内部成员发起。一级由本部门负责人陈述事实（回避打分），二级由其他 2-3 个部门负责人交叉评审，三级由学院/外院资源方代表评估资源分配主张。
          </p>
        </div>
        <span v-if="profile" class="badge" :class="levelClass(profile.developer_level)">
          {{ profile.level_label }}
        </span>
      </header>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <div v-if="loading" class="defense-loading">加载中…</div>

      <template v-else-if="profile">
        <div v-if="blockedReason" class="card blocked-card">
          <h2>暂时不能发起答辩</h2>
          <p>{{ blockedReason }}</p>
          <div class="blocked-actions">
            <RouterLink v-if="profile.developer_level === 'market'" class="btn btn-primary" to="/jobs">
              去投递部门
            </RouterLink>
            <RouterLink class="btn btn-ghost" to="/me?tab=identity">查看个人主页</RouterLink>
          </div>
        </div>

        <form v-else class="defense-layout" @submit.prevent="submit">
          <div class="card form-card">
            <section class="form-section">
              <div class="section-title-row">
                <h2>答辩信息</h2>
                <span class="badge badge-blue">{{ profile.department?.name }}</span>
              </div>
              <div class="fields">
                <div class="field full">
                  <label>答辩标题（选填）</label>
                  <input v-model="form.title" maxlength="100" :placeholder="defaultTitle" />
                </div>
                <div class="field full">
                  <label>个人陈述 *</label>
                  <textarea
                    v-model="form.statement"
                    rows="6"
                    required
                    placeholder="你做过什么、承担了什么、为什么申请进入技术部。请尽量用事实和产出说话。"
                  />
                  <span class="hint">{{ form.statement.length }} / 8000</span>
                </div>
                <div class="field full">
                  <label>产出与贡献（选填，但建议填写）</label>
                  <textarea
                    v-model="form.achievements"
                    rows="4"
                    placeholder="交付了哪些产品/模块、使用量、协作与出人贡献、社区活跃情况等。"
                  />
                </div>
              </div>
            </section>

            <section class="form-section proposal-section">
              <div class="section-title-row">
                <h2>答辩核心</h2>
                <span class="badge badge-amber">必答</span>
              </div>
              <p class="proposal-question">你进入技术部后，主张如何帮助学院更好分配资源？</p>
              <textarea
                v-model="form.proposal"
                class="proposal-input"
                rows="8"
                required
                placeholder="请给出具体主张：资源包括什么、现在的问题是什么、你会如何评估与分配、如何让各部门与同学受益。"
              />
              <div class="proposal-foot">
                <span class="hint">至少 30 字</span>
                <span class="hint">{{ form.proposal.length }} / 8000</span>
              </div>
            </section>

            <p v-if="formError" class="notice notice-error">{{ formError }}</p>

            <div class="form-actions">
              <button class="btn btn-primary btn-lg" type="submit" :disabled="submitting">
                {{ submitting ? '提交中…' : '提交答辩' }}
              </button>
              <RouterLink class="btn btn-ghost btn-lg" to="/me?tab=identity">取消</RouterLink>
            </div>
          </div>

          <aside class="defense-aside">
            <div class="card aside-card">
              <h3>评审流程</h3>
              <ol class="aside-steps">
                <li>
                  <b>一级 · 本部门负责人</b>
                  <span>陈述事实，回避打分。记录你的投入、产出与协作情况。</span>
                </li>
                <li>
                  <b>二级 · 其他 2-3 个部门负责人</b>
                  <span>交叉评审，防止小圈子。综合产出与资源分配主张投票。</span>
                </li>
                <li>
                  <b>三级 · 学院/外院资源方代表</b>
                  <span>评估你的资源分配主张，判断是否具备进入圆桌的条件。</span>
                </li>
                <li>
                  <b>席位裁决</b>
                  <span>通过后按本部门「保底 + 浮动」席位进入圆桌；满员进入候补队列。</span>
                </li>
              </ol>
            </div>

            <div class="card aside-card">
              <h3>部门席位</h3>
              <div v-if="profile.seat" class="seat-summary">
                <div><b>{{ profile.seat.occupied }}/{{ profile.seat.total }}</b><span>已占席位</span></div>
                <div><b>{{ profile.seat.available }}</b><span>可用席位</span></div>
                <div><b>{{ profile.seat.waitlist }}</b><span>候补人数</span></div>
              </div>
              <p class="hint">席位已满时，答辩仍可进行；通过后进入候补，席位释放时自动递补。</p>
            </div>
          </aside>
        </form>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type MyDeveloperProfile } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { levelClass } from '../utils/labels'

const router = useRouter()
const profile = ref<MyDeveloperProfile | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const formError = ref('')

const form = reactive({
  title: '',
  statement: '',
  proposal: '',
  achievements: '',
})

const defaultTitle = computed(() => {
  const p = profile.value
  return `${new Date().getFullYear()} 技术部答辩 · ${p?.name || ''}`
})

const blockedReason = computed(() => {
  const p = profile.value
  if (!p) return ''
  if (p.status !== 'active') return '账号已退出开发者体系。'
  if (p.developer_level === 'roundtable') return '你已经是圆桌开发者（技术部成员）。'
  if (p.developer_level !== 'project') return '需先通过部门双选成为项目开发者，才能发起技术部答辩。'
  if (!p.department) return '尚未归属任何部门，请先完成部门双选。'
  const active = p.defenses.find((d) =>
    ['submitted', 'level1', 'level2', 'level3', 'waitlist'].includes(d.status),
  )
  if (active) return `你已有一场进行中的答辩（#${active.id}）。`
  return ''
})

async function submit() {
  formError.value = ''
  if (form.statement.trim().length < 10) {
    formError.value = '请至少填写一段个人陈述'
    return
  }
  if (form.proposal.trim().length < 30) {
    formError.value = '答辩核心主张至少 30 字'
    return
  }
  submitting.value = true
  try {
    const d = await api.createDefense({
      title: form.title.trim() || undefined,
      statement: form.statement.trim(),
      proposal: form.proposal.trim(),
      achievements: form.achievements.trim(),
    })
    router.push(`/defenses/${d.id}`)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '提交失败'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    profile.value = await api.myDeveloper()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.defense-main {
  max-width: 1040px;
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
  margin-bottom: 22px;
}
.eyebrow {
  margin: 0 0 8px;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.defense-loading {
  padding: 80px 0;
  text-align: center;
  color: var(--ink-soft);
}
.blocked-card {
  padding: 30px;
}
.blocked-card h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.blocked-card p {
  margin: 0 0 18px;
  color: var(--ink-soft);
  font-size: 13px;
}
.blocked-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.defense-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}
.form-card {
  padding: 24px;
}
.form-section + .form-section {
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.section-title-row h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.02em;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.field.full {
  grid-column: 1 / -1;
}
.hint {
  color: var(--ink-faint);
  font-size: 11px;
}
.proposal-section {
  background: transparent;
  border: none;
  border-top: 1px solid var(--line);
  padding: 18px 0 0;
  border-radius: 0;
}
.proposal-question {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.6;
}
.proposal-input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  background: #fff;
  outline: none;
  font-size: 13px;
  line-height: 1.8;
  resize: vertical;
}
.proposal-input:focus {
  border-color: var(--ink);
}
.proposal-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
}
.form-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.defense-aside {
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
.aside-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
  counter-reset: step;
}
.aside-steps li {
  position: relative;
  padding-left: 26px;
}
.aside-steps li::before {
  counter-increment: step;
  content: counter(step);
  position: absolute;
  left: 0;
  top: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  display: grid;
  place-items: center;
  font-family: var(--mono);
  font-size: 10px;
}
.aside-steps b {
  display: block;
  font-size: 12px;
  margin-bottom: 3px;
}
.aside-steps span {
  color: var(--ink-soft);
  font-size: 11px;
  line-height: 1.6;
}
.seat-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
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
@media (max-width: 900px) {
  .defense-layout {
    grid-template-columns: 1fr;
  }
  .defense-aside {
    position: static;
  }
}
@media (max-width: 640px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>