import { Router } from 'express'
import { db } from '../db.js'
import { ok } from '../middleware.js'

export const faqsRouter = Router()

/** GET /api/faqs — 常见问题（可选 category 筛选） */
faqsRouter.get('/', (req, res) => {
  const category = String(req.query.category || '').trim()
  const q = String(req.query.q || '').trim().toLowerCase()
  let rows = db
    .getStore()
    .faqs.filter((f) => f.enabled === 1)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  if (category) rows = rows.filter((f) => f.category === category)
  if (q) {
    rows = rows.filter((f) =>
      `${f.question} ${f.answer} ${f.category}`.toLowerCase().includes(q),
    )
  }
  ok(
    res,
    rows.map((f) => ({
      id: f.id,
      category: f.category,
      question: f.question,
      answer: f.answer,
      sort_order: f.sort_order,
    })),
  )
})
