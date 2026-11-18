export const TYPE_LABELS: Record<string, string> = {
  fulltime: '团队成员',
  intern: '项目成员',
  // 旧数据兼容：历史 parttime 不再新增，展示为团队成员
  parttime: '团队成员',
}

export function typeLabel(t: string): string {
  return TYPE_LABELS[t] || t || '团队成员'
}

export function typeClass(t: string): string {
  if (t === 'intern') return 'badge-green'
  return 'badge-blue'
}

export function statusLabel(s: string): string {
  return (
    {
      pending: '待处理',
      passed: '初审通过',
      rejected: '未通过',
    } as Record<string, string>
  )[s] || s || '待处理'
}

export function statusClass(s: string): string {
  return (
    {
      pending: 'badge-amber',
      passed: 'badge-green',
      rejected: 'badge-red',
    } as Record<string, string>
  )[s] || 'badge'
}

export function stageLabel(s: string): string {
  return (
    {
      submitted: '已投递 · 待沟通',
      interview: '已约沟通',
      offered: '部门已通过 · 待本人确认',
      joined: '已加入 · 项目开发者',
      rejected: '未匹配',
      withdrawn: '已撤回',
    } as Record<string, string>
  )[s] || s || '已投递'
}

export function stageClass(s: string): string {
  return (
    {
      submitted: 'badge-blue',
      interview: 'badge-amber',
      offered: 'badge-green',
      joined: 'badge-green',
      rejected: 'badge-red',
      withdrawn: 'badge',
    } as Record<string, string>
  )[s] || 'badge'
}

export function levelLabel(l: string): string {
  return (
    {
      market: '集市开发者',
      project: '项目开发者',
      roundtable: '技术部成员',
    } as Record<string, string>
  )[l] || '集市开发者'
}

export function levelClass(l: string): string {
  if (l === 'roundtable') return 'badge-amber'
  if (l === 'project') return 'badge-green'
  return 'badge-blue'
}

export function defenseStatusLabel(s: string): string {
  return (
    {
      submitted: '待一级陈述',
      level1: '一级 · 本部门陈述事实',
      level2: '二级 · 交叉评审',
      level3: '三级 · 资源方评审',
      waitlist: '候补席位',
      passed: '已进入圆桌',
      rejected: '未通过',
      withdrawn: '已撤回',
    } as Record<string, string>
  )[s] || s || '未知'
}

export function defenseStatusClass(s: string): string {
  if (s === 'passed') return 'badge-green'
  if (s === 'rejected') return 'badge-red'
  if (s === 'waitlist') return 'badge-amber'
  if (s === 'withdrawn') return 'badge'
  return 'badge-blue'
}

export function decisionLabel(d: string): string {
  return (
    {
      fact: '已陈述事实',
      approve: '赞成',
      reject: '反对',
      abstain: '回避',
      '': '待评审',
    } as Record<string, string>
  )[d] || d
}

export function oaLabel(s: string): string {
  return (
    {
      pending: '审批中',
      approved: '审批通过',
      rejected: '未通过',
    } as Record<string, string>
  )[s] || (s ? s : '未提交')
}

export function oaClass(s: string): string {
  return (
    {
      pending: 'badge-amber',
      approved: 'badge-green',
      rejected: 'badge-red',
    } as Record<string, string>
  )[s] || 'badge'
}

export function actionLabel(a: string): string {
  return (
    {
      submit: '提交',
      approve: '通过',
      reject: '驳回',
      revoke: '撤回',
      comment: '备注',
    } as Record<string, string>
  )[a] || a
}

export function formatDate(s: string | undefined | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(s: string | undefined | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function safeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean)
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

export function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? `${s.slice(0, n)}…` : s
}
