<template>
  <div class="history-admin">
    <!-- ===== 页面文案 ===== -->
    <div class="card panel">
      <div class="row-between">
        <div>
          <h3>页面文案</h3>
          <p class="hint">展示在 /history 页面顶部与名人堂章节。保存后前台即时生效。</p>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="savingSettings" @click="saveSettings">
          {{ savingSettings ? '保存中…' : '保存文案' }}
        </button>
      </div>
      <div class="fields">
        <div class="field">
          <label>页面标题</label>
          <input v-model="settings.title" maxlength="80" placeholder="软工集市历史" />
        </div>
        <div class="field">
          <label>名人堂章节标题</label>
          <input v-model="settings.hall_title" maxlength="80" placeholder="名人堂" />
        </div>
        <div class="field full">
          <label>页面导语</label>
          <textarea v-model="settings.subtitle" rows="2" maxlength="500" />
        </div>
        <div class="field full">
          <label>名人堂章节说明</label>
          <textarea v-model="settings.hall_intro" rows="2" maxlength="800" />
        </div>
      </div>
    </div>

    <!-- ===== 章节 ===== -->
    <div class="card panel">
      <div class="row-between">
        <div>
          <h3>章节</h3>
          <p class="hint">
            按排序拼接成一篇长文档；正文支持 Markdown（标题、列表、引用、表格、链接、代码块）。
            名人堂固定作为最后一章，无需在这里新建。
          </p>
        </div>
        <button class="btn btn-primary btn-sm" @click="openChapterForm()">+ 新建章节</button>
      </div>

      <p v-if="loading" class="empty">加载中…</p>
      <table v-else-if="chapters.length" class="table">
        <thead>
          <tr>
            <th class="col-order">排序</th>
            <th>章节</th>
            <th class="hide-sm">摘要</th>
            <th class="col-status">状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in chapters" :key="c.id">
            <td class="mono small">{{ c.sort_order }}</td>
            <td>
              <strong>{{ c.title }}</strong>
              <div class="muted small">
                {{ c.kicker || '未设置眉标' }}<template v-if="c.era"> · {{ c.era }}</template>
              </div>
            </td>
            <td class="hide-sm muted small cell-summary">{{ c.summary || '—' }}</td>
            <td>
              <span class="badge" :class="c.enabled ? 'badge-green' : 'badge-red'">
                {{ c.enabled ? '展示' : '隐藏' }}
              </span>
            </td>
            <td class="actions">
              <button class="btn btn-ghost btn-sm" @click="openChapterForm(c)">编辑</button>
              <button class="btn btn-danger btn-sm" @click="deleteChapter(c)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">还没有章节，先新建一章开始记录历史。</div>
    </div>

    <!-- ===== 名人堂 ===== -->
    <div class="card panel">
      <div class="row-between">
        <div>
          <h3>名人堂</h3>
          <p class="hint">
            每位成员会展示为一张卡片；点击卡片可查看其集市主页、招聘主页展示与联系方式。
            联系方式留空即不在前台显示。
          </p>
        </div>
        <button class="btn btn-primary btn-sm" @click="openHallForm()">+ 添加成员</button>
      </div>

      <p v-if="loading" class="empty">加载中…</p>
      <table v-else-if="hallOfFame.length" class="table">
        <thead>
          <tr>
            <th>成员</th>
            <th class="hide-sm">头衔 / 部门</th>
            <th class="hide-sm">年份</th>
            <th class="hide-sm">公开联系</th>
            <th class="col-status">状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(m, hallIndex) in hallOfFame" :key="m.id">
            <td>
              <div class="member-cell">
                <span class="member-avatar">
                  <img v-if="m.avatar" :src="m.avatar" :alt="m.name" />
                  <span v-else>{{ initial(m.name) }}</span>
                </span>
                <div>
                  <strong>{{ m.name }}</strong>
                  <span v-if="m.user_submitted" class="badge badge-blue">本人填写</span>
                  <div class="muted small">{{ m.quote || '—' }}</div>
                </div>
              </div>
            </td>
            <td class="hide-sm small">{{ [m.title, m.department].filter(Boolean).join(' · ') || '—' }}</td>
            <td class="hide-sm small mono">{{ m.year || '—' }}</td>
            <td class="hide-sm small">{{ contactSummary(m) }}</td>
            <td>
              <span class="badge" :class="m.enabled ? 'badge-green' : 'badge-red'">
                {{ m.enabled ? '展示' : '隐藏' }}
              </span>
            </td>
            <td class="actions">
              <button
                class="btn btn-ghost btn-sm"
                :disabled="hallIndex === 0"
                title="上移"
                @click="moveHall(hallIndex, -1)"
              >
                ↑
              </button>
              <button
                class="btn btn-ghost btn-sm"
                :disabled="hallIndex === hallOfFame.length - 1"
                title="下移"
                @click="moveHall(hallIndex, 1)"
              >
                ↓
              </button>
              <button class="btn btn-ghost btn-sm" @click="openHallForm(m)">编辑</button>
              <button class="btn btn-danger btn-sm" @click="deleteHall(m)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">名人堂还没有成员。</div>
    </div>

    <!-- ===== 填写邀请 ===== -->
    <div class="card panel">
      <div class="row-between">
        <div>
          <h3>填写邀请</h3>
          <p class="hint">
            可批量选择 UniSSO 用户（含尚未在本平台注册的人），发送邮件邀请 TA 自己填写名人堂资料。
            未注册用户会在发送时自动创建集市账号；链接 14 天内有效，同一用户只保留最新一个有效链接。
          </p>
        </div>
        <button
          class="btn btn-primary btn-sm"
          :disabled="inviteSending || !inviteUsers.length"
          @click="sendInvite"
        >
          {{ inviteSending ? '发送中…' : `发送邀请${inviteUsers.length ? `（${inviteUsers.length}）` : ''}` }}
        </button>
      </div>

      <div class="fields">
        <div class="field full">
          <label>邀请用户 *（可多选）</label>
          <SsoUserPicker v-model="inviteUsers" />
        </div>
        <div class="field full">
          <label>预填头衔（可选）</label>
          <input v-model="inviteTitle" maxlength="80" placeholder="如：创始人 / 首任技术部负责人" />
          <span class="hint">邀请页不展示部门选择，提交后默认归入「软工集市」；你之后可在成员编辑里调整。</span>
        </div>
      </div>

      <p v-if="!mailConfigured" class="notice notice-info invite-notice">
        SMTP 未配置：邀请会生成专属链接，但需要你复制链接手动发送。
      </p>

      <div v-if="lastInviteLink" class="invite-link-row">
        <span class="muted small">最新邀请链接</span>
        <a :href="lastInviteLink" target="_blank" rel="noopener noreferrer">{{ lastInviteLink }}</a>
        <button type="button" class="btn btn-ghost btn-sm" @click="copyLink(lastInviteLink)">
          复制
        </button>
      </div>

      <table v-if="invites.length" class="table">
        <thead>
          <tr>
            <th>邀请对象</th>
            <th class="hide-sm">部门</th>
            <th>状态</th>
            <th class="hide-sm">有效期至</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in invites" :key="inv.id">
            <td>
              <strong>{{ inv.user?.name || '用户已删除' }}</strong>
              <div class="muted small">{{ inv.user?.email || '—' }}</div>
            </td>
            <td class="hide-sm small">{{ inv.department || '本人选择' }}</td>
            <td>
              <span class="badge" :class="inviteStatusClass(inv)">{{ inviteStatusLabel(inv) }}</span>
            </td>
            <td class="hide-sm small">{{ formatDate(inv.expires_at) }}</td>
            <td class="actions">
              <button class="btn btn-ghost btn-sm" @click="copyLink(inv.link)">复制链接</button>
              <button
                class="btn btn-ghost btn-sm"
                :disabled="inv.status === 'revoked'"
                @click="resendInvite(inv)"
              >
                重发
              </button>
              <button
                class="btn btn-danger btn-sm"
                :disabled="inv.status === 'revoked'"
                @click="revokeInvite(inv)"
              >
                撤销
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">还没有发出过填写邀请。</div>
    </div>

    <!-- ===== 章节编辑弹窗 ===== -->
    <div v-if="chapterModal" class="modal-backdrop" @click.self="closeChapterForm">
      <form class="modal wide" @submit.prevent="saveChapter">
        <h3>{{ editingChapter ? '编辑章节' : '新建章节' }}</h3>
        <div class="fields">
          <div class="field">
            <label>眉标</label>
            <input v-model="chapterForm.kicker" maxlength="40" placeholder="如：序章 / 第一章" />
          </div>
          <div class="field">
            <label>年代 / 阶段</label>
            <input v-model="chapterForm.era" maxlength="40" placeholder="如：2021 — 2022 / 起点" />
          </div>
          <div class="field full">
            <label>章节标题 *</label>
            <input v-model="chapterForm.title" required maxlength="120" placeholder="给这段历史一个标题" />
          </div>
          <div class="field full">
            <label>摘要</label>
            <textarea v-model="chapterForm.summary" rows="2" maxlength="400" placeholder="展示在标题下方与目录中" />
          </div>
          <div class="field full">
            <label>正文（Markdown）</label>
            <div class="editor-bar">
              <span class="hint">支持标题、列表、引用、表格、链接、代码块；空行分段。</span>
              <button type="button" class="btn btn-ghost btn-sm" @click="previewChapter = !previewChapter">
                {{ previewChapter ? '返回编辑' : '预览' }}
              </button>
            </div>
            <div v-if="previewChapter" class="chapter-preview">
              <MarkdownDoc :content="chapterForm.content" />
            </div>
            <textarea
              v-else
              v-model="chapterForm.content"
              class="content-editor mono"
              rows="16"
              placeholder="在这里写这一章的故事…"
            />
          </div>
          <div class="field">
            <label>排序（小在前）</label>
            <input v-model.number="chapterForm.sort_order" type="number" min="-9999" max="9999" />
          </div>
          <div class="field">
            <label>状态</label>
            <select v-model.number="chapterForm.enabled">
              <option :value="1">展示</option>
              <option :value="0">隐藏</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" type="submit" :disabled="savingChapter">
            {{ savingChapter ? '保存中…' : '保存章节' }}
          </button>
          <button class="btn btn-ghost" type="button" @click="closeChapterForm">取消</button>
        </div>
      </form>
    </div>

    <!-- ===== 名人堂编辑弹窗 ===== -->
    <div v-if="hallModal" class="modal-backdrop" @click.self="closeHallForm">
      <form class="modal wide" @submit.prevent="saveHall">
        <h3>{{ editingHall ? '编辑名人堂成员' : '添加名人堂成员' }}</h3>
        <p v-if="editingHall?.user_submitted" class="hint">
          该资料由本人通过邀请填写：寄语和自我介绍不可修改，职位、贡献、部门、联系方式等由管理员调整。
        </p>
        <div class="fields">
          <div class="field full">
            <label>关联系统用户 *</label>
            <UserPicker v-model="selectedUser" />
            <span class="hint">保存后姓名与头像以该用户资料为准；如需更换，点击「更换」重新搜索。</span>
          </div>
          <div class="field">
            <label>头衔</label>
            <input v-model="hallForm.title" maxlength="80" placeholder="如：创始人 / 首任技术部负责人" />
          </div>
          <div class="field">
            <label>年份 / 届次</label>
            <input v-model="hallForm.year" maxlength="40" placeholder="如：2021 / 首届" />
          </div>
          <div class="field">
            <label>部门 *</label>
            <select v-model="hallForm.department" required>
              <option value="" disabled>请选择部门</option>
              <option v-for="d in metaDepartments" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
          <div class="field full">
            <label>头像 URL</label>
            <input v-model="hallForm.avatar" maxlength="500" placeholder="留空则使用系统用户头像" />
          </div>
          <div class="field full">
            <label>一句话寄语</label>
            <textarea
              v-model="hallForm.quote"
              rows="2"
              maxlength="300"
              placeholder="展示在卡片上的一句话"
              :disabled="Boolean(editingHall?.user_submitted)"
            />
            <span v-if="editingHall?.user_submitted" class="hint">由本人填写，管理员不可修改。</span>
          </div>
          <div class="field full">
            <label>集市主页账号</label>
            <input v-model="hallForm.market_url" maxlength="500" placeholder="https://ssemarket.cn/…" />
            <span class="hint">点击卡片后会展示「打开主页」入口。</span>
          </div>
          <div class="field full">
            <label>自我介绍（Markdown）</label>
            <textarea
              v-model="hallForm.bio"
              rows="6"
              maxlength="8000"
              placeholder="方向、经历、正在做的事…"
              :disabled="Boolean(editingHall?.user_submitted)"
            />
            <span v-if="editingHall?.user_submitted" class="hint">由本人填写，管理员不可修改。</span>
          </div>
          <div class="field full">
            <label>贡献（Markdown）</label>
            <textarea
              v-model="hallForm.achievements"
              rows="5"
              maxlength="6000"
              placeholder="做过的项目、承担的角色、可量化的产出等"
            />
            <span class="hint">管理员可以整理和补充。</span>
          </div>
          <div class="field">
            <label>联系邮箱</label>
            <input v-model="hallForm.contact_email" maxlength="120" placeholder="name@example.com" />
          </div>
          <div class="field">
            <label>联系微信</label>
            <input v-model="hallForm.contact_wechat" maxlength="120" />
          </div>
          <div class="field full">
            <label>其他联系方式 / 主页</label>
            <input v-model="hallForm.contact_other" maxlength="500" placeholder="GitHub、博客等链接；留空不展示" />
          </div>
          <div class="field">
            <label>状态</label>
            <select v-model.number="hallForm.enabled">
              <option :value="1">展示</option>
              <option :value="0">隐藏</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" type="submit" :disabled="savingHall">
            {{ savingHall ? '保存中…' : '保存成员' }}
          </button>
          <button class="btn btn-ghost" type="button" @click="closeHallForm">取消</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import {
  api,
  type AdminHallInvite,
  type AdminHallOfFameMember,
  type HallUserSummary,
  type HistoryChapter,
  type HistorySettings,
  type SsoUserSummary,
} from '../../api'
import MarkdownDoc from '../MarkdownDoc.vue'
import UserPicker from './UserPicker.vue'
import SsoUserPicker from './SsoUserPicker.vue'
import { formatDate } from '../../utils/labels'

