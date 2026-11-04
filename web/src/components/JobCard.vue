<template>
  <RouterLink :to="`/jobs/${job.slug}`" class="job-card">
    <div class="job-card-main">
      <div class="job-card-title-row">
        <h3 class="job-card-title">{{ job.title }}</h3>
        <span class="badge" :class="typeClass(job.type)">{{ typeLabel(job.type) }}</span>
      </div>
      <p v-if="job.summary" class="job-card-summary">{{ job.summary }}</p>
      <div class="job-card-meta">
        <span>{{ job.department || '未分组' }}</span>
        <span class="dot-sep" />
        <span>{{ job.location || '线上' }}</span>
        <template v-if="job.experience">
          <span class="dot-sep" />
          <span>对象：{{ job.experience }}</span>
        </template>
        <template v-if="job.education">
          <span class="dot-sep" />
          <span>年级：{{ job.education }}</span>
        </template>
        <template v-if="job.salary">
          <span class="dot-sep" />
          <span>时间投入：{{ job.salary }}</span>
        </template>
        <template v-if="job.headcount">
          <span class="dot-sep" />
          <span>招募 {{ job.headcount }} 人</span>
        </template>
      </div>
      <div v-if="tags.length" class="job-tags">
        <span v-for="t in tags" :key="t" class="tag">{{ t }}</span>
      </div>
    </div>
    <span class="job-card-arrow" aria-hidden="true">→</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Job } from '../api'
import { typeClass, typeLabel } from '../utils/labels'

const props = defineProps<{ job: Job }>()
const tags = computed(() => (props.job.tags || []).slice(0, 5))
</script>
