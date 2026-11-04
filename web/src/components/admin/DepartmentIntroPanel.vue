<template>
  <div class="card panel intro-panel">
    <div class="row-between">
      <div>
        <h3>部门介绍</h3>
        <p class="hint">这里填写的内容会展示在部门详情页，可被同学从岗位页点击查看。</p>
      </div>
    </div>

    <p v-if="loading" class="empty">加载中…</p>
    <div v-else-if="departments.length" class="intro-list">
      <form
        v-for="d in departments"
        :key="d.id"
        class="intro-block"
        @submit.prevent="save(d)"
      >
        <div class="intro-head">
          <h4>{{ d.name }}</h4>
          <button class="btn btn-primary btn-sm" type="submit" :disabled="savingId === d.id">
            {{ savingId === d.id ? '保存中…' : '保存' }}
          </button>
        </div>
        <div class="field">
          <label>一句话介绍</label>
          <input v-model="forms[d.id].summary" maxlength="300" placeholder="展示在部门列表和岗位页" />
        </div>
        <div class="field">
          <label>详细介绍</label>
          <textarea v-model="forms[d.id].description" rows="6" placeholder="部门方向、在做什么、希望什么样的人加入…" />
        </div>
      </form>
    </div>
    <div v-else class="empty">暂无可管理的部门。</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api, type Department } from '../../api'

const emit = defineEmits<{
  (e: 'notice', msg: string): void
  (e: 'error', msg: string): void
}>()

const departments = ref<Department[]>([])
const loading = ref(true)
const savingId = ref(0)
const forms = reactive<Record<number, { summary: string; description: string }>>({})

async function load() {
  loading.value = true
  try {
    const rows = (await api.adminDepartments()) || []
    departments.value = rows
    for (const d of rows) {
      forms[d.id] = { summary: d.summary || '', description: d.description || '' }
    }
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function save(d: Department) {
  const f = forms[d.id]
  if (!f) return
  savingId.value = d.id
  try {
    await api.adminUpdateDepartment(d.id, {
      summary: f.summary,
      description: f.description,
    })
    emit('notice', `「${d.name}」介绍已保存`)
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '保存失败')
  } finally {
    savingId.value = 0
  }
}

onMounted(load)
</script>

<style scoped>
.intro-panel :deep(.hint) {
  margin: 4px 0 0;
}
.intro-list {
  display: grid;
  gap: 0;
  border-top: 1px solid var(--line);
  margin-top: 14px;
}
.intro-block {
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}
.intro-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.intro-head h4 {
  margin: 0;
  font-size: 15px;
}
.intro-block .field + .field {
  margin-top: 12px;
}
</style>