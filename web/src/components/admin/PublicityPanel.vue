<template>
  <div class="card panel publicity-panel">
    <div class="row-between">
      <div>
        <h3>会议与席位公示</h3>
        <p class="hint">每次技术部会议填写席位名额与晋升结果，系统自动生成公示文档。</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">+ 新建公示</button>
    </div>

    <p v-if="loading" class="empty">加载中…</p>
    <table v-else-if="rows.length" class="table">
      <thead>
        <tr><th>会议时间</th><th>标题</th><th>晋升</th><th>席位</th><th>状态</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="p in rows" :key="p.id">
          <td class="mono small">{{ p.meeting_date || '—' }}</td>
          <td><strong>{{ p.title }}</strong><div class="muted small">{{ p.summary }}</div></td>
          <td class="small">{{ p.promotions.length }}</td>
          <td class="small">{{ p.seats.length }}</td>
          <td><span class="badge" :class="p.published ? 'badge-green' : 'badge'">{{ p.published ? '已发布' : '草稿' }}</span></td>
          <td class="actions">
            <RouterLink v-if="p.published" class="btn btn-ghost btn-sm" :to="`/publicity/${p.id}`">查看</RouterLink>
            <button v-else class="btn btn-primary btn-sm" @click="publish(p)">发布</button>
            <button class="btn btn-ghost btn-sm" @click="openEdit(p)">编辑</button>
            <button class="btn btn-danger btn-sm" @click="remove(p)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">还没有公示记录。</div>

    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
      <form class="modal wide publicity-modal" @submit.prevent="save(true)">
        <h3>{{ editing ? '编辑公示' : '新建公示' }}</h3>
        <div class="fields">
          <div class="field full">
            <label>标题 *</label>
            <input v-model="form.title" required maxlength="120" />
          </div>
          <div class="field">
            <label>会议时间 *</label>
            <input v-model="form.meeting_date" type="date" required />
          </div>
          <div class="field full">
            <label>说明</label>
            <textarea v-model="form.summary" rows="3" placeholder="本次会议的背景、议题或补充说明" />
          </div>
        </div>

        <section class="form-block">
          <div class="row-between">
            <h4>技术部席位名额</h4>
            <span class="muted small">保底 / 浮动可修改，合计自动计算</span>
          </div>
          <div class="table-wrap">
            <table class="table compact-table seats-edit-table">
              <thead>
                <tr><th>部门</th><th>保底</th><th>浮动</th><th>合计</th><th>交付</th><th>使用</th><th>出人</th><th>社区</th></tr>
              </thead>
              <tbody>
                <tr v-for="s in form.seats" :key="s.department_id">
                  <td>{{ s.department_name }}</td>
                  <td><input v-model.number="s.base" type="number" min="1" class="mini-input" /></td>
                  <td><input v-model.number="s.floating" type="number" min="0" class="mini-input" /></td>
                  <td>{{ Number(s.base) + Number(s.floating) }}</td>
                  <td><input v-model.number="s.delivery" type="number" min="0" max="100" class="mini-input" /></td>
                  <td><input v-model.number="s.usage" type="number" min="0" max="100" class="mini-input" /></td>
                  <td><input v-model.number="s.talent" type="number" min="0" max="100" class="mini-input" /></td>
                  <td><input v-model.number="s.activity" type="number" min="0" max="100" class="mini-input" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="form-block">
          <div class="row-between">
            <h4>晋升与席位变动</h4>
            <span class="muted small">自动带出上次公示以来的答辩结果</span>
          </div>
          <table v-if="form.promotions.length" class="table compact-table">
            <thead><tr><th>姓名</th><th>部门</th><th>结果</th><th>说明</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in form.promotions" :key="i">
                <td>{{ p.name }}</td>
                <td>{{ p.department_name }}</td>
                <td>{{ p.result }}</td>
                <td class="small">{{ p.note || '—' }}</td>
                <td><button type="button" class="link-btn" @click="removePromo(i)">移除</button></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="muted small empty-inline">本次无晋升或席位变动。</div>
          <div class="promo-add">
            <input v-model="newPromo.name" placeholder="姓名" />
            <input v-model="newPromo.department_name" placeholder="部门" />
            <select v-model="newPromo.result">
              <option>进入圆桌</option>
              <option>候补席位</option>
              <option>未通过</option>
            </select>
            <input v-model="newPromo.note" placeholder="说明（选填）" />
            <button type="button" class="btn btn-ghost btn-sm" @click="addPromo">添加</button>
          </div>
        </section>

        <p v-if="modalError" class="notice notice-error">{{ modalError }}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" type="button" :disabled="saving" @click="save(true)">
            {{ saving ? '保存中…' : '保存并发布' }}
          </button>
          <button class="btn btn-ghost" type="button" :disabled="saving" @click="save(false)">
            保存草稿
          </button>
          <button class="btn btn-ghost" type="button" @click="modalOpen = false">取消</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  api,
  type Publicity,
  type PublicityPromotion,
  type PublicitySeat,
} from '../../api'

