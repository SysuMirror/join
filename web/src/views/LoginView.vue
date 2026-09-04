<template>
  <div class="page">
    <div class="card panel auth-card">
      <h1 class="page-title">登录</h1>
      <p class="page-sub">用你的邮箱登录，管理招聘职位与投递审核。</p>

      <form @submit.prevent="onLogin" class="fields">
        <div class="field">
          <label>邮箱</label>
          <input
            v-model="email"
            type="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="field">
          <label>验证码</label>
          <div class="code-row">
            <input
              v-model="code"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="6 位验证码"
              required
            />
            <button
              type="button"
              class="btn btn-ghost"
              @click="sendCode"
              :disabled="sending || countdown > 0"
            >
              {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
            </button>
          </div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn btn-primary" type="submit" :disabled="busy || sending">
          {{ busy ? '登录中…' : '登录' }}
        </button>
      </form>

      <div class="sso-row">
        <span class="muted small">或</span>
        <button class="btn btn-ghost" @click="ssoLogin" :disabled="!ssoEnabled">
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
    /* 未登录则正常展示登录页 */
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
    if (r.user?.is_admin) {
      router.replace('/admin')
    } else {
      router.replace('/')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    busy.value = false
  }
}

function ssoLogin() {
  // SSO 未启用时点按钮仅提示；后续接 SSE Market
  error.value = ssoEnabled.value ? '' : 'SSO 登录暂未启用，先使用邮箱验证码登录'
}

onMounted(attemptAutoLogin)
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<style scoped>
.page {
  min-height: 80vh;
  display: grid;
  place-items: center;
  background: var(--bg);
}
.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 28px;
}
.code-row {
  display: flex;
  gap: 8px;
}
.code-row input {
  flex: 1;
}
.sso-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  justify-content: center;
}
</style>
