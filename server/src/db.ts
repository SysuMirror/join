import { loadStoreRaw, saveStoreRaw } from './storage.js'

/** 招聘职位 */
export type JobRow = {
  id: number
  /** URL 友好标识（职位页 slug） */
  slug: string
  title: string
  department: string
  location: string
  type: 'fulltime' | 'intern' | 'parttime'
  /** 简要描述（列表展示） */
  summary: string
  /** 详细职责/要求（富文本/换行文本） */
  description: string
  /** 招聘人数；0 = 不限 */
  headcount: number
  /** 是否开放投递 */
  enabled: number
  /** 排序（小在前） */
  sort_order: number
  created_at: string
  updated_at: string
}

/** 候选人投递（本平台初审 → 通过后自动推送到开发者平台 OA 审批） */
export type ApplicationRow = {
  id: number
  job_id: number
  /** 姓名（选填，实际可能匿名） */
  name: string
  /** 联系方式（手机/邮箱） */
  contact: string
  /** 附件/简历链接（URL，可选） */
  resume_url: string
  /** 个人简介/自述 */
  note: string
  /** 本平台初审状态：pending=待初审；passed=初审通过（已推 OA）；rejected=初审驳回；early=未通过当前批次 */
  status: 'pending' | 'passed' | 'rejected'
  /** 初审意见（管理端填写） */
  review_note: string
  /** 初审人（admin token 标识） */
  reviewer: string
  /** 推送到开发者平台的 OA oaid（模块内唯一业务键） */
  oa_oid: string
  /** 开发者平台 OA 当前状态（pending/approved/rejected）；从 /api/open/oa/query 轮询回填 */
  oa_status: string
  /** 最后一次查询到 OA 状态的操作时间（用于间隔轮询判断） */
  oa_checked_at: string
  /** OA 完整流转轨迹（原样 JSON，前端展示用） */
  oa_timeline: string
  created_at: string
  updated_at: string
}

type Store = {
  seq: Record<string, number>
  jobs: JobRow[]
  applications: ApplicationRow[]
}

const SEQ_KEYS = ['jobs', 'applications'] as const

function emptyStore(): Store {
  return {
    seq: { jobs: 0, applications: 0 },
    jobs: [],
    applications: [],
  }
}

function nowIso() {
  return new Date().toISOString()
}

function migrate(s: Store): void {
  if (!s.seq) s.seq = emptyStore().seq
  for (const key of SEQ_KEYS) {
    if (s.seq[key] == null || !Number.isFinite(s.seq[key])) s.seq[key] = 0
  }
  if (!s.jobs) s.jobs = []
  if (!s.applications) s.applications = []
  for (const j of s.jobs) {
    if (j.slug == null) j.slug = ''
    if (j.department == null) j.department = ''
    if (j.location == null) j.location = ''
    if (j.summary == null) j.summary = ''
    if (j.description == null) j.description = ''
    if (j.headcount == null || !Number.isFinite(Number(j.headcount))) j.headcount = 0
    if (j.enabled == null) j.enabled = 1
    if (j.sort_order == null) j.sort_order = 0
    if (!['fulltime', 'intern', 'parttime'].includes(String(j.type))) j.type = 'fulltime'
  }
  for (const a of s.applications) {
    if (a.name == null) a.name = ''
    if (a.contact == null) a.contact = ''
    if (a.resume_url == null) a.resume_url = ''
    if (a.note == null) a.note = ''
    if (a.review_note == null) a.review_note = ''
    if (!a.status) a.status = 'pending'
    if (a.oa_oid == null) a.oa_oid = ''
    if (a.oa_status == null) a.oa_status = ''
    if (a.oa_checked_at == null) a.oa_checked_at = ''
    if (a.oa_timeline == null) a.oa_timeline = ''
    if (a.reviewer == null) a.reviewer = ''
  }
}

function parseStore(raw: string | null): Store {
  if (!raw) return emptyStore()
  const s = JSON.parse(raw) as Store
  migrate(s)
  return s
}

async function save(s: Store) {
  await saveStoreRaw(JSON.stringify(s, null, 2))
}

let store: Store = emptyStore()
let ready = false

export async function initDb() {
  const raw = await loadStoreRaw()
  store = parseStore(raw)
  await save(store)
  ready = true
}

export function assertDbReady() {
  if (!ready) throw new Error('数据库尚未初始化，请先 await initDb()')
}

export function now() {
  return new Date().toISOString()
}

function nextId(table: keyof Store['seq']) {
  const cur = Number(store.seq[table])
  store.seq[table] = (Number.isFinite(cur) ? cur : 0) + 1
  return store.seq[table]
}

async function persist() {
  assertDbReady()
  await save(store)
}

export const db = {
  getStore: () => {
    assertDbReady()
    return store
  },
  persist,
  reload: async () => {
    const raw = await loadStoreRaw()
    store = parseStore(raw)
  },
  nextId,
  async insert<K extends (typeof SEQ_KEYS)[number]>(
    table: K,
    row: Omit<Store[K][number], 'id'> & { id?: number },
  ): Promise<Store[K][number]> {
    const created = { ...row, id: row.id ?? nextId(table) } as Store[K][number]
    ;(store[table] as unknown[]).push(created)
    await persist()
    return created
  },
  async transaction<T>(fn: () => T): Promise<T> {
    const snap = JSON.parse(JSON.stringify(store)) as Store
    try {
      const r = fn()
      await persist()
      return r
    } catch (e) {
      store = snap
      throw e
    }
  },
}

export type { Store }
