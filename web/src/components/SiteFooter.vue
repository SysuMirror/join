<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <RouterLink class="footer-logo" to="/">
          <img src="/logo.png" alt="logo" />
          <span>{{ site?.brand || '软工集市' }}</span>
        </RouterLink>
        <p class="footer-tagline">{{ site?.tagline || '和一群热爱技术的人，一起把想法做出来' }}</p>
      </div>

      <div class="footer-links">
        <RouterLink to="/jobs">部门岗位</RouterLink>
        <RouterLink to="/faq">常见问题</RouterLink>
        <a href="https://ssemarket.cn" target="_blank" rel="noopener">集市主页 ↗</a>
      </div>

      <div class="footer-meta">
        <a class="footer-mail" :href="`mailto:${site?.contactEmail || 'ssemarket@163.com'}`">
          {{ site?.contactEmail || 'ssemarket@163.com' }}
        </a>
        <span>© {{ year }} {{ site?.brand || '软工集市' }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '../stores/auth'
import { useSiteStore } from '../stores/site'

const siteState = useSiteStore().state
const site = computed(() => siteState.site)
const authState = useAuth().state
const year = new Date().getFullYear()
</script>
