<template>
  <div class="page">
    <SiteHeader />

    <main class="join-main">
      <header class="join-head">
        <div class="eyebrow">
          <span class="eyebrow-line" />
          <span>Developer access</span>
        </div>
        <h1 class="join-title">开发者身份</h1>
        <p class="join-sub">
          使用集市统一身份登录后，系统会自动为你开通软工集市开发者权限，不需要再单独申请加入团队。
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
              <p>使用集市统一身份登录，登录成功后开发者权限自动开通。</p>
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

          <section v-else class="join-card">
            <div class="join-step-head">
              <span class="join-step-no">!</span>
              <div>
                <h2>开发者权限暂未开通</h2>
                <p>
                  正常登录时会自动开通，这里显示未开通通常是统一身份服务暂时不可用。
                  可以点下面的按钮重试，不需要再填写或完善其他资料。
                </p>
              </div>
            </div>
            <div class="join-actions">
              <button class="btn btn-primary" :disabled="joining" @click="join">
                {{ joining ? '正在开通…' : '重试开通' }}
              </button>
              <span class="join-hint">多次失败请联系管理员。</span>
            </div>
          </section>
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
  if (joining.value) return
  joining.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await api.joinTeam()
    status.value = { ...(status.value ?? { ready: true, resume_id: 0, missing_fields: [], sso_developer: false, sso_developer_at: '', email: '' }), sso_developer: true }
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