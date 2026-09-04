<template>
  <div class="page">
    <div class="scene" aria-hidden="true">
      <div class="grid" />
    </div>

    <div class="auth-wrap">
      <RouterLink class="back-home" to="/">← 返回职位列表</RouterLink>

      <div class="auth-card reveal in">
        <div class="auth-head">
          <img class="logo-img" src="/logo.png" alt="logo" />
          <h1 class="auth-title">登录</h1>
          <p class="auth-sub">用你的邮箱登录，管理招聘职位与投递审核。</p>
        </div>

        <form @submit.prevent="onLogin">
          <div class="field">
            <label>邮箱</label>
            <input v-model="email" type="email" placeholder="you@example.com" required autocomplete="email" />
          </div>

          <div class="field">
            <label>验证码</label>
            <div class="code-row">
              <input v-model="code" type="text" inputmode="numeric" maxlength="6" placeholder="6 位验证码" required />
              <button type="button" class="btn btn-ghost code-btn" @click="sendCode" :disabled="sending || countdown > 0">
                {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
              </button>
            </div>
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <button class="btn btn-primary btn-block" type="submit" :disabled="busy || sending">
            {{ busy ? '登录中…' : '登录' }}
          </button>
        </form>

        <div class="sso-row">
          <span class="sso-line" />
          <span class="sso-text">或</span>
          <span class="sso-line" />
        </div>
        <button class="btn btn-ghost btn-block" @click="ssoLogin" :disabled="!ssoEnabled">
          使用集市账号登录（SSO）
        </button>
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
  padding: 24px;
  background: var(--bg);
}
.scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(31, 35, 41, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 35, 41, 0.028) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 10%, transparent 75%);
}

.auth-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
}
.back-home {
  display: inline-block;
  color: var(--ink-soft);
  font-size: 13px;
  margin-bottom: 16px;
  transition: color 0.15s ease;
}
.back-home:hover {
  color: var(--brand);
}
.auth-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lift);
  padding: 36px;
  animation: fadeUp 0.5s var(--ease);
}
.auth-head {
  margin-bottom: 26px;
}
.logo-img {
  width: 44px;
  height: 44px;
  object-fit: contain;
  display: block;
  margin-bottom: 18px;
}
.auth-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.auth-sub {
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.6;
}

form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 8px;
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
  min-width: 116px;
}
.btn-block {
  width: 100%;
}

.sso-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 12px;
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
</style>