const emit = defineEmits<{
  (e: 'notice', msg: string): void
  (e: 'error', msg: string): void
}>()

const loading = ref(true)
const savingSettings = ref(false)

const settings = reactive<HistorySettings>({
  title: '',
  subtitle: '',
  hall_title: '',
  hall_intro: '',
})

const chapters = ref<HistoryChapter[]>([])
const hallOfFame = ref<AdminHallOfFameMember[]>([])
const invites = ref<AdminHallInvite[]>([])
const metaDepartments = ref<string[]>(['软工集市', 'iwiki'])
const mailConfigured = ref(true)

type ChapterForm = {
  kicker: string
  title: string
  summary: string
  era: string
  content: string
  sort_order: number
  enabled: number
}

type HallForm = {
  user_id: number
  avatar: string
  title: string
  department: string
  year: string
  quote: string
  bio: string
  achievements: string
  market_url: string
  contact_email: string
  contact_wechat: string
  contact_other: string
  enabled: number
}

const chapterModal = ref(false)
const editingChapter = ref<HistoryChapter | null>(null)
const savingChapter = ref(false)
const previewChapter = ref(false)
const chapterForm = reactive<ChapterForm>({
  kicker: '',
  title: '',
  summary: '',
  era: '',
  content: '',
  sort_order: 0,
  enabled: 1,
})

