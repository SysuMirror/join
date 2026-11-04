/**
 * PDF 简历文本 → 结构化字段的启发式解析。
 * 目标不是「100% 准确」，而是把常见信息预填到表单，减少候选人手工输入；
 * 所有结果都可以在简历编辑页修改。
 */

export type ParsedResume = {
  name: string
  phone: string
  email: string
  city: string
  intention: string
  education: string
  school: string
  major: string
  graduation_year: string
  experience_years: number
  skills: string
  summary: string
  work_experience: string
  project_experience: string
  education_experience: string
}

const CITY_LIST = [
  '北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '苏州',
  '重庆', '天津', '长沙', '郑州', '合肥', '厦门', '福州', '济南', '青岛', '大连',
  '宁波', '东莞', '佛山', '珠海', '无锡', '南昌', '昆明', '贵阳', '南宁', '海口',
  '香港', '澳门', '台北', '远程',
]

const KNOWN_SKILLS = [
  'TypeScript', 'JavaScript', 'Node.js', 'Vue', 'Vue3', 'React', 'Angular', 'Next.js',
  'Nuxt', 'Java', 'Spring Boot', 'Python', 'Django', 'Flask', 'FastAPI', 'Go', 'Golang',
  'Rust', 'C++', 'C#', 'PHP', 'Kotlin', 'Swift', 'Objective-C', 'SQL', 'MySQL',
  'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'RabbitMQ', 'Docker',
  'Kubernetes', 'K8s', 'Linux', 'Git', 'Nginx', 'AWS', '阿里云', '腾讯云', '微服务',
  '分布式', '高并发', '大模型', 'LLM', 'RAG', 'Agent', 'Prompt', 'PyTorch',
  'TensorFlow', '机器学习', '深度学习', 'NLP', 'CV', '数据分析', 'Figma', 'Sketch',
  'Photoshop', 'UI设计', '交互设计', '产品设计', '项目管理', 'PRD', 'Axure',
]

const ALL_HEADINGS = [
  '个人信息', '基本信息', '联系方式', '求职意向', '意向岗位', '教育经历', '教育背景',
  '工作经历', '工作经验', '实习经历', '项目经历', '项目经验', '专业技能', '技能特长',
  '技能', '技术栈', '自我评价', '个人总结', '荣誉奖项', '获奖经历', '证书', '校园经历',
]

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function cleanHeading(line: string): string {
  return cleanLine(line)
    .replace(/^[#>*\-\s•·]+/, '')
    .replace(/[：:]\s*$/, '')
    .replace(/\s+/g, '')
}

function isHeading(line: string): boolean {
  const h = cleanHeading(line)
  if (!h || h.length > 12) return false
  return ALL_HEADINGS.some((x) => h === x || h.startsWith(x))
}

function sectionOf(lines: string[], headings: string[]): string {
  let start = -1
  let end = lines.length
  for (let i = 0; i < lines.length; i++) {
    const h = cleanHeading(lines[i])
    if (!h) continue
    if (headings.some((x) => h === x || h.startsWith(x))) {
      start = i + 1
      break
    }
  }
  if (start < 0) return ''
  for (let j = start; j < lines.length; j++) {
    if (isHeading(lines[j])) {
      end = j
      break
    }
  }
  return lines
    .slice(start, end)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 5000)
}

function pickName(nonEmpty: string[], fileName: string): string {
  const bad =
    /@|简历|求职|应聘|电话|手机|邮箱|微信|大学|学院|专业|经验|工程师|开发|岗位|男|女|出生|地址/i
  for (const line of nonEmpty.slice(0, 12)) {
    const l = cleanLine(line)
    if (!l || bad.test(l)) continue
    if (/^[一-龥·]{2,4}$/.test(l)) return l
    if (/^[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2}$/.test(l) && l.length <= 40) return l
  }
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/简历|resume|cv|个人|应聘/gi, '')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
  return base.length >= 2 && base.length <= 20 ? base : ''
}

function pickEducation(text: string): string {
  if (/博士|Ph\.?\s*D/i.test(text)) return '博士'
  if (/硕士|研究生|Master/i.test(text)) return '硕士'
  if (/本科|学士|Bachelor/i.test(text)) return '本科'
  if (/大专|专科|高职/.test(text)) return '大专'
  if (/高中|中专/.test(text)) return '高中'
  return ''
}

