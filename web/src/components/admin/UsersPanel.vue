<template>
  <div class="card panel users-panel">
    <div class="row-between">
      <div>
        <h3>成员与权限</h3>
        <p class="hint">查询注册用户，设置超级管理员、部门管理员、资源方代表与部门负责人；调整身份层级与归属部门。</p>
      </div>
      <span class="badge badge-blue">{{ total }} 人</span>
    </div>

    <div class="toolbar users-toolbar">
      <input
        v-model="filters.q"
        class="search"
        placeholder="搜索姓名 / 邮箱 / 开发者编号 / 部门…"
        @input="debouncedLoad"
      />
      <select v-model="filters.role" @change="load(1)">
        <option value="">全部角色</option>
        <option value="super_admin">超级管理员</option>
        <option value="dept_admin">部门管理员</option>
        <option value="resource">资源方代表</option>
        <option value="user">普通开发者</option>
      </select>
      <select v-model="filters.level" @change="load(1)">
        <option value="">全部层级</option>
        <option value="market">集市开发者</option>
        <option value="project">项目开发者</option>
        <option value="roundtable">圆桌开发者</option>
      </select>
      <select v-model="filters.department" @change="load(1)">
        <option value="">全部部门</option>
        <option v-for="d in departments" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
      </select>
      <select v-model="filters.status" @change="load(1)">
        <option value="">全部状态</option>
        <option value="active">在职</option>
        <option value="exited">已退出</option>
      </select>
    </div>

    <p v-if="loading" class="empty">加载中…</p>
    <table v-else-if="users.length" class="table">
      <thead>
        <tr>
          <th>成员</th>
          <th>身份 / 部门</th>
          <th class="hide-sm">角色</th>
          <th class="hide-sm">最后登录</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>
            <div class="user-cell">
              <img v-if="u.avatar" class="user-avatar" :src="u.avatar" alt="" />
              <span v-else class="user-avatar user-initial">{{ (u.name || '?').slice(0, 1) }}</span>
              <div>
                <strong>{{ u.name || '未命名' }}</strong>
                <div class="muted small">{{ u.email || '无邮箱' }}</div>
                <div class="muted small mono">{{ u.developer_no }}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge" :class="levelClass(u.developer_level)">{{ u.level_label }}</span>
            <div class="muted small dept-line">{{ u.department?.name || '未进组' }}</div>
          </td>
          <td class="hide-sm small">
            <div class="role-tags">
              <span v-if="u.is_super_admin" class="badge badge-amber">超级管理员</span>
              <span v-if="u.is_department_admin" class="badge badge-blue">部门管理员</span>
              <span v-if="u.is_resource_reviewer" class="badge badge-green">资源方代表</span>
              <span v-if="u.head_departments.length" class="badge badge">负责人</span>
              <span v-if="u.sso_developer" class="badge badge-green">开发者权限</span>
              <span v-if="!u.is_super_admin && !u.is_department_admin && !u.is_resource_reviewer" class="muted small">普通开发者</span>
            </div>
          </td>
          <td class="hide-sm small mono">{{ u.last_login_at ? formatDateTime(u.last_login_at) : '—' }}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" @click="openUser(u)">详情</button>
            <button v-if="global" class="btn btn-primary btn-sm" @click="openUser(u, 'role')">管理权限</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">没有匹配的用户。</div>

    <div v-if="total > pageSize" class="pager">
      <button class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="load(page - 1)">上一页</button>
      <span class="muted small">{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
      <button class="btn btn-ghost btn-sm" :disabled="page * pageSize >= total" @click="load(page + 1)">下一页</button>
    </div>

    <!-- 用户详情 / 权限 -->
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
      <div class="modal wide user-modal">
        <div class="user-modal-head">
          <div>
            <h3>{{ detail?.name || '成员' }}</h3>
            <p class="muted small">
              {{ detail?.email }} · <span class="mono">{{ detail?.developer_no }}</span>
              <span class="dot-sep" />
              {{ detail?.level_label }}
              <span v-if="detail?.department"> · {{ detail.department.name }}</span>
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" @click="modalOpen = false">关闭</button>
        </div>

        <div v-if="detailLoading" class="empty">加载中…</div>
        <template v-else-if="detail">
          <div class="modal-tabs">
            <button class="tab" :class="{ active: modalTab === 'role' }" @click="modalTab = 'role'">权限与角色</button>
            <button class="tab" :class="{ active: modalTab === 'identity' }" @click="modalTab = 'identity'">人事与身份</button>
            <button class="tab" :class="{ active: modalTab === 'history' }" @click="modalTab = 'history'">答辩与复审</button>
          </div>

          <template v-if="modalTab === 'role'">
            <div class="role-grid">
              <label class="check-row">
                <input v-model="roleForm.isSuper" type="checkbox" :disabled="!global" />
                <span><b>超级管理员</b><small>管理全部部门、用户角色、问答与站点配置</small></span>
              </label>
              <label class="check-row">
                <input v-model="roleForm.isResource" type="checkbox" :disabled="!global" />
                <span><b>资源方代表</b><small>参与答辩三级评审，评估资源分配主张</small></span>
              </label>
            </div>

            <div class="perm-section">
              <h4>部门管理员</h4>
              <p class="hint">部门管理员可管理本部门岗位、报名、成员与答辩。</p>
              <div class="dept-checks">
                <label v-for="d in departments" :key="d.id" class="dept-check">
                  <input v-model="roleForm.adminDeptIds" type="checkbox" :value="d.id" :disabled="!global" />
                  <span>{{ d.name }}</span>
                </label>
              </div>
            </div>

            <div class="perm-section">
              <h4>部门负责人</h4>
              <p class="hint">负责人是答辩一级「陈述事实」的评审人，同时自动获得该部门管理员权限。</p>
              <div class="dept-checks">
                <label v-for="d in departments" :key="d.id" class="dept-check">
                  <input v-model="roleForm.headDeptIds" type="checkbox" :value="d.id" :disabled="!global" />
                  <span>{{ d.name }}</span>
                </label>
              </div>
            </div>

            <p v-if="modalError" class="notice notice-error">{{ modalError }}</p>
            <div class="modal-actions">
              <button v-if="global" class="btn btn-primary" :disabled="saving" @click="saveRole">
                {{ saving ? '保存中…' : '保存权限' }}
              </button>
              <button class="btn btn-ghost" @click="modalOpen = false">关闭</button>
            </div>
          </template>

          <template v-else-if="modalTab === 'identity'">
            <div class="fields">
              <div class="field">
                <label>身份层级</label>
                <select v-model="identityForm.developer_level" :disabled="!global">
                  <option value="market">集市开发者</option>
                  <option value="project">项目开发者</option>
                  <option value="roundtable">圆桌开发者（占用席位）</option>
                </select>
              </div>
              <div class="field">
                <label>归属部门</label>
                <select v-model.number="identityForm.primary_department_id" :disabled="!global">
                  <option :value="0">未进组</option>
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </div>
              <div class="field">
                <label>账号状态</label>
                <select v-model="identityForm.status" :disabled="!global">
                  <option value="active">在职</option>
                  <option value="exited">已退出开发者体系</option>
                </select>
              </div>
              <div class="field">
                <label>技能（逗号分隔）</label>
                <input v-model="identityForm.developer_skills" :disabled="!global" placeholder="TypeScript, Node.js" />
              </div>
              <div class="field full">
                <label>个人链接（逗号分隔）</label>
                <input v-model="identityForm.developer_links" :disabled="!global" placeholder="GitHub / 作品集" />
              </div>
              <div class="field full">
                <label>开发者简介</label>
                <textarea v-model="identityForm.developer_bio" rows="4" :disabled="!global" />
              </div>
            </div>
            <p class="hint">将身份改为圆桌开发者会占用部门席位；席位已满时会拒绝，请先在「部门」中调整席位。</p>
            <p v-if="modalError" class="notice notice-error">{{ modalError }}</p>
            <div class="modal-actions">
              <button v-if="global" class="btn btn-primary" :disabled="saving" @click="saveIdentity">
                {{ saving ? '保存中…' : '保存人事信息' }}
              </button>
              <button class="btn btn-ghost" @click="modalOpen = false">关闭</button>
            </div>
          </template>

          <template v-else>
            <h4 class="modal-subtitle">答辩记录</h4>
            <div v-if="detail.defenses.length" class="history-list">
              <div v-for="d in detail.defenses" :key="d.id" class="history-row">
                <div>
                  <b>{{ d.title }}</b>
                  <p class="muted small">{{ d.department_name }} · {{ formatDate(d.created_at) }}</p>
                  <p v-if="d.final_note" class="muted small">{{ d.final_note }}</p>
                </div>
                <span class="badge" :class="defenseStatusClass(d.status)">{{ defenseStatusLabel(d.status) }}</span>
              </div>
            </div>
            <div v-else class="empty">暂无答辩记录。</div>

            <h4 class="modal-subtitle">年度复审 / 席位记录</h4>
            <div v-if="detail.seat_reviews.length" class="history-list">
              <div v-for="r in detail.seat_reviews" :key="r.id" class="history-row">
                <div>
                  <b>{{ r.year }} 年度 · 产出 {{ r.output_score }} 分</b>
                  <p class="muted small">{{ r.result === 'exited' ? '退出圆桌' : '保留席位' }} · {{ r.reviewer }}</p>
                  <p v-if="r.note" class="muted small">{{ r.note }}</p>
                </div>
                <span class="badge" :class="r.result === 'exited' ? 'badge-red' : 'badge-green'">
                  {{ r.result === 'exited' ? '已退出' : '保留' }}
                </span>
              </div>
            </div>
            <div v-else class="empty">暂无复审记录。</div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  api,
  type AdminUser,
  type AdminUserDetail,
  type Department,
} from '../../api'
import {
  defenseStatusClass,
  defenseStatusLabel,
  formatDate,
  formatDateTime,
  levelClass,
} from '../../utils/labels'