const hallModal = ref(false)
const editingHall = ref<AdminHallOfFameMember | null>(null)
const savingHall = ref(false)
const selectedUser = ref<HallUserSummary | null>(null)
const hallForm = reactive<HallForm>({
  user_id: 0,
  avatar: '',
  title: '',
  department: '',
  year: '',
  quote: '',
  bio: '',
  achievements: '',
  market_url: '',
  contact_email: '',
  contact_wechat: '',
  contact_other: '',
  enabled: 1,
})

watch(selectedUser, (user) => {
  hallForm.user_id = user?.id || 0
})

const inviteUsers = ref<SsoUserSummary[]>([])
const inviteTitle = ref('')
const inviteSending = ref(false)
const lastInviteLink = ref('')

function inviteStatusLabel(inv: AdminHallInvite): string {
  if (inv.status === 'revoked') return '已撤销'
  if (inv.expired) return '已过期'
  if (inv.status === 'submitted') return '已提交'
  return '待填写'
}

function inviteStatusClass(inv: AdminHallInvite): string {
  if (inv.status === 'revoked') return 'badge-red'
  if (inv.expired) return 'badge-red'
  if (inv.status === 'submitted') return 'badge-green'
  return 'badge-amber'
}

function initial(name: string): string {
  return (name || '?').trim().slice(0, 1).toUpperCase()
}

