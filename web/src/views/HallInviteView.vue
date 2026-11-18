<template>
  <div class="page invite-page">
    <SiteHeader />

    <main class="page-main invite-main">
      <div v-if="loading" class="invite-loading">正在加载邀请…</div>
      <p v-else-if="error" class="notice notice-error">{{ error }}</p>

      <template v-else-if="info">
        <header class="invite-hero">
          <p class="eyebrow">
            <span class="eyebrow-line" />
            <span>{{ info.invite.status === 'submitted' ? '已提交 · 可继续更新' : '年鉴 · 名人堂邀请' }}</span>
          </p>
          <h1 class="invite-title">填写你的名人堂资料</h1>
          <p class="invite-sub">
            这份资料会展示在「软工集市年鉴 · 名人堂」。寄语和自我介绍由你本人填写；职位、贡献、部门与联系方式等管理员可协助整理。
          </p>

          <div class="invite-user">
            <span class="invite-avatar">
              <img v-if="info.user.avatar" :src="info.user.avatar" :alt="info.user.name" />
              <span v-else>{{ initial(info.user.name) }}</span>
            </span>
            <span class="invite-user-copy">
              <strong>{{ info.user.name }}</strong>
              <span class="muted small">
                {{ info.user.email }}<template v-if="info.user.developer_no"> · {{ info.user.developer_no }}</template>
              </span>
            </span>
            <span class="badge badge-blue">姓名 / 头像来自你的集市账号</span>
          </div>
        </header>

        <p v-if="success" class="notice notice-success">
          资料已保存。链接有效期内你可以随时回来更新。
        </p>
        <p v-if="formError" class="notice notice-error">{{ formError }}</p>

        <form class="card panel invite-form" @submit.prevent="submit">
          <div class="fields">
            <div class="field">
              <label>头衔</label>
              <input v-model="form.title" maxlength="80" placeholder="如：创始人 / 首任技术部负责人" />
            </div>
            <div class="field">
              <label>年份 / 届次</label>
              <input v-model="form.year" maxlength="40" placeholder="如：2021 / 首届" />
            </div>
            <div class="field">
              <label>一句话寄语</label>
              <input v-model="form.quote" maxlength="300" placeholder="展示在卡片上的一句话" />
            </div>
            <div class="field full">
              <label>自我介绍 *</label>
              <textarea
                v-model="form.bio"
                rows="6"
                maxlength="8000"
                required
                placeholder="介绍一下你自己：方向、经历、正在做的事…"
              />
              <span class="hint">支持 Markdown：标题、列表、引用、表格、链接、代码块。</span>
            </div>
            <div class="field full">
              <label>贡献</label>
              <textarea
                v-model="form.achievements"
                rows="5"
                maxlength="6000"
                placeholder="做过的项目、承担的角色、可量化的产出等（可选）"
              />
              <span class="hint">这部分管理员后续可以帮你整理和补充。</span>
            </div>
            <div class="field full">
              <label>集市主页账号</label>
              <input v-model="form.market_url" maxlength="500" placeholder="https://ssemarket.cn/…" />
              <span class="hint">填写后会展示「打开主页」入口；留空则不展示。</span>
            </div>
            <div class="field">
              <label>联系邮箱</label>
              <input
                v-model="form.contact_email"
                maxlength="120"
                placeholder="选填，如 name@example.com"
              />
            </div>
            <div class="field">
              <label>联系微信</label>
              <input v-model="form.contact_wechat" maxlength="120" placeholder="选填" />
            </div>
            <div class="field full">
              <label>其他联系方式 / 主页</label>
              <input v-model="form.contact_other" maxlength="500" placeholder="GitHub、博客等链接；留空不展示" />
            </div>
          </div>

          <div class="invite-actions">
            <button class="btn btn-primary btn-lg" type="submit" :disabled="saving">
              {{ saving ? '保存中…' : '保存资料' }}
            </button>
            <span class="hint">姓名和头像会自动使用你的集市账号资料。</span>
          </div>
        </form>

        <footer class="invite-foot">
          链接有效期至 {{ formatDate(info.invite.expires_at) }}。如链接失效，请联系管理员重新发送。
        </footer>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type HallInviteInfo } from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { formatDate } from '../utils/labels'

const route = useRoute()
const info = ref<HallInviteInfo | null>(null)
const loading = ref(true)
const error = ref('')
const formError = ref('')
const success = ref(false)
const saving = ref(false)

const form = reactive({
  title: '',
  year: '',
  quote: '',
  bio: '',
  achievements: '',
  market_url: '',
  contact_email: '',
  contact_wechat: '',
  contact_other: '',
})

function initial(name: string): string {
  return (name || '?').trim().slice(0, 1).toUpperCase()
}

function fillForm(data: HallInviteInfo) {
  const entry = data.entry
  form.title = entry?.title || data.invite.title || ''
  form.year = entry?.year || ''
  form.quote = entry?.quote || ''
  form.bio = entry?.bio || ''
  form.achievements = entry?.achievements || ''
  form.market_url = entry?.market_url || ''
  form.contact_email = entry?.contact_email || ''
  form.contact_wechat = entry?.contact_wechat || ''
  form.contact_other = entry?.contact_other || ''
}

async function load() {
  loading.value = true
  try {
    const data = await api.hallInvite(String(route.params.token || ''))
    info.value = data
    fillForm(data)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '邀请链接不可用'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!info.value || saving.value) return
  formError.value = ''
  success.value = false
  if (!form.bio.trim()) {
    formError.value = '请填写自我介绍'
    return
  }
  saving.value = true
  try {
    const res = await api.submitHallInvite(String(route.params.token || ''), { ...form })
    info.value = {
      ...info.value,
      entry: res.entry,
      invite: { ...info.value.invite, status: 'submitted' },
    }
    success.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.invite-main {
  max-width: 860px;
  padding-bottom: 72px;
}

.invite-loading {
  padding: 80px 0;
  color: var(--ink-faint);
  font-size: 13px;
  text-align: center;
}

.invite-hero {
  padding-bottom: 28px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--line);
}

.invite-title {
  margin: 16px 0 0;
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.04em;
}

.invite-sub {
  max-width: 620px;
  margin: 14px 0 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.8;
}

.invite-user {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.invite-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--ink-soft);
  font-size: 16px;
  font-weight: 700;
}

.invite-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.invite-user-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.invite-form {
  margin-top: 6px;
}

.invite-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.invite-actions .hint {
  margin: 0;
}

.invite-foot {
  margin-top: 22px;
  color: var(--ink-faint);
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 640px) {
  .invite-main {
    padding-bottom: 48px;
  }

  .invite-user {
    align-items: flex-start;
  }
}
</style>