<template>
  <div class="page">
    <SiteHeader />
    <main class="notfound">
      <p class="code">404</p>
      <h1>页面不存在</h1>
      <p class="desc">你访问的页面可能已被移动或删除。</p>
      <div class="actions">
        <RouterLink class="btn btn-primary" to="/">返回首页</RouterLink>
        <RouterLink class="btn btn-ghost" to="/jobs">浏览部门岗位</RouterLink>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.notfound {
  max-width: 640px;
  margin: 0 auto;
  padding: 110px 24px 90px;
  text-align: center;
}
.code {
  margin: 0;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.16em;
}
h1 {
  margin: 14px 0 10px;
  font-size: clamp(30px, 5vw, 44px);
  font-weight: 800;
  letter-spacing: -0.03em;
}
.desc {
  margin: 0 0 28px;
  color: var(--ink-soft);
  font-size: 14px;
}
.actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
