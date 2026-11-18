<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuth } from './stores/auth'
import { useSiteStore } from './stores/site'

onMounted(async () => {
  useSiteStore().ensure()
  const user = await useAuth().ensure()
  // 仅在「本地没有会话」时尝试静默 SSO（冷启动免刷新登录）。
  // 已登录时不再打 sso/try：本地 HttpOnly 会话已经足够，避免探测失败反过来影响登录态，
  // 也避免每次页面加载都消耗一次 /sso/try 的限流额度。
  if (!user) void useAuth().probeSharedSso()
})
</script>
