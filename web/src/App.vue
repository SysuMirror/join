<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuth } from './stores/auth'
import { useSiteStore } from './stores/site'

onMounted(() => {
  useAuth().ensure()
  useSiteStore().ensure()
  // 首屏即发起静默 SSO：管理员冷启动落在任何页面（含公开页）都能免刷新登录；
  // 路由守卫与登录页共享同一次请求（store 内单飞），不会重复打 sso/try。
  void useAuth().probeSharedSso()
})
</script>