function pickSchool(text: string): string {
  const re = /([一-龥]{2,20}(?:大学|学院|学校))/g
  for (const m of text.matchAll(re)) {
    const s = m[1].replace(/^(毕业于|就读于|学校|院校)[：:\s]*/, '')
    if (s.length >= 4 && !/^(大学|学院|学校)$/.test(s)) return s
  }
  const en = text.match(/\b([A-Z][A-Za-z.&'\- ]{2,50}(?:University|College|Institute))\b/)
  if (en) return en[1].trim()
  return ''
}

function pickMajor(text: string): string {
  const m = text.match(/(?:专业|主修)[：:\s]*([^\n，,；;。]{2,30})/)
  if (m) return m[1].trim()
  const en = text.match(/(?:Major|Field of Study|Specialization)[:：\s]+([^\n,;]{2,50})/i)
  if (en) return en[1].trim()
  const line = text
    .split('\n')
    .map(cleanLine)
    .find((l) => /专业/.test(l) && l.length <= 60)
  if (line) {
    const idx = line.indexOf('专业')
    const tail = line.slice(idx + 2).replace(/^[：:\s]+/, '').trim()
    if (tail && tail.length <= 30) return tail
  }
  return ''
}

function pickGraduationYear(text: string): string {
  const m = text.match(/(20\d{2})\s*(?:年)?\s*(?:毕业|届)/)
  if (m) return m[1]
  const nowYear = new Date().getFullYear()
  const years = Array.from(text.matchAll(/\b(20\d{2})\b/g))
    .map((x) => Number(x[1]))
    .filter((y) => y >= 1990 && y <= nowYear + 6)
  return years.length ? String(Math.max(...years)) : ''
}

function pickExperienceYears(text: string, workExp: string): number {
  const direct = text.match(/(\d{1,2})\s*年(?:以上)?(?:的)?(?:工作|开发|从业|相关|互联网|项目)?经验/)
  if (direct) return Math.min(60, Number(direct[1]))
  const en = text.match(/(\d{1,2})\s*\+?\s*years?(?:\s+of)?\s+(?:work|experience|professional)/i)
  if (en) return Math.min(60, Number(en[1]))
  const label = text.match(/工作年限[：:\s]*(\d{1,2})/)
  if (label) return Math.min(60, Number(label[1]))
  if (/应届|在校生|实习生/.test(text) && !/工作经历|工作经验/.test(text)) return 0
  const years = Array.from(workExp.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((x) => Number(x[1]))
  if (years.length >= 2) {
    const span = Math.max(...years) - Math.min(...years)
    if (span >= 0 && span <= 50) return span
  }
  return 0
}

function pickCity(text: string): string {
  const explicit = text.match(/(?:现居|所在地|所在城市|城市|期望地点|期望城市)[：:\s]*([一-龥]{2,10})/)
  if (explicit) {
    const v = explicit[1]
    const hit = CITY_LIST.find((c) => v.includes(c))
    if (hit) return hit
  }
  return CITY_LIST.find((c) => text.includes(c)) || ''
}

function pickIntention(text: string): string {
  const m = text.match(
    /(?:求职意向|意向岗位|应聘职位|目标岗位|期望职位|求职岗位)[：:\s]*([^\n]{2,40})/,
  )
  if (!m) {
    const en = text.match(/(?:Objective|Job Intention|Desired Position)[:：\s]+([^\n]{2,40})/i)
    return en ? en[1].trim().slice(0, 40) : ''
  }
  return m[1]
    .replace(/[|｜].*$/, '')
    .trim()
    .slice(0, 40)
}

function pickSkills(text: string, lines: string[]): string {
  const found: string[] = []
  for (const skill of KNOWN_SKILLS) {
    const re = new RegExp(
      skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      skill.length <= 3 ? 'i' : 'i',
    )
    if (re.test(text)) found.push(skill)
  }
  const skillSection = sectionOf(lines, ['专业技能', '技能特长', '技能', '技术栈'])
  if (skillSection) {
    const tokens = skillSection
      .split(/[\n,，、/|;；·•\s]+/)
      .map((s) => s.replace(/^[\-*]+/, '').trim())
      .filter((s) => s.length >= 1 && s.length <= 20)
      .filter((s) => !/^[。.！!？?]+$/.test(s))
    for (const t of tokens) {
      if (found.length >= 24) break
      if (!found.some((f) => f.toLowerCase() === t.toLowerCase())) found.push(t)
    }
  }
  return Array.from(new Set(found)).slice(0, 24).join(',')
}

function pickSummary(text: string, lines: string[]): string {
  const sec = sectionOf(lines, ['自我评价', '个人总结'])
  if (sec) return sec.slice(0, 1000)
  const candidate = lines
    .map(cleanLine)
    .filter(
      (l) =>
        l.length >= 12 &&
        !/@|https?:\/\/|电话|手机|邮箱|微信/.test(l) &&
        !isHeading(l),
    )
    .slice(0, 3)
    .join(' ')
  return candidate.slice(0, 500)
}

export function parseResumeText(text: string, fileName = ''): ParsedResume {
  const raw = (text || '').replace(/\r\n?/g, '\n')
  const lines = raw.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim())
  const nonEmpty = lines.filter(Boolean)

  const email = raw.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] || ''
  const phone =
    raw.match(/(?:\+?86[-\s]?)?(1[3-9]\d{9})/)?.[1] ||
    raw.match(/(0\d{2,3}[-\s]?\d{7,8})/)?.[1] ||
    ''

  const education = pickEducation(raw)
  const workExp = [
    sectionOf(lines, ['工作经历', '工作经验']),
    sectionOf(lines, ['实习经历']),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000)
  const projectExp = [
    sectionOf(lines, ['项目经历']),
    sectionOf(lines, ['项目经验']),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000)
  const eduExp = [
    sectionOf(lines, ['教育经历']),
    sectionOf(lines, ['教育背景']),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000)

  return {
    name: pickName(nonEmpty, fileName),
    phone,
    email,
    city: pickCity(raw),
    intention: pickIntention(raw),
    education,
    school: pickSchool(raw),
    major: pickMajor(raw),
    graduation_year: pickGraduationYear(raw),
    experience_years: pickExperienceYears(raw, workExp),
    skills: pickSkills(raw, lines),
    summary: pickSummary(raw, lines),
    work_experience: workExp,
    project_experience: projectExp,
    education_experience: eduExp,
  }
}
