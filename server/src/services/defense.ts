import {
  db,
  now,
  type DefenseReviewRow,
  type DefenseRow,
  type DepartmentRow,
  type SeatReviewRow,
  type UserRow,
} from '../db.js'
import {
  departmentSeatStats,
  departmentAdminDepartmentsOf,
  isResourceReviewer,
  isSuperAdminUser,
  joinDepartment,
  userIdentityView,
} from './org.js'

/** 仍在流程中的答辩状态 */
const OPEN_STATUSES: DefenseRow['status'][] = ['submitted', 'level1', 'level2', 'level3', 'waitlist']

export function activeDefenseOf(userId: number): DefenseRow | undefined {
  return db
    .getStore()
    .defenses.find((d) => d.applicant_user_id === userId && OPEN_STATUSES.includes(d.status))
}

export function canInitiateDefense(user: UserRow): { ok: boolean; reason: string; department?: DepartmentRow } {
  if (user.status !== 'active') return { ok: false, reason: '账号已退出开发者体系' }
  if (user.developer_level === 'roundtable') {
    return { ok: false, reason: '你已经是圆桌开发者（技术部成员）' }
  }
  if (user.developer_level !== 'project') {
    return { ok: false, reason: '需先通过部门双选成为项目开发者，才能发起技术部答辩' }
  }
  if (!user.primary_department_id) {
    return { ok: false, reason: '尚未归属任何部门，请先完成部门双选' }
  }
  const dept = db.getStore().departments.find((d) => d.id === user.primary_department_id)
  if (!dept) return { ok: false, reason: '所属部门不存在，请联系管理员' }
  const active = activeDefenseOf(user.id)
  if (active) return { ok: false, reason: `你已有一场进行中的答辩（#${active.id}）` }
  return { ok: true, reason: '', department: dept }
}

function uniqUsers(users: Array<UserRow | null | undefined>, excludeIds: Set<number>): UserRow[] {
  const seen = new Set<number>()
  const out: UserRow[] = []
  for (const u of users) {
    if (!u || excludeIds.has(u.id) || seen.has(u.id)) continue
    if (u.status !== 'active') continue
    seen.add(u.id)
    out.push(u)
  }
  return out
}

function activeSuperAdmins(): UserRow[] {
  return db.getStore().users.filter((u) => u.status === 'active' && isSuperAdminUser(u))
}

