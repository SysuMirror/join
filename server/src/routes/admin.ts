import { Router } from 'express'
import { db, now, type ApplicationRow, type JobRow, type SiteConfigRow } from '../db.js'
import { ok, fail, requireAdminToken } from '../middleware.js'
import { submitOa, queryOa } from '../dev-platform.js'
import { buildOaBody } from './jobs.js'

export const adminRouter = Router()

// ===== 管理端：职位 CRUD =====

function mapJob(job: JobRow) {
  return { ...job }
}

adminRouter.get('/jobs', requireAdminToken, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  let rows = [...db.getStore().jobs].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  if (q) {
    rows = rows.filter(
      (j) => j.title.toLowerCase().includes(q) || j.department.toLowerCase().includes(q),
    )
  }
  ok(res, rows.map(mapJob))
})

adminRouter.post('/jobs', requireAdminToken, async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const title = String(b.title || '').trim().slice(0, 100)
  const department = String(b.department || '').trim().slice(0, 60)
  const location = String(b.location || '').trim().slice(0, 60)
  const summary = String(b.summary || '').trim().slice(0, 300)
  const description = String(b.description || '').trim().slice(0, 5000)
  const type = String(b.type || 'fulltime')
  if (!title) {
    fail(res, 400, '职位名称必填')
    return
  }
  if (!['fulltime', 'intern', 'parttime'].includes(type)) {
    fail(res, 400, '职位类型不合法')
    return
  }
  // slug：从 title 派生，撞了就加序号
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `job-${Date.now()}`
  let slug = base
  let seq = 1
  const s = db.getStore()
  while (s.jobs.some((j) => j.slug === slug)) {
    slug = `${base}-${++seq}`
  }
  const t = now()
  const row: JobRow = {
    id: db.nextId('jobs'),
    slug,
    title,
    department,
    location,
    type: type as JobRow['type'],
    summary,
    description,
    headcount: Math.max(0, Number(b.headcount) || 0),
    enabled: b.enabled === false ? 0 : 1,
    sort_order: Number(b.sort_order) || 0,
    created_at: t,
    updated_at: t,
  }
  await db.insert('jobs', row)
  ok(res, mapJob(row))
})

adminRouter.put('/jobs/:id', requireAdminToken, async (req, res) => {
  const s = db.getStore()
  const job = s.jobs.find((j) => j.id === Number(req.params.id))
  if (!job) {
    fail(res, 404, '职位不存在')
    return
  }
  const b = (req.body || {}) as Record<string, unknown>
  if (b.title != null) job.title = String(b.title).trim().slice(0, 100) || job.title
  if (b.department != null) job.department = String(b.department).trim().slice(0, 60)
  if (b.location != null) job.location = String(b.location).trim().slice(0, 60)
  if (b.summary != null) job.summary = String(b.summary).trim().slice(0, 300)
  if (b.description != null) job.description = String(b.description).trim().slice(0, 5000)
  if (b.type != null && ['fulltime', 'intern', 'parttime'].includes(String(b.type))) {
    job.type = String(b.type) as JobRow['type']
  }
  if (b.headcount != null) job.headcount = Math.max(0, Number(b.headcount) || 0)
  if (b.enabled != null) job.enabled = b.enabled === false || b.enabled === 0 ? 0 : 1
  if (b.sort_order != null) job.sort_order = Number(b.sort_order) || 0
  job.updated_at = now()
  await db.persist()
  ok(res, mapJob(job))
})

adminRouter.delete('/jobs/:id', requireAdminToken, async (req, res) => {
  const s = db.getStore()
  const id = Number(req.params.id)
  const idx = s.jobs.findIndex((j) => j.id === id)
  if (idx < 0) {
    fail(res, 404, '职位不存在')
    return
  }
  s.jobs.splice(idx, 1)
  await db.persist()
  ok(res, { id })
})

// ===== 投递审核 =====

function mapApplication(a: ApplicationRow) {
  const job = db.getStore().jobs.find((j) => j.id === a.job_id)
  return {
    ...a,
    jobTitle: job?.title || '',
    jobSlug: job?.slug || '',
    jobDepartment: job?.department || '',
    oaTimeline: safeTimeline(a.oa_timeline),
  }
}