const props = defineProps<{
  global: boolean
  departments: Department[]
}>()

const emit = defineEmits<{
  (e: 'notice', msg: string): void
  (e: 'error', msg: string): void
}>()

const users = ref<AdminUser[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(true)

const filters = reactive({
  q: '',
  role: '',
  level: '',
  department: '',
  status: '',
})

let timer: number | undefined
function debouncedLoad() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => load(1), 250)
}

async function load(p = page.value) {
  loading.value = true
  try {
    const res = await api.adminUsers({
      ...filters,
      page: p,
      pageSize,
    })
    users.value = res.items || []
    total.value = res.total || 0
    page.value = res.page || p
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

// 弹窗
const modalOpen = ref(false)
const modalTab = ref<'role' | 'identity' | 'history'>('role')
const detail = ref<AdminUserDetail | null>(null)
const detailLoading = ref(false)
const saving = ref(false)
const modalError = ref('')

const roleForm = reactive({
  isSuper: false,
  isResource: false,
  adminDeptIds: [] as number[],
  headDeptIds: [] as number[],
})

const identityForm = reactive({
  developer_level: 'market',
  primary_department_id: 0,
  status: 'active',
  developer_bio: '',
  developer_skills: '',
  developer_links: '',
})

async function openUser(u: AdminUser, tab: 'role' | 'identity' | 'history' = 'role') {
  modalOpen.value = true
  modalTab.value = tab
  detailLoading.value = true
  detail.value = null
  modalError.value = ''
  try {
    const d = await api.adminUser(u.id)
    detail.value = d
    roleForm.isSuper = d.is_super_admin
    roleForm.isResource = d.is_resource_reviewer
    roleForm.adminDeptIds = d.admin_departments.map((x) => x.id)
    roleForm.headDeptIds = d.head_departments.map((x) => x.id)
    identityForm.developer_level = d.developer_level
    identityForm.primary_department_id = d.department?.id || 0
    identityForm.status = d.status
    identityForm.developer_bio = d.developer_bio || ''
    identityForm.developer_skills = d.developer_skills.join(',')
    identityForm.developer_links = d.developer_links.join(',')
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    detailLoading.value = false
  }
}

async function saveRole() {
  if (!detail.value) return
  saving.value = true
  modalError.value = ''
  try {
    const updated = await api.adminUpdateUserRole(detail.value.id, {
      system_role: roleForm.isSuper ? 'super_admin' : 'user',
      reviewer_role: roleForm.isResource ? 'resource' : '',
      department_admin_ids: roleForm.adminDeptIds,
      head_department_ids: roleForm.headDeptIds,
    })
    emit('notice', '用户权限已更新')
    detail.value = { ...detail.value, ...updated }
    roleForm.adminDeptIds = updated.admin_departments.map((x) => x.id)
    roleForm.headDeptIds = updated.head_departments.map((x) => x.id)
    await load()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function saveIdentity() {
  if (!detail.value) return
  saving.value = true
  modalError.value = ''
  try {
    const updated = await api.adminUpdateUserIdentity(detail.value.id, {
      developer_level: identityForm.developer_level,
      primary_department_id: identityForm.primary_department_id,
      status: identityForm.status,
      developer_bio: identityForm.developer_bio,
      developer_skills: identityForm.developer_skills,
      developer_links: identityForm.developer_links,
    })
    emit('notice', '人事信息已更新')
    detail.value = { ...detail.value, ...updated }
    await load()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => load(1))
</script>

<style scoped>
.users-panel :deep(.hint) {
  margin: 4px 0 0;
}
.users-toolbar {
  flex-wrap: wrap;
}
.users-toolbar .search {
  min-width: 260px;
  flex: 1;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex: none;
  object-fit: cover;
}
.user-initial {
  display: grid;
  place-items: center;
  background: var(--brand-soft);
  color: var(--ink);
  font-weight: 800;
}
.dept-line {
  margin-top: 4px;
}
.role-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
}
.user-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.user-modal-head h3 {
  margin: 0 0 4px;
}
.user-modal-head p {
  margin: 0;
}
.modal-tabs {
  display: flex;
  gap: 4px;
  margin: 16px 0 14px;
  border-bottom: 1px solid var(--line);
}
.modal-tabs .tab {
  border: none;
  background: transparent;
  padding: 8px 12px;
  border-bottom: 2px solid transparent;
  color: var(--ink-soft);
  font-size: 13px;
}
.modal-tabs .tab.active {
  color: var(--ink);
  border-bottom-color: var(--ink);
  font-weight: 600;
}
.role-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.check-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  cursor: pointer;
}
.check-row input {
  margin-top: 3px;
}
.check-row b {
  display: block;
  font-size: 13px;
}
.check-row small {
  color: var(--ink-faint);
  font-size: 11px;
  line-height: 1.5;
}
.perm-section {
  margin-top: 18px;
}
.perm-section h4 {
  margin: 0 0 4px;
  font-size: 13px;
}
.dept-checks {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.dept-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  border: none;
  border-radius: 0;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field.full {
  grid-column: 1 / -1;
}
.modal-subtitle {
  margin: 18px 0 8px;
  font-size: 13px;
  color: var(--ink-soft);
}
.history-list {
  display: grid;
  gap: 8px;
}
.history-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
}
.history-row b {
  font-size: 13px;
}
.history-row p {
  margin: 3px 0 0;
}
@media (max-width: 720px) {
  .role-grid,
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>