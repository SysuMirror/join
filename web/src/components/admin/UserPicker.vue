<template>
  <div class="user-picker-wrap">
    <div v-if="modelValue" class="selected-user">
      <span class="member-avatar">
        <img v-if="modelValue.avatar" :src="modelValue.avatar" :alt="modelValue.name" />
        <span v-else>{{ initial(modelValue.name) }}</span>
      </span>
      <span class="selected-user-copy">
        <strong>{{ modelValue.name }}</strong>
        <span class="muted small">
          {{ modelValue.email }}<template v-if="modelValue.developer_no"> · {{ modelValue.developer_no }}</template>
        </span>
      </span>
      <button type="button" class="btn btn-ghost btn-sm" @click="clear">更换</button>
    </div>
    <template v-else>
      <div class="picker-input-row">
        <input
          v-model="query"
          type="search"
          :placeholder="placeholder || '输入姓名 / 邮箱 / 开发者编号快速匹配…'"
          @focus="onFocus"
          @blur="onBlur"
        />
        <button
          type="button"
          class="picker-refresh"
          :disabled="dir.loading"
          title="刷新用户目录"
          @click="refresh"
        >
          {{ dir.loading ? '刷新中…' : '刷新' }}
        </button>
      </div>
      <template v-if="showList">
        <div v-if="dir.loading && !dir.users.length" class="hint">正在加载用户目录…</div>
        <div v-else-if="results.length" class="user-picker">
          <button
            v-for="u in results"
            :key="keyOf(u)"
            type="button"
            class="user-option"
            @mousedown.prevent
            @click="select(u)"
          >
            <span class="member-avatar">
              <img v-if="u.avatar" :src="u.avatar" :alt="u.name" />
              <span v-else>{{ initial(u.name) }}</span>
            </span>
            <span class="user-option-copy">
              <strong>{{ u.name }}</strong>
              <span class="muted small">
                {{ u.email }}<template v-if="u.developer_no"> · {{ u.developer_no }}</template>
                <template v-else-if="u.student_id"> · {{ u.student_id }}</template>
              </span>
            </span>
            <span v-if="!u.registered" class="badge badge-amber">未注册</span>
          </button>
        </div>
        <div v-else class="hint">
          没有匹配的用户。
          <button type="button" class="text-link" @click="refresh">刷新目录</button>
        </div>
        <p v-if="dir.warning && !dir.users.length" class="picker-warning">{{ dir.warning }}</p>
        <p v-else-if="dir.stale" class="picker-warning">正在使用本地缓存，已后台刷新。</p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { DirectoryUser, HallUserSummary } from '../../api'
import { useDirectoryStore } from '../../stores/directory'

const props = withDefaults(
  defineProps<{
    modelValue: HallUserSummary | null
    placeholder?: string
    /** 只允许选择已注册用户（默认，用于负责人/管理员等场景） */
    registeredOnly?: boolean
  }>(),
  { registeredOnly: true },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: HallUserSummary | null): void
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

function keyOf(u: DirectoryUser): string {
  return u.user_id ? `u:${u.user_id}` : u.sso_sub ? `s:${u.sso_sub}` : u.email
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

function select(u: DirectoryUser) {
  emit('update:modelValue', toSummary(u))
  query.value = ''
  showList.value = false
}

function clear() {
  emit('update:modelValue', null)
  query.value = ''
  showList.value = true
  void useDirectoryStore().ensure()
}

onMounted(() => {
  // 预取一次，打开弹窗后即可即时匹配
  void useDirectoryStore().ensure()
})
</script>

<style scoped>
.selected-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.selected-user-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 700;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.user-picker {
  max-height: 260px;
  overflow-y: auto;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.user-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 4px;
  border: none;
  border-bottom: 1px solid var(--line-soft);
  border-radius: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  transition: padding-left 0.2s var(--ease);
}

.user-option:last-child {
  border-bottom: none;
}

.user-option:hover {
  padding-left: 8px;
}

.user-option-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.hint {
  margin: 6px 0 0;
  color: var(--ink-soft);
  font-size: 12px;
}

.picker-warning {
  margin: 4px 0 0;
  color: #7a5a2e;
  font-size: 11px;
}

.text-link {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--ink);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>