function safeTimeline(json: string) {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

adminRouter.get('/applications', requireAdminToken, (req, res) => {
  const status = String(req.query.status || '').trim()
  let rows = [...db.getStore().applications].sort((a, b) => b.id - a.id)
  if (status) rows = rows.filter((a) => a.status === status || a.oa_status === status)
  ok(res, rows.map(mapApplication))
})

/** 初审通过 → 自动推送开发者平台 OA 审批，并回填 oa_oid/oa_status */
adminRouter.post('/applications/:id/pass', requireAdminToken, async (req, res) => {
  const s = db.getStore()
  const app = s.applications.find((a) => a.id === Number(req.params.id))
  if (!app) {
    fail(res, 404, '投递记录不存在')
    return
  }
  if (app.status === 'pending') {
    // 初次通过：推送 OA
    const job = s.jobs.find((j) => j.id === app.job_id)
    if (!job) {
      fail(res, 400, '关联职位不存在，无法推送')
      return
    }
    const oaBody = buildOaBody(app, job)
    const result = await submitOa(oaBody)
    if (result.error && !result.duplicated) {
      fail(res, result.httpStatus || 502, `推送开发者平台失败：${result.error}`)
      return
    }
    const t = now()
    app.status = 'passed'
    app.oa_oid = oaBody.oaid
    app.oa_status = result.data?.status || 'pending'
    app.oa_timeline = JSON.stringify(result.data?.timeline || [])
    app.reviewer = 'admin'
    app.updated_at = t
    await db.persist()
    ok(res, mapApplication(app), '已通过并推送开发者平台审核')
    return
  }
  // 已经 passed：仅刷新 OA 状态
  const refreshed = await refreshOa(app)
  ok(res, refreshed, '已刷新 OA 状态')
})

/** 初审驳回 */
adminRouter.post('/applications/:id/reject', requireAdminToken, async (req, res) => {
  const s = db.getStore()
  const app = s.applications.find((a) => a.id === Number(req.params.id))
  if (!app) {
    fail(res, 404, '投递记录不存在')
    return
  }
  const note = String((req.body || {}).note || '').trim().slice(0, 500)
  const t = now()
  app.status = 'rejected'
  app.review_note = note || app.review_note
  app.reviewer = 'admin'
  app.updated_at = t
  // 若已推送 OA，则同时再次查询以同步状态（不撤回，流程留给平台）
  await db.persist()
  ok(res, mapApplication(app), '已驳回')
})

/** 手动刷新某条申请的 OA 状态（轮询用） */
async function refreshOa(app: ApplicationRow): Promise<ReturnType<typeof mapApplication>> {
  if (!app.oa_oid) return mapApplication(app)
  const result = await queryOa(app.oa_oid)
  const t = now()
  if (result.data) {
    app.oa_status = result.data.status
    app.oa_timeline = JSON.stringify(result.data.timeline || [])
    app.oa_checked_at = t
    app.updated_at = t
    await db.persist()
  }
  return mapApplication(app)
}

/** POST /admin/refresh-oa — 批量轮询所有已推送且仍 pending 的申请（供前端/定时调用） */
adminRouter.post('/applications/refresh-oa', requireAdminToken, async (req, res) => {
  const s = db.getStore()
  const targets = s.applications.filter(
    (a) => a.status === 'passed' && a.oa_oid && a.oa_status === 'pending',
  )
  let updated = 0
  for (const app of targets) {
    // 简单间隔控制（可选：仅刷新 oa_checked_at 距今 > 30s 的）
    await refreshOa(app)
    updated += 1
  }
  ok(res, { refreshed: updated, total: targets.length })
})

// ===== 管理端：整体统计（可选） =====
adminRouter.get('/stats', requireAdminToken, (_req, res) => {
  const s = db.getStore()
  ok(res, {
    jobs: s.jobs.length,
    applications: s.applications.length,
    pendingReview: s.applications.filter((a) => a.status === 'pending').length,
    passed: s.applications.filter((a) => a.status === 'passed').length,
    oaApproved: s.applications.filter((a) => a.oa_status === 'approved').length,
  })
})

// ===== 管理端：站点文案配置 =====
adminRouter.get('/site', requireAdminToken, (_req, res) => {
  ok(res, db.getStore().site_config)
})

const SITE_FIELDS = [
  'brand',
  'heroTitle',
  'heroSubtitle',
  'announcement',
  'tagline',
  'contactEmail',
  'bgWords',
] as const

adminRouter.put('/site', requireAdminToken, async (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>
  const s = db.getStore()
  const sc: SiteConfigRow = s.site_config
  for (const key of SITE_FIELDS) {
    if (b[key] == null) continue
    const max = key === 'heroSubtitle' || key === 'bgWords' ? 300 : 120
    const val = String(b[key]).slice(0, max)
    if (key === 'contactEmail' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      fail(res, 400, '联系邮箱格式不正确')
      return
    }
    sc[key] = val
  }
  sc.updated_at = now()
  await db.persist()
  ok(res, sc, '站点配置已更新')
})
