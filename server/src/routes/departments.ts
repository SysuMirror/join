import { Router } from 'express'
import { db } from '../db.js'
import { ok, fail } from '../middleware.js'
import { departmentPublicView } from '../services/org.js'

export const departmentsRouter = Router()

function mapDepartment(id: number) {
  const s = db.getStore()
  const d = s.departments.find((x) => x.id === id)
  if (!d) return null
  const jobs = s.jobs.filter((j) => j.enabled === 1 && j.department_id === d.id)
  return {
    ...departmentPublicView(d),
    openJobs: jobs.length,
    directions: Array.from(new Set(jobs.map((j) => j.direction).filter(Boolean))),
  }
}

/** GET /api/departments — 前台展示的部门（含在招职位数） */
departmentsRouter.get('/', (_req, res) => {
  const rows = db
    .getStore()
    .departments.filter((d) => d.enabled === 1)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((d) => mapDepartment(d.id))
    .filter(Boolean)
  ok(res, rows)
})

/** GET /api/departments/:slug — 单个部门 */
departmentsRouter.get('/:slug', (req, res) => {
  const key = String(req.params.slug || '').trim()
  const d = db
    .getStore()
    .departments.find((x) => x.slug === key || String(x.id) === key || x.name === key)
  if (!d || d.enabled !== 1) {
    fail(res, 404, '部门不存在')
    return
  }
  ok(res, mapDepartment(d.id))
})
