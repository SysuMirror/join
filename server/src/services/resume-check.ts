import type { ResumeRow } from '../db.js'

const has = (v: string | null | undefined): boolean => Boolean(String(v || '').trim())

/**
 * 常驻招聘自动通过前，检查简历是否填写完整。
 * 返回缺失项的中文标签；空数组表示可以自动通过。
 */
export function resumeMissingFields(resume: ResumeRow): string[] {
  const missing: string[] = []
  if (!has(resume.name)) missing.push('姓名')
  // 新表单使用 grade；旧数据用 education 兜底
  if (!has(resume.grade) && !has(resume.education)) missing.push('年级')
  if (!has(resume.email) && !has(resume.phone)) missing.push('邮箱')
  if (!has(resume.summary)) missing.push('简介')
  return missing
}

export function resumeIsComplete(resume: ResumeRow): boolean {
  return resumeMissingFields(resume).length === 0
}