function contactSummary(m: AdminHallOfFameMember): string {
  const parts: string[] = []
  if (m.contact_email) parts.push('邮箱')
  if (m.contact_wechat) parts.push('微信')
  if (m.contact_other) parts.push('其他')
  if (m.market_url) parts.push('集市主页')
  return parts.length ? parts.join(' / ') : '—'
}

async function load() {
  loading.value = true
  try {
    const [s, c, h, meta, iv] = await Promise.all([
      api.adminHistorySettings(),
      api.adminHistoryChapters(),
      api.adminHallOfFame(),
      api.adminHistoryMeta(),
      api.adminHallInvites(),
    ])
    settings.title = s.title || ''
    settings.subtitle = s.subtitle || ''
    settings.hall_title = s.hall_title || ''
    settings.hall_intro = s.hall_intro || ''
    chapters.value = c || []
    hallOfFame.value = h || []
    metaDepartments.value =
      Array.isArray(meta.departments) && meta.departments.length
        ? meta.departments
        : ['软工集市', 'iwiki']
    mailConfigured.value = Boolean(meta.mailConfigured)
    invites.value = iv || []
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function reloadInvites() {
  try {
    invites.value = (await api.adminHallInvites()) || []
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '邀请列表加载失败')
  }
}

async function saveSettings() {
  savingSettings.value = true
  try {
    await api.adminUpdateHistorySettings({ ...settings })
    emit('notice', '页面文案已保存')
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '保存失败')
  } finally {
    savingSettings.value = false
  }
}

