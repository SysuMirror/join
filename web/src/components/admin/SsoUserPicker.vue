<template>
  <div class="sso-picker">
    <div v-if="modelValue.length" class="selected-list">
      <span v-for="u in modelValue" :key="keyOf(u)" class="selected-chip">
        <span class="chip-avatar">
          <img v-if="u.avatar" :src="u.avatar" :alt="u.name" />
          <span v-else>{{ initial(u.name) }}</span>
        </span>
        <span class="chip-name">{{ u.name }}</span>
        <button type="button" class="chip-remove" aria-label="移除" @click="remove(u)">×</button>
      </span>
      <button type="button" class="clear-all" @click="clearAll">清空</button>
    </div>

    <div class="picker-input-row">
      <input
        v-model="query"
        type="search"
        placeholder="输入姓名 / 邮箱 / 学号 / 开发者编号快速匹配…"
        @focus="onFocus"
        @blur="onBlur"
      />
      <button type="button" class="picker-refresh" :disabled="dir.loading" @click="refresh">
        {{ dir.loading ? '刷新中…' : '刷新目录' }}
      </button>
    </div>

    <p v-if="dir.warning && !dir.users.length" class="sso-warning">{{ dir.warning }}</p>
    <p v-else-if="dir.stale" class="sso-warning">正在使用本地缓存，已后台刷新。</p>

    <template v-if="showList">
      <div class="picker-meta">
        <span class="muted small">
          {{ dir.loading && !dir.users.length ? '正在加载用户目录…' : `找到 ${results.length} 人 · 已选 ${modelValue.length} 人` }}
        </span>
        <button
          v-if="results.length"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="selectAllVisible"
        >
          全选当前结果
        </button>
      </div>
      <div v-if="results.length" class="user-list">
        <button
          v-for="u in results"
          :key="keyOf(u)"
          type="button"
          class="user-row"
          :class="{ selected: isSelected(u), disabled: !u.active || !u.email }"
          :disabled="!u.active || !u.email"
          @mousedown.prevent
          @click="toggle(u)"
        >
          <span class="member-avatar">
            <img v-if="u.avatar" :src="u.avatar" :alt="u.name" />
            <span v-else>{{ initial(u.name) }}</span>
          </span>
          <span class="user-copy">
            <strong>{{ u.name }}</strong>
            <span class="muted small">
              {{ u.email }}<template v-if="u.developer_no"> · {{ u.developer_no }}</template>
              <template v-else-if="u.student_id"> · {{ u.student_id }}</template>
            </span>
          </span>
          <span class="user-badges">
            <span v-if="!u.email" class="badge badge-red">无邮箱</span>
            <span v-else-if="!u.active" class="badge badge-red">未激活</span>
            <span v-else-if="u.registered" class="badge badge-green">已注册</span>
            <span v-else class="badge badge-amber">未注册 · 自动建号</span>
          </span>
          <span class="user-check">{{ isSelected(u) ? '✓' : '' }}</span>
        </button>
      </div>
      <div v-else-if="!dir.loading" class="hint">
        没有找到用户。
        <button type="button" class="text-link" @click="refresh">刷新目录</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { SsoUserSummary } from '../../api'
import { useDirectoryStore } from '../../stores/directory'

const props = defineProps<{
  modelValue: SsoUserSummary[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SsoUserSummary[]): void
}>()

const dir = useDirectoryStore().state
const query = ref('')
const showList = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const results = computed(() =>
  useDirectoryStore().search(query.value, {
    includeUnregistered: true,
    limit: 200,
  }),
)

function keyOf(u: SsoUserSummary): string {
  return u.sso_sub || `local-${u.user_id}`
}

function initial(name: string): string {
  return (name || '?').trim().slice(0, 1).toUpperCase()
}

function onFocus() {
  if (hideTimer) clearTimeout(hideTimer)
  showList.value = true
  void useDirectoryStore().ensure()
}

function onBlur() {
  hideTimer = setTimeout(() => {
    showList.value = false
  }, 180)
}

function refresh() {
  void useDirectoryStore().refresh()
}

function isSelected(u: SsoUserSummary): boolean {
  return props.modelValue.some((x) => keyOf(x) === keyOf(u))
}

function toggle(u: SsoUserSummary) {
  if (!u.active || !u.email) return
  const current = [...props.modelValue]
  const idx = current.findIndex((x) => keyOf(x) === keyOf(u))
  if (idx >= 0) current.splice(idx, 1)
  else current.push(u)
  emit('update:modelValue', current)
}

function remove(u: SsoUserSummary) {
  emit(
    'update:modelValue',
    props.modelValue.filter((x) => keyOf(x) !== keyOf(u)),
  )
}

function clearAll() {
  emit('update:modelValue', [])
}

function selectAllVisible() {
  const current = [...props.modelValue]
  for (const u of results.value) {
    if (!u.active || !u.email) continue
    if (!current.some((x) => keyOf(x) === keyOf(u))) current.push(u)
  }
  emit('update:modelValue', current)
}

onMounted(() => {
  void useDirectoryStore().ensure()
})

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
.sso-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.selected-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 12px;
}

.chip-avatar,
.member-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--ink-soft);
  font-size: 10px;
  font-weight: 700;
}

.chip-avatar img,
.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chip-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-remove {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--ink-faint);
  font-size: 14px;
  line-height: 1;
}

.chip-remove:hover {
  color: var(--ink);
}

.clear-all,
.picker-refresh,
.text-link {
  border: none;
  background: transparent;
  color: var(--ink-faint);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.picker-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-input-row input {
  flex: 1;
  min-width: 0;
}

.picker-refresh {
  flex: none;
  color: var(--ink-soft);
}

.sso-warning {
  margin: 0;
  color: #7a5a2e;
  font-size: 12px;
  line-height: 1.6;
}

.picker-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.user-list {
  max-height: 300px;
  overflow-y: auto;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 4px;
  border: none;
  border-bottom: 1px solid var(--line-soft);
  border-radius: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  transition: padding-left 0.2s var(--ease);
}

.user-row:last-child {
  border-bottom: none;
}

.user-row:hover {
  padding-left: 8px;
}

.user-row.selected {
  padding-left: 8px;
}

.user-row.disabled {
  opacity: 0.55;
}

.user-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-badges {
  flex: none;
}

.user-check {
  width: 16px;
  flex: none;
  color: var(--brand);
  font-size: 13px;
  font-weight: 700;
  text-align: right;
}

.hint {
  margin: 4px 0 0;
  color: var(--ink-soft);
  font-size: 12px;
}
</style>