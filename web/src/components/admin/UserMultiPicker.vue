<template>
  <div class="multi-picker">
    <div v-if="modelValue.length" class="selected-list">
      <span v-for="u in modelValue" :key="u.id" class="selected-chip">
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
        :placeholder="placeholder || '搜索姓名 / 邮箱 / 开发者编号…'"
        @focus="onFocus"
        @blur="onBlur"
      />
      <button type="button" class="picker-refresh" :disabled="dir.loading" @click="refresh">
        {{ dir.loading ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <template v-if="showList">
      <div class="picker-meta">
        <span class="muted small">
          {{ dir.loading && !dir.users.length ? '加载用户目录…' : `找到 ${results.length} 人 · 已选 ${modelValue.length} 人` }}
        </span>
      </div>
      <div v-if="results.length" class="user-list">
        <button
          v-for="u in results"
          :key="u.user_id"
          type="button"
          class="user-row"
          :class="{ selected: isSelected(u) }"
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
            </span>
          </span>
          <span class="user-check">{{ isSelected(u) ? '✓' : '' }}</span>
        </button>
      </div>
      <div v-else-if="!dir.loading" class="hint">没有匹配的用户。</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { DirectoryUser, HallUserSummary } from '../../api'
import { useDirectoryStore } from '../../stores/directory'

const props = withDefaults(
  defineProps<{
    modelValue: HallUserSummary[]
    placeholder?: string
    registeredOnly?: boolean
  }>(),
  { registeredOnly: true },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: HallUserSummary[]): void
}>()

const dir = useDirectoryStore().state
const query = ref('')
const showList = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const results = computed(() =>
  useDirectoryStore().search(query.value, {
    registeredOnly: props.registeredOnly,
    includeUnregistered: !props.registeredOnly,
    limit: 80,
  }),
)

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

function isSelected(u: DirectoryUser): boolean {
  return props.modelValue.some((x) => x.id === u.user_id)
}

function toSummary(u: DirectoryUser): HallUserSummary {
  return {
    id: u.user_id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    developer_no: u.developer_no,
    developer_level: u.developer_level,
    sso_sub: u.sso_sub,
  }
}

function toggle(u: DirectoryUser) {
  if (!u.registered || !u.user_id) return
  const current = [...props.modelValue]
  const idx = current.findIndex((x) => x.id === u.user_id)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(toSummary(u))
  emit('update:modelValue', current)
}

function remove(u: HallUserSummary) {
  emit(
    'update:modelValue',
    props.modelValue.filter((x) => x.id !== u.id),
  )
}

function clearAll() {
  emit('update:modelValue', [])
}

onMounted(() => {
  void useDirectoryStore().ensure()
})
</script>

<style scoped>
.multi-picker {
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

.clear-all {
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
  border: none;
  background: transparent;
  color: var(--ink-soft);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.picker-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 6px;
  border-top: 1px solid var(--line);
}

.user-list {
  max-height: 280px;
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

.user-row:hover,
.user-row.selected {
  padding-left: 8px;
}

.user-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
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