function openChapterForm(c?: HistoryChapter) {
  editingChapter.value = c || null
  previewChapter.value = false
  chapterForm.kicker = c?.kicker || ''
  chapterForm.title = c?.title || ''
  chapterForm.summary = c?.summary || ''
  chapterForm.era = c?.era || ''
  chapterForm.content = c?.content || ''
  chapterForm.sort_order = c?.sort_order ?? (chapters.value.length + 1)
  chapterForm.enabled = c?.enabled ?? 1
  chapterModal.value = true
}

function closeChapterForm() {
  chapterModal.value = false
  editingChapter.value = null
}

async function saveChapter() {
  if (!chapterForm.title.trim()) return
  savingChapter.value = true
  try {
    if (editingChapter.value) {
      await api.adminUpdateHistoryChapter(editingChapter.value.id, { ...chapterForm })
      emit('notice', '章节已更新')
    } else {
      await api.adminCreateHistoryChapter({ ...chapterForm })
      emit('notice', '章节已创建')
    }
    closeChapterForm()
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '保存失败')
  } finally {
    savingChapter.value = false
  }
}

async function deleteChapter(c: HistoryChapter) {
  if (!window.confirm(`删除章节「${c.title}」？此操作不可撤销。`)) return
  try {
    await api.adminDeleteHistoryChapter(c.id)
    emit('notice', '章节已删除')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '删除失败')
  }
}

function openHallForm(m?: AdminHallOfFameMember) {
  editingHall.value = m || null
  selectedUser.value = m?.user || null
  hallForm.user_id = m?.user?.id || 0
  hallForm.avatar = m?.custom_avatar || ''
  hallForm.title = m?.title || ''
  const dept = m?.department || ''
  hallForm.department = metaDepartments.value.includes(dept)
    ? dept
    : metaDepartments.value[0] || ''
  hallForm.year = m?.year || ''
  hallForm.quote = m?.quote || ''
  hallForm.bio = m?.bio || ''
  hallForm.achievements = m?.achievements || ''
  hallForm.market_url = m?.market_url || ''
  hallForm.contact_email = m?.contact_email || ''
  hallForm.contact_wechat = m?.contact_wechat || ''
  hallForm.contact_other = m?.contact_other || ''
  hallForm.enabled = m?.enabled ?? 1
  hallModal.value = true
}

function closeHallForm() {
  hallModal.value = false
  editingHall.value = null
}

