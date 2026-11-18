<template>
  <div class="md-doc" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '../utils/markdown'

const props = defineProps<{ content: string }>()
const html = computed(() => renderMarkdown(props.content))
</script>

<style scoped>
.md-doc {
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1.95;
  letter-spacing: 0.002em;
  word-break: break-word;
}

.md-doc :deep(p) {
  margin: 0 0 18px;
}

.md-doc :deep(p:last-child) {
  margin-bottom: 0;
}

.md-doc :deep(h3),
.md-doc :deep(h4),
.md-doc :deep(h5),
.md-doc :deep(h6) {
  color: var(--ink);
  letter-spacing: -0.015em;
  line-height: 1.4;
  margin: 34px 0 12px;
}

.md-doc :deep(h3) {
  font-size: 21px;
  font-weight: 750;
}

.md-doc :deep(h4) {
  font-size: 17px;
  font-weight: 700;
}

.md-doc :deep(h5),
.md-doc :deep(h6) {
  font-size: 15px;
  font-weight: 700;
}

.md-doc :deep(strong) {
  color: var(--ink);
  font-weight: 650;
}

.md-doc :deep(em) {
  font-style: italic;
  color: var(--ink);
}

.md-doc :deep(a) {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgba(23, 23, 23, 0.28);
  transition: text-decoration-color 0.15s ease;
}

.md-doc :deep(a:hover) {
  text-decoration-color: var(--ink);
}

.md-doc :deep(ul),
.md-doc :deep(ol) {
  margin: 0 0 18px;
  padding-left: 22px;
}

.md-doc :deep(li) {
  margin: 6px 0;
  padding-left: 2px;
}

.md-doc :deep(li::marker) {
  color: var(--ink-faint);
}

.md-doc :deep(blockquote) {
  margin: 24px 0;
  padding: 2px 0 2px 20px;
  border-left: 2px solid var(--ink);
}

.md-doc :deep(blockquote p) {
  margin: 0;
  color: var(--ink);
  font-size: 16px;
  line-height: 1.85;
}

.md-doc :deep(code) {
  font-family: var(--mono);
  font-size: 0.88em;
  color: var(--ink);
  background: transparent;
  border-bottom: 1px dotted rgba(23, 23, 23, 0.35);
  padding: 0 1px;
}

.md-doc :deep(pre) {
  margin: 22px 0;
  padding: 16px 18px;
  overflow-x: auto;
  border-left: 2px solid var(--line);
  background: transparent;
}

.md-doc :deep(pre code) {
  border: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink);
}

.md-doc :deep(hr) {
  border: none;
  border-top: 1px solid var(--line);
  margin: 34px 0;
}

.md-doc :deep(.md-table) {
  margin: 22px 0 24px;
  overflow-x: auto;
}

.md-doc :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  line-height: 1.7;
}

.md-doc :deep(th),
.md-doc :deep(td) {
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}

.md-doc :deep(th) {
  color: var(--ink-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.md-doc :deep(tr:last-child td) {
  border-bottom: none;
}
</style>