/** 一级评审人：本部门负责人（陈述事实）；负责人缺席时退化为部门管理员/超管 */
function pickLevel1Reviewer(dept: DepartmentRow, applicant: UserRow): UserRow | null {
  const s = db.getStore()
  const exclude = new Set([applicant.id])
  if (dept.head_user_id && !exclude.has(dept.head_user_id)) {
    const head = s.users.find((u) => u.id === dept.head_user_id)
    if (head && head.status === 'active') return head
  }
  const adminIds = (dept.admin_user_ids || '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
  for (const id of adminIds) {
    if (exclude.has(id)) continue
    const u = s.users.find((x) => x.id === id)
    if (u && u.status === 'active') return u
  }
  return activeSuperAdmins().find((u) => !exclude.has(u.id)) || null
}

/** 二级评审人：其他 2-3 个部门负责人（交叉评审，防小圈子） */
function pickLevel2Reviewers(
  dept: DepartmentRow,
  applicant: UserRow,
  excludeIds: Set<number> = new Set(),
): UserRow[] {
  const s = db.getStore()
  const exclude = new Set([applicant.id, ...excludeIds])
  const otherDepts = s.departments.filter((d) => d.id !== dept.id && d.enabled === 1)
  const heads = otherDepts
    .map((d) => s.users.find((u) => u.id === d.head_user_id))
    .filter((u): u is UserRow => Boolean(u))

  let picked = uniqUsers(heads, exclude).slice(0, 3)
  if (picked.length < 2) {
    const admins = otherDepts.flatMap((d) =>
      (d.admin_user_ids || '')
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((id) => s.users.find((u) => u.id === id)),
    )
    picked = uniqUsers([...picked, ...admins], exclude).slice(0, 3)
  }
  if (picked.length < 2) {
    picked = uniqUsers([...picked, ...activeSuperAdmins()], exclude).slice(0, 3)
  }
  return picked
}

/** 三级评审人：学院/外院资源方代表；未配置时由超级管理员承担 */
function pickLevel3Reviewers(applicant: UserRow, dept: DepartmentRow): UserRow[] {
  const s = db.getStore()
  const exclude = new Set([applicant.id])
  // 本部门负责人/管理员回避三级资源评审
  if (dept.head_user_id) exclude.add(dept.head_user_id)
  for (const raw of (dept.admin_user_ids || '').split(',')) {
    const id = Number(raw.trim())
    if (Number.isFinite(id) && id > 0) exclude.add(id)
  }
  const adminEmails = new Set(
    (dept.admin_emails || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  )
  for (const u of s.users) {
    if (u.email && adminEmails.has(u.email.toLowerCase())) exclude.add(u.id)
  }
  const resources = s.users.filter((u) => u.status === 'active' && isResourceReviewer(u))
  let picked = uniqUsers(resources, exclude)
  if (picked.length) return picked.slice(0, 5)
  picked = uniqUsers(activeSuperAdmins(), exclude)
  if (picked.length) return picked.slice(0, 3)
  // 极端情况下（只有本部门管理员可用）不再回避，保证流程可完成
  return uniqUsers(resources.length ? resources : activeSuperAdmins(), new Set([applicant.id])).slice(0, 3)
}

function addReview(
  defense: DefenseRow,
  level: number,
  reviewer: UserRow | null,
  roleLabel: string,
  isFactOnly: boolean,
): DefenseReviewRow {
  const s = db.getStore()
  const t = now()
  const row: DefenseReviewRow = {
    id: db.nextId('defense_reviews'),
    defense_id: defense.id,
    level,
    reviewer_user_id: reviewer ? reviewer.id : 0,
    reviewer_name: reviewer ? reviewer.name || reviewer.email : '待认领',
    reviewer_department_id: reviewer
      ? s.departments.find((d) => d.head_user_id === reviewer.id)?.id ||
        reviewer.primary_department_id ||
        0
      : 0,
    role_label: roleLabel,
    status: 'pending',
    decision: '',
    score: -1,
    opinion: '',
    is_fact_only: isFactOnly ? 1 : 0,
    created_at: t,
    submitted_at: '',
  }
  s.defense_reviews.push(row)
  return row
}

function ensureLevel2Reviews(defense: DefenseRow, applicant: UserRow, dept: DepartmentRow): void {
  const s = db.getStore()
  const existing = s.defense_reviews.filter((r) => r.defense_id === defense.id && r.level === 2)
  if (existing.length) return
  // 本部门负责人/管理员、一级陈述人必须回避二级交叉评审
  const exclude = new Set<number>()
  for (const r of s.defense_reviews) {
    if (r.defense_id === defense.id && r.level === 1 && r.reviewer_user_id) {
      exclude.add(r.reviewer_user_id)
    }
  }
  if (dept.head_user_id) exclude.add(dept.head_user_id)
  for (const raw of (dept.admin_user_ids || '').split(',')) {
    const id = Number(raw.trim())
    if (Number.isFinite(id) && id > 0) exclude.add(id)
  }
  const reviewerEmailSet = new Set(
    (dept.admin_emails || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  )
  for (const u of s.users) {
    if (u.email && reviewerEmailSet.has(u.email.toLowerCase())) exclude.add(u.id)
  }
  const reviewers = pickLevel2Reviewers(dept, applicant, exclude)
  if (!reviewers.length) {
    addReview(defense, 2, null, '交叉评审（开放，由管理员认领）', false)
    return
  }
  for (const r of reviewers) {
    addReview(
      defense,
      2,
      r,
      s.departments.find((d) => d.head_user_id === r.id) ? '其他部门负责人（交叉评审）' : '交叉评审',
      false,
    )
  }
}

function ensureLevel3Reviews(defense: DefenseRow, applicant: UserRow, dept: DepartmentRow): void {
  const s = db.getStore()
  const existing = s.defense_reviews.filter((r) => r.defense_id === defense.id && r.level === 3)
  if (existing.length) return
  const reviewers = pickLevel3Reviewers(applicant, dept)
  if (!reviewers.length) {
    addReview(defense, 3, null, '学院/外院资源方代表（开放，由管理员认领）', false)
    return
  }
  for (const r of reviewers) {
    addReview(
      defense,
      3,
      r,
      isResourceReviewer(r) ? '学院/外院资源方代表' : '资源方评审（超级管理员代行）',
      false,
    )
  }
}

export function createDefense(
  user: UserRow,
  input: { title?: string; statement: string; proposal: string; achievements?: string },
): { defense?: DefenseRow; error?: string } {
  const check = canInitiateDefense(user)
  if (!check.ok || !check.department) return { error: check.reason }
  const statement = String(input.statement || '').trim().slice(0, 8000)
  const proposal = String(input.proposal || '').trim().slice(0, 8000)
  const achievements = String(input.achievements || '').trim().slice(0, 8000)
  if (proposal.length < 30) {
    return { error: '答辩核心主张至少 30 字：请具体说明进入技术部后如何帮助学院更好分配资源' }
  }
  if (!statement) return { error: '请填写个人陈述' }

  const s = db.getStore()
  const t = now()
  const title =
    String(input.title || '').trim().slice(0, 100) ||
    `${new Date().getFullYear()} 技术部答辩 · ${user.name || user.email || user.developer_no}`
  const defense: DefenseRow = {
    id: db.nextId('defenses'),
    applicant_user_id: user.id,
    department_id: check.department.id,
    department_name: check.department.name,
    title,
    statement,
    proposal,
    achievements,
    status: 'level1',
    current_level: 1,
    final_result: '',
    final_note: '',
    decided_by: '',
    decided_at: '',
    created_at: t,
    updated_at: t,
  }
  s.defenses.push(defense)

  const level1 = pickLevel1Reviewer(check.department, user)
  addReview(
    defense,
    1,
    level1,
    level1
      ? check.department.head_user_id === level1.id
        ? '本部门负责人（陈述事实，回避打分）'
        : '本部门管理员（代行事实陈述）'
      : '本部门负责人（开放，由管理员认领）',
    true,
  )
  return { defense }
}

function submitted(reviews: DefenseReviewRow[]): DefenseReviewRow[] {
  return reviews.filter((r) => r.status === 'submitted')
}

function avgScore(reviews: DefenseReviewRow[]): number | null {
  const scores = reviews.map((r) => r.score).filter((n) => Number.isFinite(n) && n >= 0)
  if (!scores.length) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/** 二级评审汇总：至少 2 人（不足 2 人时按实际人数）提交；无人反对、至少 2 票赞成（单人评审时 1 票） */
function level2Verdict(defenseId: number): { ready: boolean; pass: boolean; note: string } {
  const reviews = db.getStore().defense_reviews.filter((r) => r.defense_id === defenseId && r.level === 2)
  const done = submitted(reviews)
  const needed = Math.min(2, Math.max(1, reviews.length))
  if (done.length < needed) return { ready: false, pass: false, note: '' }
  const approvals = done.filter((r) => r.decision === 'approve').length
  const rejects = done.filter((r) => r.decision === 'reject').length
  const avg = avgScore(done)
  const needApprovals = reviews.length === 1 ? 1 : 2
  const pass = rejects === 0 && approvals >= needApprovals && (avg === null || avg >= 60)
  const note = `交叉评审 ${done.length}/${reviews.length} 人提交：赞成 ${approvals}，反对 ${rejects}${
    avg === null ? '' : `，平均分 ${avg.toFixed(1)}`
  }`
  return { ready: true, pass, note }
}

/** 三级评审汇总：资源方代表至少 1 人提交；无人反对、至少 1 票赞成、平均分 >= 60 */
function level3Verdict(defenseId: number): { ready: boolean; pass: boolean; note: string } {
  const reviews = db.getStore().defense_reviews.filter((r) => r.defense_id === defenseId && r.level === 3)
  const done = submitted(reviews)
  const needed = Math.min(2, Math.max(1, reviews.length))
  if (done.length < needed) return { ready: false, pass: false, note: '' }
  const approvals = done.filter((r) => r.decision === 'approve').length
  const rejects = done.filter((r) => r.decision === 'reject').length
  const avg = avgScore(done)
  const pass = rejects === 0 && approvals >= 1 && (avg === null || avg >= 60)
  const note = `资源方评审 ${done.length}/${reviews.length} 人提交：赞成 ${approvals}，反对 ${rejects}${
    avg === null ? '' : `，平均分 ${avg.toFixed(1)}`
  }`
  return { ready: true, pass, note }
}

/** 通过后按部门席位决定：有空位 → 圆桌开发者；无空位 → 候补席位 */
function finalizePass(defense: DefenseRow, note: string, by: string): void {
  const s = db.getStore()
  const t = now()
  const dept = s.departments.find((d) => d.id === defense.department_id)
  const applicant = s.users.find((u) => u.id === defense.applicant_user_id)
  if (!dept || !applicant) {
    defense.status = 'rejected'
    defense.final_result = 'rejected'
    defense.final_note = '答辩通过，但部门或申请人已不存在'
    defense.decided_by = by
    defense.decided_at = t
    defense.current_level = 0
    defense.updated_at = t
    return
  }
  const stats = departmentSeatStats(dept)
  if (stats.available <= 0) {
    defense.status = 'waitlist'
    defense.final_result = 'waitlist'
    defense.final_note = `${note ? `${note}；` : ''}本部门技术部席位已满（${stats.occupied}/${stats.total}），进入候补队列`
    defense.decided_by = by
    defense.decided_at = t
    defense.current_level = 0
    defense.updated_at = t
    return
  }
  applicant.developer_level = 'roundtable'
  applicant.roundtable_joined_at = t
  applicant.status = 'active'
  defense.status = 'passed'
  defense.final_result = 'passed'
  defense.final_note = note
  defense.decided_by = by
  defense.decided_at = t
  defense.current_level = 0
  defense.updated_at = t
  // 圆桌成员应保持部门在组关系
  if (applicant.primary_department_id !== dept.id) {
    joinDepartment(applicant, dept, { note: '圆桌答辩通过后归位' })
  }
}

function finalizeReject(defense: DefenseRow, note: string, by: string): void {
  const t = now()
  defense.status = 'rejected'
  defense.final_result = 'rejected'
  defense.final_note = note
  defense.decided_by = by
  defense.decided_at = t
  defense.current_level = 0
  defense.updated_at = t
}

/** 推进答辩流程（每提交一份评审后调用） */
export function advanceDefense(defense: DefenseRow): void {
  const s = db.getStore()
  const applicant = s.users.find((u) => u.id === defense.applicant_user_id)
  const dept = s.departments.find((d) => d.id === defense.department_id)
  if (!applicant || !dept) return
  const t = now()

  if (defense.status === 'level1' || defense.status === 'submitted') {
    const level1 = s.defense_reviews.filter((r) => r.defense_id === defense.id && r.level === 1)
    if (!submitted(level1).length) return
    defense.status = 'level2'
    defense.current_level = 2
    defense.updated_at = t
    ensureLevel2Reviews(defense, applicant, dept)
    return
  }

  if (defense.status === 'level2') {
    ensureLevel2Reviews(defense, applicant, dept)
    const verdict = level2Verdict(defense.id)
    if (!verdict.ready) return
    if (!verdict.pass) {
      finalizeReject(defense, `二级交叉评审未通过。${verdict.note}`, '评审团')
      return
    }
    defense.status = 'level3'
    defense.current_level = 3
    defense.final_note = verdict.note
    defense.updated_at = t
    ensureLevel3Reviews(defense, applicant, dept)
    return
  }

  if (defense.status === 'level3') {
    ensureLevel3Reviews(defense, applicant, dept)
    const verdict = level3Verdict(defense.id)
    if (!verdict.ready) return
    if (!verdict.pass) {
      finalizeReject(defense, `三级资源方评审未通过。${verdict.note}`, '评审团')
      return
    }
    finalizePass(defense, verdict.note, '评审团')
  }
}

export function canSubmitReview(user: UserRow, review: DefenseReviewRow): boolean {
  if (review.status !== 'pending') return false
  const defense = db.getStore().defenses.find((d) => d.id === review.defense_id)
  if (!defense) return false
  if (defense.applicant_user_id === user.id) return false
  if (isSuperAdminUser(user)) return true
  if (review.reviewer_user_id === user.id) return true
  if (review.reviewer_user_id === 0) {
    if (review.level === 3) return isResourceReviewer(user)
    return (
      isResourceReviewer(user) ||
      departmentAdminDepartmentsOf(user).length > 0 ||
      db.getStore().departments.some((d) => d.head_user_id === user.id)
    )
  }
  return false
}

export function submitReview(
  user: UserRow,
  review: DefenseReviewRow,
  input: { decision: string; score?: number; opinion?: string },
): { error?: string; defense?: DefenseRow } {
  if (!canSubmitReview(user, review)) return { error: '无权评审该答辩，或已提交过' }
  const opinion = String(input.opinion || '').trim().slice(0, 4000)
  const isFact = review.level === 1
  if (isFact) {
    if (!opinion) return { error: '一级评审需陈述事实（可只记录产出、投入与协作情况，回避打分）' }
    review.decision = 'fact'
    review.score = -1
  } else {
    const decision = String(input.decision || '').trim()
    if (decision !== 'approve' && decision !== 'reject') {
      return { error: '请选择赞成或反对' }
    }
    let score = Number(input.score)
    if (!Number.isFinite(score)) score = -1
    if (score >= 0) score = Math.min(100, Math.max(0, Math.round(score)))
    if (!opinion) return { error: '请填写评审意见' }
    review.decision = decision
    review.score = score
  }
  review.opinion = opinion
  review.status = 'submitted'
  review.submitted_at = now()
  if (!review.reviewer_user_id) {
    review.reviewer_user_id = user.id
    review.reviewer_name = user.name || user.email
  }
  const defense = db.getStore().defenses.find((d) => d.id === review.defense_id)
  if (defense) {
    defense.updated_at = now()
    advanceDefense(defense)
  }
  return { defense }
}

/** 超级管理员人工裁决（可越过未完成的评审，但通过仍需席位） */
export function forceDecide(
  defense: DefenseRow,
  decision: 'pass' | 'reject',
  note: string,
  by: string,
): { error?: string } {
  if (defense.status === 'withdrawn' || defense.status === 'passed' || defense.status === 'rejected') {
    return { error: '该答辩已结束' }
  }
  if (decision === 'pass') finalizePass(defense, note || '超级管理员裁决通过', by)
  else finalizeReject(defense, note || '超级管理员裁决未通过', by)
  return {}
}

/** 退出圆桌：释放席位并自动递补候补者 */
export function releaseRoundtableSeat(
  user: UserRow,
  opts: { reason: string; by: string; year?: number; outputScore?: number; record?: boolean },
): SeatReviewRow | null {
  const s = db.getStore()
  if (user.developer_level !== 'roundtable') return null
  const t = now()
  const deptId = user.primary_department_id
  user.developer_level = 'project'
  user.roundtable_joined_at = ''
  let row: SeatReviewRow | null = null
  if (opts.record !== false) {
    row = {
      id: db.nextId('seat_reviews'),
      user_id: user.id,
      department_id: deptId,
      year: opts.year || new Date().getFullYear(),
      output_score: Math.max(0, Math.min(100, Number(opts.outputScore) || 0)),
      passed: 0,
      result: 'exited',
      note: opts.reason.slice(0, 2000),
      reviewer: opts.by,
      decided_at: t,
      created_at: t,
      updated_at: t,
    }
    s.seat_reviews.push(row)
  }
  promoteWaitlist(deptId)
  return row
}

/** 年度复审：记录结果；未达标则退出圆桌并释放席位 */
export function recordSeatReview(
  user: UserRow,
  input: { year: number; outputScore: number; passed: boolean; note?: string },
  by: string,
): SeatReviewRow {
  const s = db.getStore()
  const t = now()
  const deptId = user.primary_department_id
  const row: SeatReviewRow = {
    id: db.nextId('seat_reviews'),
    user_id: user.id,
    department_id: deptId,
    year: input.year,
    output_score: Math.max(0, Math.min(100, Number(input.outputScore) || 0)),
    passed: input.passed ? 1 : 0,
    result: input.passed ? 'kept' : 'exited',
    note: String(input.note || '').slice(0, 2000),
    reviewer: by,
    decided_at: t,
    created_at: t,
    updated_at: t,
  }
  s.seat_reviews.push(row)
  if (!input.passed) {
    user.developer_level = 'project'
    user.roundtable_joined_at = ''
    promoteWaitlist(deptId)
  }
  return row
}

/** 席位释放后按发起时间自动递补候补答辩 */
export function promoteWaitlist(departmentId: number): number {
  const s = db.getStore()
  const dept = s.departments.find((d) => d.id === departmentId)
  if (!dept) return 0
  let promoted = 0
  while (true) {
    const stats = departmentSeatStats(dept)
    if (stats.available <= 0) break
    const next = s.defenses
      .filter((d) => d.department_id === departmentId && d.status === 'waitlist')
      .sort((a, b) => a.id - b.id)[0]
    if (!next) break
    finalizePass(next, '席位释放，按候补顺序递补进入圆桌', '席位递补')
    promoted += 1
  }
  return promoted
}

/** 答辩详情（评审意见对申请人、评审人与管理员透明） */
export function defenseView(defense: DefenseRow) {
  const s = db.getStore()
  const applicant = s.users.find((u) => u.id === defense.applicant_user_id)
  const dept = s.departments.find((d) => d.id === defense.department_id)
  const reviews = s.defense_reviews
    .filter((r) => r.defense_id === defense.id)
    .sort((a, b) => a.level - b.level || a.id - b.id)
  const seat = dept
    ? departmentSeatStats(dept)
    : { total: 0, occupied: 0, available: 0, waitlist: 0, members: 0, roundtableMembers: [] }
  return {
    ...defense,
    applicant: applicant ? userIdentityView(applicant) : null,
    department: dept ? { id: dept.id, name: dept.name, slug: dept.slug, color: dept.color } : null,
    seat: {
      total: seat.total,
      occupied: seat.occupied,
      available: seat.available,
      waitlist: seat.waitlist,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      level: r.level,
      reviewer_user_id: r.reviewer_user_id,
      reviewer_name: r.reviewer_name,
      role_label: r.role_label,
      status: r.status,
      decision: r.decision,
      score: r.score,
      opinion: r.opinion,
      is_fact_only: r.is_fact_only === 1,
      submitted_at: r.submitted_at,
      created_at: r.created_at,
    })),
    my_review_ids: [],
  }
}

/** 申请人 / 评审人 / 管理员可见 */
export function canViewDefense(user: UserRow, defense: DefenseRow): boolean {
  if (defense.applicant_user_id === user.id) return true
  if (isSuperAdminUser(user)) return true
  if (user.reviewer_role === 'resource' && defense.status === 'level3') return true
  if (db.getStore().defense_reviews.some((r) => r.defense_id === defense.id && r.reviewer_user_id === user.id)) {
    return true
  }
  return departmentAdminDepartmentsOf(user).some((d) => d.id === defense.department_id)
}