async function saveHall() {
  if (!hallForm.user_id) {
    emit('error', '请先选择一个系统已注册用户')
    return
  }
  savingHall.value = true
  try {
    if (editingHall.value) {
      await api.adminUpdateHallOfFame(editingHall.value.id, { ...hallForm })
      emit('notice', '名人堂成员已更新')
    } else {
      await api.adminCreateHallOfFame({ ...hallForm })
      emit('notice', '名人堂成员已添加')
    }
    closeHallForm()
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '保存失败')
  } finally {
    savingHall.value = false
  }
}

async function deleteHall(m: AdminHallOfFameMember) {
  if (!window.confirm(`从名人堂移除「${m.name}」？此操作不可撤销。`)) return
  try {
    await api.adminDeleteHallOfFame(m.id)
    emit('notice', '名人堂成员已移除')
    await load()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '删除失败')
  }
}

async function moveHall(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= hallOfFame.value.length) return
  const next = [...hallOfFame.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  try {
    hallOfFame.value = await api.adminReorderHall(next.map((h) => h.id))
    emit('notice', '排序已更新')
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '排序失败')
    await load()
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const input = document.createElement('textarea')
    input.value = text
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    try {
      return document.execCommand('copy')
    } finally {
      document.body.removeChild(input)
    }
  }
}

async function copyLink(link: string) {
  if (await copyText(link)) emit('notice', '邀请链接已复制')
  else emit('error', '复制失败，请手动选择链接复制')
}

async function sendInvite() {
  if (!inviteUsers.value.length) {
    emit('error', '请先选择要邀请的用户')
    return
  }
  inviteSending.value = true
  try {
    const users = inviteUsers.value.map((u) =>
      u.user_id > 0 ? { user_id: u.user_id } : { sso_sub: u.sso_sub },
    )
    const res = await api.adminCreateHallInvitesBatch({
      users,
      title: inviteTitle.value.trim() || undefined,
    })
    const firstOk = res.results.find((r) => r.ok)
    lastInviteLink.value = res.success === 1 && firstOk?.link ? firstOk.link : ''
    if (res.failed > 0) {
      const firstError = res.results.find((r) => !r.ok)?.error || '部分邀请失败'
      emit(
        'error',
        `成功 ${res.success} 人，失败 ${res.failed} 人：${firstError}`,
      )
    } else {
      emit(
        'notice',
        res.emailSent === res.success
          ? `已向 ${res.success} 人发送邀请邮件`
          : `已创建 ${res.success} 个邀请，其中 ${res.success - res.emailSent} 个邮件未发送；可在下方复制链接手动发送`,
      )
    }
    inviteUsers.value = []
    inviteTitle.value = ''
    await reloadInvites()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '发送邀请失败')
  } finally {
    inviteSending.value = false
  }
}

async function resendInvite(inv: AdminHallInvite) {
  try {
    const res = await api.adminResendHallInvite(inv.id)
    lastInviteLink.value = res.link
    emit(
      'notice',
      res.emailSent
        ? '邀请邮件已重新发送'
        : '邮件未发送；请复制下方链接手动发送',
    )
    await reloadInvites()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '重发失败')
  }
}

async function revokeInvite(inv: AdminHallInvite) {
  if (!window.confirm(`撤销「${inv.user?.name || '该用户'}」的填写邀请？`)) return
  try {
    await api.adminRevokeHallInvite(inv.id)
    emit('notice', '邀请链接已撤销')
    await reloadInvites()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : '撤销失败')
  }
}

onMounted(load)
</script>

<style scoped>
.history-admin {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.history-admin :deep(.hint) {
  margin: 4px 0 0;
}

.history-admin .btn {
  white-space: nowrap;
}

.col-order {
  width: 68px;
}

.cell-summary {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-status {
  width: 72px;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
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

.invite-notice {
  margin: 14px 0 0;
}

.invite-link-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
  font-size: 12px;
}

.invite-link-row a {
  min-width: 0;
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
  word-break: break-all;
}

.editor-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.editor-bar .hint {
  margin: 0;
}

.content-editor {
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--input-bg);
  outline: none;
  font-size: 13px;
  line-height: 1.75;
  resize: vertical;
}

.content-editor:focus {
  background: #fff;
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
}

.chapter-preview {
  min-height: 220px;
  max-height: 420px;
  overflow: auto;
  padding: 18px 20px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

@media (max-width: 640px) {
  .col-order,
  .col-status {
    width: auto;
  }
}
</style>