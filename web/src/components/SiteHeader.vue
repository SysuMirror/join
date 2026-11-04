<template>
  <header class="site-header">
    <div class="site-header-inner">
      <RouterLink class="site-brand" to="/">
        <img class="site-logo" src="/logo.png" alt="logo" />
        <span class="site-brand-name">{{ site?.brand || '软工集市' }}</span>
      </RouterLink>

      <nav class="site-nav">
        <RouterLink to="/" exact-active-class="active">首页</RouterLink>
        <RouterLink to="/jobs" active-class="active">部门岗位</RouterLink>
        <RouterLink to="/teams" active-class="active">公示</RouterLink>
        <RouterLink to="/faq" active-class="active">常见问题</RouterLink>
        <RouterLink v-if="isStaff" to="/admin" active-class="active">管理后台</RouterLink>
      </nav>

      <div class="site-actions">
        <template v-if="authState.user">
          <div ref="menuRef" class="user-menu">
            <button
              type="button"
              class="user-chip"
              :aria-expanded="menuOpen"
              aria-haspopup="menu"
              title="账号菜单"
              @click="menuOpen = !menuOpen"
            >
              <img
                v-if="authState.user.avatar"
                class="user-avatar-img"
                :src="authState.user.avatar"
                alt=""
              />
              <span v-else class="user-avatar">{{ initial }}</span>
              <span class="user-name">{{ authState.user.name || authState.user.email }}</span>
              <span class="user-caret" :class="{ open: menuOpen }">▾</span>
            </button>
            <div v-if="menuOpen" class="user-dropdown" role="menu">
              <RouterLink to="/me" role="menuitem" @click="menuOpen = false">个人主页</RouterLink>
              <RouterLink
                :to="{ path: '/me', query: { tab: 'applications' } }"
                role="menuitem"
                @click="menuOpen = false"
              >
                我的报名
              </RouterLink>
              <RouterLink v-if="isStaff" to="/admin" role="menuitem" @click="menuOpen = false">
                管理后台
              </RouterLink>
              <button type="button" class="user-menu-logout" role="menuitem" @click="onLogout">
                退出登录
              </button>
            </div>
          </div>
        </template>
        <RouterLink v-else class="btn btn-primary btn-sm" :to="loginTo">登录</RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { useSiteStore } from '../stores/site'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const authState = auth.state
const isStaff = auth.isStaff
const siteState = useSiteStore().state
const site = computed(() => siteState.site)
const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const isIdentityActive = computed(
  () => route.path === '/me' && route.query.tab !== 'applications',
)
const isApplicationsActive = computed(
  () => route.path === '/me' && route.query.tab === 'applications',
)
const isAdminActive = computed(() => route.path.startsWith('/admin'))

function onDocumentClick(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

const initial = computed(() => {
  const name = authState.user?.name || authState.user?.email || '?'
  return name.slice(0, 1).toUpperCase()
})

const loginTo = computed(() => {
  if (route.path === '/' || route.path === '/login') return { path: '/login' }
  return { path: '/login', query: { redirect: route.fullPath } }
})

async function onLogout() {
  menuOpen.value = false
  await auth.logout()
  if (route.meta.requiresAuth || route.meta.requiresAdmin) {
    router.push('/')
  } else {
    router.push({ path: route.path, query: { ...route.query, loggedout: '1' } })
  }
}
</script>
