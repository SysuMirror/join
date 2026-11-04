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
})
</script>