const emit = defineEmits<{
  (e: 'notice', msg: string): void
  (e: 'error', msg: string): void
}>()

const rows = ref<Publicity[]>([])
const loading = ref(true)
const modalOpen = ref(false)
const editing = ref<Publicity | null>(null)
const saving = ref(false)
const modalError = ref('')

const newPromo = reactive({ name: '', department_name: '', result: '进入圆桌', note: '' })
const form = reactive({
  title: '',
  meeting_date: '',
  summary: '',
  published: 1,
  seats: [] as PublicitySeat[],
  promotions: [] as PublicityPromotion[],
})

async function load() {
  loading.value = true
  try {
    rows.value = (await api.adminPublicities()) || []
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function openCreate() {
  modalError.value = ''
  editing.value = null
  try {
    const draft = await api.adminPublicityDraft()
    form.title = draft.title
    form.meeting_date = draft.meeting_date
    form.summary = ''
    form.published = 1
    form.seats = draft.seats
    form.promotions = draft.promotions
    modalOpen.value = true
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '加载草稿失败')
  }
}

function openEdit(p: Publicity) {
  modalError.value = ''
  editing.value = p
  form.title = p.title
  form.meeting_date = p.meeting_date
  form.summary = p.summary
  form.published = p.published ? 1 : 0
  form.seats = p.seats.map((s) => ({ ...s }))
  form.promotions = p.promotions.map((x) => ({ ...x }))
  modalOpen.value = true
}

async function save(publish: boolean) {
  modalError.value = ''
  saving.value = true
  const payload = {
    title: form.title,
    meeting_date: form.meeting_date,
    summary: form.summary,
    published: publish,
    seats: form.seats,
    promotions: form.promotions,
  }
  try {
    if (editing.value) {
      await api.adminUpdatePublicity(editing.value.id, payload)
      emit('notice', '公示已更新')
    } else {
      await api.adminCreatePublicity(payload)
      emit('notice', '公示已生成')
    }
    modalOpen.value = false
    await load()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

function addPromo() {
  if (!newPromo.name.trim()) return
  form.promotions.push({
    user_id: 0,
    name: newPromo.name.trim(),
    developer_no: '',
    department_name: newPromo.department_name.trim(),
    result: newPromo.result,
    note: newPromo.note.trim(),
  })
  newPromo.name = ''
  newPromo.department_name = ''
  newPromo.result = '进入圆桌'
  newPromo.note = ''
}

function removePromo(i: number) {
  form.promotions.splice(i, 1)
}

async function publish(p: Publicity) {
  if (!window.confirm(`发布公示「${p.title}」？发布后会写回各部门席位与指标。`)) return
  try {
    await api.adminUpdatePublicity(p.id, { published: true })
    emit('notice', '公示已发布，部门席位与指标已更新')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '发布失败')
  }
}

async function remove(p: Publicity) {
  if (!window.confirm(`确认删除公示「${p.title}」？`)) return
  try {
    await api.adminDeletePublicity(p.id)
    emit('notice', '公示已删除')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.publicity-panel :deep(.hint) {
  margin: 4px 0 0;
}
.form-block {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.form-block h4 {
  margin: 0;
  font-size: 13px;
}
.table-wrap {
  overflow-x: auto;
}
.compact-table {
  margin-top: 8px;
  font-size: 12px;
}
.seats-edit-table {
  min-width: 760px;
}
.compact-table th,
.compact-table td {
  padding: 7px 8px;
}
.mini-input {
  width: 70px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 4px 6px;
  background: transparent;
}
.empty-inline {
  padding: 14px 0;
}
.promo-add {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.promo-add input,
.promo-add select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
  background: transparent;
  font-size: 12px;
}
.promo-add input {
  flex: 1 1 130px;
}
.link-btn {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--ink-soft);
  font-size: 12px;
}
.link-btn:hover {
  color: var(--ink);
}
</style>