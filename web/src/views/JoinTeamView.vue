<template>
  <div class="page">
    <SiteHeader />

    <main class="join-main">
      <header class="join-head">
        <div class="eyebrow">
          <span class="eyebrow-line" />
          <span>Join the team</span>
        </div>
        <h1 class="join-title">加入软工集市团队</h1>
        <p class="join-sub">
          还不确定想去哪个部门？先加入软工集市团队，完成基本信息后即可自动成为开发者。
        </p>
      </header>

      <div v-if="loading" class="join-loading">加载中…</div>

      <template v-else>
        <p v-if="error" class="notice notice-error">{{ error }}</p>
        <p v-if="notice" class="notice notice-success">{{ notice }}</p>

        <section v-if="!authState.user" class="join-card">
          <div class="join-step-head">
            <span class="join-step-no">1</span>
            <div>
              <h2>先登录</h2>
              <p>使用集市统一身份登录，无需重复注册。</p>
            </div>
          </div>
          <RouterLink class="btn btn-primary" :to="loginTo">登录后继续</RouterLink>
        </section>

        <template v-else>
          <div v-if="status?.sso_developer" class="join-card join-done">
            <div class="done-mark">✓</div>
            <div>
              <h2>你已经是软工集市开发者</h2>
              <p>开发者身份已同步到统一身份，可以去看看有哪些部门岗位。</p>
            </div>
            <div class="join-actions">
              <RouterLink class="btn btn-primary" to="/jobs">浏览部门岗位</RouterLink>
              <RouterLink class="btn btn-ghost" to="/me">个人主页</RouterLink>
            </div>
          </div>

          <template v-else>
            <section class="join-card">
              <div class="join-step-head">
                <span class="join-step-no" :class="{ done: Boolean(status?.resume_id) }">
                  {{ status?.resume_id ? '✓' : '2' }}
                </span>
                <div>
                  <h2>完善基本信息</h2>
                  <p v-if="!status?.resume_id">你还没有简历，先创建一份。</p>
                  <p v-else-if="status.missing_fields.length">还差：{{ status.missing_fields.join('、') }}</p>
                  <p v-else>简历信息已完整，可以继续加入。</p>
                </div>
              </div>

              <div v-if="!status?.resume_id" class="join-actions">
                <RouterLink class="btn btn-primary" :to="resumeNewTo">创建简历</RouterLink>
              </div>
              <div v-else-if="status.missing_fields.length" class="join-actions">
                <RouterLink class="btn btn-primary" :to="resumeEditTo">完善简历</RouterLink>
                <RouterLink class="btn btn-ghost" :to="resumeNewTo">新建另一份</RouterLink>
              </div>
            </section>

            <section class="join-card" :class="{ muted: !status?.ready }">
              <div class="join-step-head">
                <span class="join-step-no" :class="{ done: status?.ready }">3</span>
                <div>
                  <h2>加入软工集市团队</h2>
                  <p>
                    加入后会同步在统一身份中标记为开发者，可用于集市开发者资源与后续部门选择。
                  </p>
                </div>
              </div>
              <div class="join-actions">
                <button
                  class="btn btn-primary"
                  :disabled="!status?.ready || joining"
                  @click="join"
                >
                  {{ joining ? '正在开通…' : '加入软工集市团队' }}
                </button>
                <span v-if="!status?.ready" class="join-hint">先完善上面的信息，按钮就会亮起。</span>
              </div>
            </section>
          </template>
        </template>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type JoinTeamStatus } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuth } from '../stores/auth'

const route = useRoute()
const auth = useAuth()
const authState = auth.state

const loading = ref(true)
const joining = ref(false)
const error = ref('')
const notice = ref('')
const status = ref<JoinTeamStatus | null>(null)

const loginTo = computed(() => ({
  path: '/login',
  query: { redirect: route.fullPath },
}))
const resumeNewTo = computed(() => ({
  path: '/me/resumes/new',
  query: { redirect: '/join-team' },
}))
const resumeEditTo = computed(() => ({
  path: status.value?.resume_id ? `/me/resumes/${status.value.resume_id}` : '/me/resumes/new',
  query: { redirect: '/join-team' },
}))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const user = await auth.ensure()
    if (!user) return
    status.value = await api.myJoinTeamStatus()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function join() {
  if (!status.value?.ready || joining.value) return
  joining.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await api.joinTeam({ resume_id: status.value.resume_id })
    status.value = { ...status.value, sso_developer: true }
    notice.value = '你已成为软工集市开发者'
    if (res?.identity) auth.setUser({ ...authState.user!, ...res.identity })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '开通失败，请稍后重试'
  } finally {
    joining.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.join-main {
  max-width: 760px;
  margin: 0 auto;
  padding: 56px 24px 72px;
}
.join-head {
  margin-bottom: 30px;
}
.join-title {
  margin: 18px 0 12px;
  font-size: clamp(30px, 5vw, 44px);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.12;
}
.join-sub {
  margin: 0;
  max-width: 620px;
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1.8;
}
.join-loading {
  padding: 60px 0;
  color: var(--ink-soft);
  font-size: 14px;
}
.join-card {
  padding: 22px 0;
  border-top: 1px solid var(--line);
}
.join-card:last-child {
  border-bottom: 1px solid var(--line);
}
.join-card.muted {
  opacity: 0.7;
}
.join-step-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.join-step-no {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--ink-faint);
  font-size: 11px;
  font-weight: 700;
}
.join-step-no.done {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}
.join-step-head h2 {
  margin: 1px 0 6px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.join-step-head p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.75;
}
.join-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-left: 40px;
}
.join-hint {
  color: var(--ink-faint);
  font-size: 12px;
}
.join-done {
  border-top: none;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.done-mark {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}
.join-done h2 {
  margin: 2px 0 6px;
  font-size: 18px;
}
.join-done p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
}
.join-done .join-actions {
  flex-basis: 100%;
}
@media (max-width: 640px) {
  .join-main {
    padding: 36px 18px 56px;
  }
  .join-actions {
    padding-left: 0;
    align-items: stretch;
  }
  .join-actions .btn {
    flex: 1 1 100%;
  }
  .join-title {
    font-size: 31px;
  }
}
</style>