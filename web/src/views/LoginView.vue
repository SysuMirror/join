<template>
  <div class="auth-page">
    <RouterLink class="back-home" to="/">← 返回首页</RouterLink>

    <div class="auth-card">
      <div class="auth-head">
        <img class="logo-img" src="/logo.png" alt="logo" />
        <span class="auth-brand">{{ site?.brand || '软工集市' }}</span>
        <h1 class="auth-title">登录</h1>
        <p class="auth-sub">使用集市统一身份登录。首次登录自动获得「软工集市开发者」身份，可投递部门、发起技术部答辩。</p>
      </div>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <p v-else-if="notice" class="notice notice-success">{{ notice }}</p>

      <button
        class="btn btn-primary btn-lg btn-block sso-btn"
        :disabled="ssoBusy || Boolean(site && !site.ssoEnabled)"
        @click="ssoLogin"
      >
        <span class="sso-icon">↗</span>
        {{ ssoBusy ? '正在跳转…' : '使用集市统一身份登录' }}
      </button>
      <p v-if="site && !site.ssoEnabled" class="sso-disabled">
        统一身份登录尚未配置。请联系管理员在 UniSSO 注册应用后启用。
      </p>
      <p v-else class="sso-hint">将跳转到 sso.ssemarket.cn 完成授权，首次登录自动创建账号并授予开发者身份。</p>

      <div class="divider">
        <span class="divider-line" />
        <button class="divider-toggle" type="button" @click="adminOpen = !adminOpen">
          {{ adminOpen ? '收起管理员登录' : '管理员登录' }}
        </button>
        <span class="divider-line" />
      </div>

      <form v-if="adminOpen" class="admin-form" @submit.prevent="onLogin">
        <div class="field">
          <label>管理员邮箱</label>
          <input
            v-model="email"
            type="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>
        <div class="field">
          <label>密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="账号密码"
            required
            autocomplete="current-password"
          />
        </div>
        <p v-if="adminError" class="notice notice-error">{{ adminError }}</p>
        <p v-if="adminNotice" class="notice notice-success">{{ adminNotice }}</p>
        <button class="btn btn-primary btn-block" type="submit" :disabled="busy">
          {{ busy ? '登录中…' : '登录管理后台' }}
        </button>
        <p class="admin-hint">仅限管理员白名单成员（院内账号）；报名同学请使用上方统一身份登录。</p>
      </form>

      <p class="auth-foot">
        登录即表示同意我们根据部门双选与开发者管理需要处理你的简历信息。遇到问题可联系
        <a :href="`mailto:${site?.contactEmail || 'ssemarket@163.com'}`">
          {{ site?.contactEmail || 'ssemarket@163.com' }}
        </a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { useAuth } from '../stores/auth'
import { useSiteStore } from '../stores/site'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const siteState = useSiteStore().state
const site = computed(() => siteState.site)

const error = ref('')
const notice = ref('')
const ssoBusy = ref(false)

const adminOpen = ref(false)
const email = ref(localStorage.getItem('join_login_email') || '')
const password = ref('')
const busy = ref(false)
const adminError = ref('')
const adminNotice = ref('')

const redirect = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/me'
})

function targetAfterLogin(isStaff: boolean): string {
  if (route.query.redirect) return redirect.value
  return isStaff ? '/admin' : '/me'
}

function ssoLogin() {
  error.value = ''
  if (site.value && !site.value.ssoEnabled) {
    error.value = '统一身份登录尚未配置，请联系管理员'
    return
  }
  // 清除浏览器里可能残留的旧 Bearer token，确保 SSO Cookie 会话生效
  localStorage.removeItem('join_session_token')
  ssoBusy.value = true
  window.location.href = api.ssoStartUrl(redirect.value)
}

async function onLogin() {
  adminError.value = ''
  adminNotice.value = ''
  const e = email.value.trim()
  const p = password.value
  if (!e || !p) {
    adminError.value = '请输入邮箱与密码'
    return
  }
  busy.value = true
  try {
    const r = await api.login(e, p)
    localStorage.setItem('join_session_token', r.token)
    localStorage.setItem('join_login_email', e)
    auth.setUser(r.user)
    router.replace(targetAfterLogin(Boolean(r.user?.is_admin || r.user?.is_staff)))
  } catch (e) {
    adminError.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await useSiteStore().ensure(true)
  const qError = route.query.error
  if (typeof qError === 'string' && qError) error.value = qError
  const user = await auth.ensure()
  if (user) {
    router.replace(targetAfterLogin(Boolean(user.is_admin || user.is_staff)))
    return
  }
  // 静默 SSO：父域已有管理员登录态时直接进后台；无 Cookie / 非管理员 /
  // 服务不可用都静默保持表单（probe 每次页面加载只跑一次）
  const probe = await auth.probeSharedSso()
  if (probe === 'ok') {
    const u = auth.user.value
    if (u) {
      router.replace(targetAfterLogin(Boolean(u.is_admin || u.is_staff)))
    }
  }
})
</script>

<style scoped>
.auth-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 48px 24px;
  background: var(--bg);
}
.back-home {
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 2;
  color: var(--ink-soft);
  font-size: 13px;
}
.back-home:hover {
  color: var(--ink);
}
.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
}
.auth-head {
  margin-bottom: 24px;
}
.logo-img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  display: block;
  margin-bottom: 12px;
}
.auth-brand {
  display: block;
  color: var(--ink-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-bottom: 14px;
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
  font-size: 13px;
  line-height: 1.7;
}
.sso-btn {
  margin-top: 18px;
}
.sso-icon {
  font-size: 15px;
}
.sso-hint,
.sso-disabled {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-faint);
}
.sso-disabled {
  color: var(--ink-soft);
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 22px 0 4px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: var(--line);
}
.divider-toggle {
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 12px;
}
.divider-toggle:hover {
  color: var(--ink);
}
.admin-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
}
.admin-hint {
  margin: 0;
  color: var(--ink-faint);
  font-size: 11px;
  line-height: 1.6;
}
.auth-foot {
  margin: 22px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 11px;
  line-height: 1.7;
}
.auth-foot a {
  color: var(--ink-soft);
}
.auth-foot a:hover {
  color: var(--ink);
}
</style>
