<template>
  <div class="page">
    <div class="bg-scene" aria-hidden="true">
      <span class="orb orb-a" />
      <span class="orb orb-b" />
      <div class="grid-lines" />
    </div>

    <div class="auth-wrap">
      <RouterLink class="back-home" to="/">← 返回职位列表</RouterLink>

      <div class="card panel auth-card reveal in">
        <div class="auth-logo"><i /></div>
        <h1 class="auth-title">登录</h1>
        <p class="auth-sub">用你的邮箱登录，管理招聘职位与投递审核。</p>

        <form @submit.prevent="onLogin" class="fields">
          <div class="field full">
            <label>邮箱</label>
            <input v-model="email" type="email" placeholder="you@example.com" required autocomplete="email" />
          </div>

          <div class="field full">
            <label>验证码</label>
            <div class="code-row">
              <input v-model="code" type="text" inputmode="numeric" maxlength="6" placeholder="6 位验证码" required />
              <button type="button" class="btn btn-ghost code-btn" @click="sendCode" :disabled="sending || countdown > 0">
                {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
              </button>
            </div>
          </div>

          <p v-if="error" class="error full">{{ error }}</p>

          <div class="field full">
            <button class="btn btn-primary btn-block" type="submit" :disabled="busy || sending">
              {{ busy ? '登录中…' : '登录' }}
            </button>
          </div>
        </form>

        <div class="sso-row">
          <span class="sso-line" />
          <span class="sso-text">或</span>
          <span class="sso-line" />
        </div>
        <button class="btn btn-ghost btn-block" @click="ssoLogin" :disabled="!ssoEnabled">使用集市账号登录（SSO）</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const email = ref(localStorage.getItem('join_login_email') || '')
const code = ref('')
const error = ref('')
const sending = ref(false)
const busy = ref(false)
const countdown = ref(0)
const ssoEnabled = ref(false)
let timer: number | undefined

let auto = false
async function attemptAutoLogin() {
  if (auto) return
  auto = true
  try {
    const token = localStorage.getItem('join_session_token')
    if (token) {
      const user = await api.me(token)
      if (user?.is_admin) {
        router.replace('/admin')
        return
      }
    }
  } catch {
    /* not logged in */
  } finally {
    auto = false
  }
}

async function sendCode() {
  error.value = ''
  const e = email.value.trim()
  if (!e) {
    error.value = '请先输入邮箱'
    return
  }
  sending.value = true
  try {
    await api.sendCode(e)
    localStorage.setItem('join_login_email', e)
    error.value = '验证码已发送（若未收到，请检查 SMTP 是否配置）'
    startCountdown()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
  } finally {
    sending.value = false
  }
}

function startCountdown() {
  countdown.value = 60
  if (timer) window.clearInterval(timer)
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) window.clearInterval(timer)
  }, 1000)
}

async function onLogin() {
  error.value = ''
  const e = email.value.trim()
  const c = code.value.trim()
  if (!e || !/^\d{6}$/.test(c)) {
    error.value = '请输入邮箱与 6 位验证码'
    return
  }
  busy.value = true
  try {
    const r = await api.login(e, c)
    localStorage.setItem('join_session_token', r.token)
    localStorage.setItem('join_login_email', e)
    if (r.user?.is_admin) router.replace('/admin')
    else router.replace('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    busy.value = false
  }
}

function ssoLogin() {
  error.value = ssoEnabled.value ? '' : 'SSO 登录暂未启用，先使用邮箱验证码登录'
}

onMounted(attemptAutoLogin)
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  overflow-x: hidden;
  padding: 24px;
}
.bg-scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.grid-lines {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(circle at 50% 40%, #000 0%, transparent 70%);
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.6;
}
.orb-a {
  width: 420px;
  height: 420px;
  background: #5b8cff;
  top: -60px;
  left: -60px;
  animation: pulseGlow 10s ease-in-out infinite;
}
.orb-b {
  width: 380px;
  height: 380px;
  background: #9b5bff;
  bottom: -60px;
  right: -60px;
  animation: pulseGlow 12s ease-in-out infinite;
  animation-delay: 2s;
}

.auth-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
}
.back-home {
  display: inline-block;
  color: var(--ink-soft);
  font-size: 13px;
  margin-bottom: 18px;
  transition: color 0.2s ease;
}
.back-home:hover {
  color: #fff;
}
.auth-card {
  padding: 40px;
  background: linear-gradient(180deg, rgba(20, 27, 54, 0.9), rgba(12, 17, 38, 0.94));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glow);
}
.auth-logo {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: var(--grad);
  display: grid;
  place-items: center;
  margin-bottom: 22px;
  box-shadow: 0 10px 34px rgba(91, 140, 255, 0.4);
}
.auth-logo i {
  width: 18px;
  height: 18px;
  background: #06101f;
  border-radius: 6px;
  transform: rotate(45deg);
}
.auth-title {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.auth-sub {
  color: var(--ink-soft);
  font-size: 14px;
  margin: 0 0 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.field.full {
  grid-column: 1 / -1;
}
.field label {
  margin-bottom: 6px;
}
.code-row {
  display: flex;
  gap: 10px;
}
.code-row input {
  flex: 1;
}
.code-btn {
  flex: none;
  min-width: 120px;
}
.btn-block {
  width: 100%;
  border-radius: 12px;
}
.sso-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 14px;
  color: var(--ink-faint);
}
.sso-line {
  flex: 1;
  height: 1px;
  background: var(--line);
}
.sso-text {
  font-size: 12px;
}
.error {
  grid-column: 1 / -1;
  text-align: center;
  margin: 0;
}
.error.full {
  margin: 4px 0 0;
}
@media (max-width: 480px) {
  .auth-card {
    padding: 28px;
  }
}
</style>
