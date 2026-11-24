import { loadStoreRaw, saveStoreRaw } from './storage.js'

/** 开发者身份层级：集市开发者 → 项目开发者 → 圆桌开发者（技术部） */
export type DeveloperLevel = 'market' | 'project' | 'roundtable'

/** 系统角色：普通开发者 / 超级管理员 */
export type SystemRole = 'user' | 'super_admin'

/** 评审角色：普通成员 / 学院（外院）资源方代表（答辩三级评审） */
export type ReviewerRole = '' | 'resource'

/** 项目部门（集市下的团队/部门） */
export type DepartmentRow = {
  id: number
  /** 部门名称（唯一性由管理端保证） */
  name: string
  /** URL 友好标识（筛选参数用） */
  slug: string
  /** 一句话介绍（列表/首页卡片） */
  summary: string
  /** 详细介绍（部门页/职位详情） */
  description: string
  /** 主题色（十六进制，可选） */
  color: string
  /** 部门管理员邮箱（逗号分隔；兼容旧数据） */
  admin_emails: string
  /** 部门管理员用户 id（逗号分隔；后台按用户授权） */
  admin_user_ids: string
  /** 部门负责人 user id（0 = 未设置；一级答辩陈述人） */
  head_user_id: number
  /** 技术部保底席位（每个部门至少 1 个） */
  base_seats: number
  /** 技术部浮动席位（按产出由圆桌评估发放） */
  floating_seats: number
  /** 量化产出：交付量（0-100） */
  output_delivery: number
  /** 量化产出：使用量（0-100） */
  output_usage: number
  /** 量化产出：出人贡献（向其他节点输送人才，0-100） */
  output_talent: number
  /** 量化产出：社区活跃度（0-100） */
  output_activity: number
  /** 产出说明（公开给全体开发者监督） */
  output_note: string
  /** 是否在前台展示 */
  enabled: number
  /** 排序（小在前） */
  sort_order: number
  created_at: string
  updated_at: string
}

/** 部门岗位 */
export type JobRow = {
  id: number
  /** URL 友好标识（职位页 slug） */
  slug: string
  title: string
  /** 所属部门 id（0 = 未关联） */
  department_id: number
  /** 部门名称快照（便于列表展示/兼容旧数据） */
  department: string
  /** 岗位方向（如：技术研发 / 产品设计 / 市场运营 / 职能支持） */
  direction: string
  location: string
  type: 'fulltime' | 'intern' | 'parttime'
  /** 招募对象（不限 / 零基础 / 有相关经验 / 有作品） */
  experience: string
  /** 年级要求（不限 / 大一 / 大二 / 大三 / 大四 / 研究生） */
  education: string
  /** 社团场景下作为「时间投入」展示文本（如：每周 4-6 小时），不再表示薪资 */
  salary: string
  /** 咨询微信（可选，展示在岗位详情，方便同学加微信沟通） */
  contact_wechat: string
  /** 标签（逗号分隔，如 TypeScript,Node.js,大模型） */
  tags: string
  /** 简要描述（列表展示） */
  summary: string
  /** 岗位职责 */
  responsibilities: string
  /** 任职要求 */
  requirements: string
  /** 加分项 */
  bonus: string
  /** 兼容旧字段：完整描述（未填职责/要求时兜底展示） */
  description: string
  /** 需求人数；0 = 不限 */
  headcount: number
  /** 常驻招聘：报名信息（简历）完整时自动通过并加入部门 */
  auto_approve: number
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
  /** 投递用户（0 = 旧数据/匿名） */
  user_id: number
  /** 使用的简历（0 = 旧数据/未关联） */
  resume_id: number
  /** 姓名快照 */
  name: string
  /** 联系方式（手机/邮箱） */
  contact: string
  /** 邮箱快照 */
  email: string
  /** 手机号快照 */
  phone: string
  /** 报名同学填写的微信号（可选，便于后续微信沟通） */
  wechat: string
  /** 简历链接（旧字段，保留兼容） */
  resume_url: string
  /** 投递时的简历快照（JSON 字符串） */
  resume_snapshot: string
  /** 个人简介/自述 */
  note: string
  /** 本平台初审状态（兼容字段）：pending=待初审；passed=已通过；rejected=已驳回 */
  status: 'pending' | 'passed' | 'rejected'
  /**
   * 双选流程阶段：
   * submitted=已投递；interview=已约沟通；offered=部门已通过，待本人确认；
   * joined=已双向确认（成为项目开发者）；rejected=未匹配；withdrawn=本人撤回
   */
  stage: 'submitted' | 'interview' | 'offered' | 'joined' | 'rejected' | 'withdrawn'
  /** 15 分钟轻面试/双向沟通时间（ISO） */
  interview_at: string
  /** 沟通记录（动机、时间投入等） */
  interview_note: string
  /** 本人确认加入的时间 */
  confirmed_at: string
  /** 正式成为项目开发者的时间 */
  joined_at: string
  /** 初审意见（管理端填写） */
  review_note: string
  /** 初审人 */
  reviewer: string
  /** 旧 OA 审批单号（历史字段，SM2/OA 链路已下线，不再写入） */
  oa_oid: string
  /** 旧 OA 状态（历史字段，不再回填） */
  oa_status: string
  /** 最后一次查询到 OA 状态的操作时间 */
  oa_checked_at: string
  /** OA 完整流转轨迹（原样 JSON，前端展示用） */
  oa_timeline: string
  created_at: string
  updated_at: string
}

/** 登录用户（SSO 为主，邮箱验证码仅用于管理员） */
export type UserRow = {
  id: number
  /** 登录邮箱（可能为空：SSO 未返回 email 时） */
  email: string
  /** 展示名 */
  name: string
  /** 是否具备管理权限（兼容字段；与 system_role 同步） */
  is_admin: number
  /** 系统角色：超管可管理全部部门、用户与角色 */
  system_role: SystemRole
  /** 资源方代表：可参与答辩三级评审（学院/外院资源分配主张） */
  reviewer_role: ReviewerRole
  /** 头像 URL（SSO picture） */
  avatar: string
  /** UniSSO 稳定用户标识（sub / sso_sub），SSO 用户的主键 */
  sso_sub: string
  /** SSE Market OAuth 用户 id（可为空，仅关联了 SSE 账号时存在） */
  sse_sub: string
  /** 院内用户（UniSSO internal claim） */
  internal: number
  /** SSO roles（逗号分隔；仅作展示/扩展，不用作本应用权限） */
  roles: string
  /** 登录来源：email / sso */
  provider: string
  /** 最后登录时间 */
  last_login_at: string
  /** 开发者编号（注册即分配，如 SSE-D-0001） */
  developer_no: string
  /** 开发者身份层级 */
  developer_level: DeveloperLevel
  /** 当前主归属部门（0 = 尚未进组） */
  primary_department_id: number
  /** 加入当前部门的时间 */
  department_joined_at: string
  /** 进入圆桌（技术部）的时间 */
  roundtable_joined_at: string
  /** 账号状态：active=在职；exited=已退出开发者体系 */
  status: 'active' | 'exited'
  /** 开发者简介（公开在团队页/答辩页） */
  developer_bio: string
  /** 开发者技能标签（逗号分隔） */
  developer_skills: string
  /** 个人链接（GitHub / 作品集等，逗号分隔） */
  developer_links: string
  /** 是否已同步 UniSSO 的 is_developer=true */
  sso_developer: number
  /** 最近一次开通开发者权限的时间 */
  sso_developer_at: string
  created_at: string
}

/** 部门成员关系（保留进出历史，便于量化“出人贡献”） */
export type MembershipRow = {
  id: number
  user_id: number
  department_id: number
  /** member=项目开发者；head=部门负责人 */
  role: 'member' | 'head'
  /** active=在组；left=已离开 */
  status: 'active' | 'left'
  /** 来源报名 id（0 = 管理员直接加入） */
  source_application_id: number
  joined_at: string
  left_at: string
  note: string
  created_at: string
  updated_at: string
}

/** 答辩单：项目开发者 → 圆桌开发者（技术部） */
export type DefenseRow = {
  id: number
  applicant_user_id: number
  /** 发起时所属部门 */
  department_id: number
  department_name: string
  /** 答辩标题 */
  title: string
  /** 个人陈述（做过什么、为什么申请） */
  statement: string
  /** 答辩核心：进入技术部后，主张如何帮助学院更好分配资源 */
  proposal: string
  /** 产出与贡献（可量化） */
  achievements: string
  /**
   * submitted=待一级；level1/2/3=评审中；
   * waitlist=评审通过但本部门席位已满；passed=已进入圆桌；
   * rejected=未通过；withdrawn=本人撤回
   */
  status: 'submitted' | 'level1' | 'level2' | 'level3' | 'waitlist' | 'passed' | 'rejected' | 'withdrawn'
  /** 当前评审级别 1/2/3；0 表示已结束 */
  current_level: number
  /** 最终结论：passed / rejected / waitlist / '' */
  final_result: '' | 'passed' | 'rejected' | 'waitlist'
  final_note: string
  decided_by: string
  decided_at: string
  created_at: string
  updated_at: string
}

/** 答辩评审记录（一级陈述事实、二级交叉评审、三级资源方评审） */
export type DefenseReviewRow = {
  id: number
  defense_id: number
  /** 1=本部门负责人（陈述事实，回避打分）；2=其他部门负责人交叉评审；3=学院/外院资源方代表 */
  level: number
  /** 指派的评审人 user id（0 = 开放评审） */
  reviewer_user_id: number
  reviewer_name: string
  /** 评审人所属部门（0 = 非部门代表） */
  reviewer_department_id: number
  /** 评审人身份说明 */
  role_label: string
  /** pending=待评审；submitted=已提交 */
  status: 'pending' | 'submitted'
  /** fact=一级事实陈述；approve/reject=二三级结论；abstain=回避 */
  decision: '' | 'fact' | 'approve' | 'reject' | 'abstain'
  /** 评分 0-100；一级与回避为 -1（不计分） */
  score: number
  opinion: string
  /** 是否仅陈述事实（一级固定为 1） */
  is_fact_only: number
  created_at: string
  submitted_at: string
}

/** 公示中的部门席位行 */
export type PublicitySeat = {
  department_id: number
  department_name: string
  base: number
  floating: number
  total: number
  /** 本周期部门指标（0-100） */
  delivery: number
  usage: number
  talent: number
  activity: number
}

/** 公示中的晋升/席位变动行 */
export type PublicityPromotion = {
  user_id: number
  name: string
  developer_no: string
  department_name: string
  result: string
  note: string
}

/** 技术部会议 / 席位与晋升公示 */
export type PublicityRow = {
  id: number
  title: string
  meeting_date: string
  summary: string
  /** JSON: PublicitySeat[] */
  seats_json: string
  /** JSON: PublicityPromotion[] */
  promotions_json: string
  /** 自动生成的公示正文 */
  content: string
  published: number
  created_by: string
  created_at: string
  updated_at: string
}

/** 圆桌年度复审 / 退出记录 */
export type SeatReviewRow = {
  id: number
  user_id: number
  department_id: number
  /** 复审年度，如 2026 */
  year: number
  /** 产出评分 0-100 */
  output_score: number
  /** 是否达到产出要求 */
  passed: number
  /** exited=退出圆桌并释放席位；kept=保留 */
  result: 'kept' | 'exited'
  note: string
  reviewer: string
  decided_at: string
  created_at: string
  updated_at: string
}

/** 候选人简历 */
export type ResumeRow = {
  id: number
  user_id: number
  /** 简历标题（默认取姓名/文件名） */
  title: string
  name: string
  phone: string
  email: string
  city: string
  /** 求职意向 */
  intention: string
  /** 年级（校园社团场景，如 大一 / 研一） */
  grade: string
  /** 最高学历（旧字段，保留兼容） */
  education: string
  school: string
  major: string
  /** 毕业年份（文本，如 2026） */
  graduation_year: string
  /** 工作年限 */
  experience_years: number
  /** 技能（逗号分隔） */
  skills: string
  /** 自我评价/个人总结 */
  summary: string
  /** 工作/实习经历（自由文本） */
  work_experience: string
  /** 项目经历（自由文本） */
  project_experience: string
  /** 教育经历（自由文本） */
  education_experience: string
  /** PDF 附件相对路径（相对 DATA_DIR；空 = 纯在线简历） */
  file_path: string
  file_name: string
  file_size: number
  /** PDF 解析出的原始文本（用于管理端查看/重新编辑） */
  parsed_text: string
  /** 解析提示（如扫描件无法提取文本） */
  parse_note: string
  /** 是否默认简历 */
  is_default: number
  created_at: string
  updated_at: string
}

/** join 代用户向开发者平台提交的项目申请（本地留档，方便用户回看） */
export type DeveloperApplicationRow = {
  id: number
  user_id: number
  /** 提交时的 UniSSO sub（开发者平台侧的用户主键） */
  sso_sub: string
  project_id: number
  /** 项目标题快照（开发者平台只回 id/title） */
  project_title: string
  /** 开发者平台返回的申请 id */
  apply_id: number
  /** waiting / accepted / rejected（提交时刻的状态） */
  status: string
  /** 本次提交是否命中了对方已有的申请 */
  duplicate: number
  /** 是否是被拒后重新打开 */
  reopened: number
  note: string
  resume_id: number
  /** 提交给开发者平台的带签名简历地址 */
  resume_url: string
  created_at: string
  updated_at: string
}

/** 常见问题（Q&A） */
export type FaqRow = {
  id: number
  /** 分类（投递流程 / 简历 / 面试 / 实习与校招 / 其他） */
  category: string
  question: string
  answer: string
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

/** 集市历史 · 章节（按顺序组成一篇结构化长文档） */
export type HistoryChapterRow = {
  id: number
  /** 章节眉标（如：序章 / 2024 · 夏） */
  kicker: string
  title: string
  /** 摘要，展示在章节标题下方与目录中 */
  summary: string
  /** 年代/阶段标签（如：2021 — 2022） */
  era: string
  /** Markdown 正文 */
  content: string
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

/** 名人堂成员：独立于用户账号，由管理员维护展示信息 */
export type HallOfFameRow = {
  id: number
  /** 关联的系统注册用户 id（名人堂成员必须来自系统用户） */
  user_id: number
  name: string
  avatar: string
  /** 头衔（如：创始人 / 首任技术部负责人） */
  title: string
  /** 所属部门/产品线 */
  department: string
  /** 入选年份或届次 */
  year: string
  /** 一句话寄语（本人填写） */
  quote: string
  /** 自我介绍（本人填写） */
  bio: string
  /** 贡献 / 事迹（本人填写，管理员可调整） */
  achievements: string
  /** 1 = 资料由本人通过邀请填写；寄语/自我介绍对管理员锁定 */
  user_submitted: number
  /** 集市主页账号链接 */
  market_url: string
  contact_email: string
  contact_wechat: string
  /** 其他联系方式或主页（GitHub / 博客等） */
  contact_other: string
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

/** 名人堂资料填写邀请（邮件专属链接，一次性/短期有效） */
export type HallInviteRow = {
  id: number
  user_id: number
  token: string
  /** 邀请时预选的部门 */
  department: string
  /** 邀请时预填的头衔，本人可修改 */
  title: string
  status: 'pending' | 'submitted' | 'revoked'
  expires_at: string
  created_by: string
  created_at: string
  sent_at: string
  submitted_at: string
}

/** 集市历史页面的文案（单例） */
export type HistorySettingsRow = {
  title: string
  subtitle: string
  hall_title: string
  hall_intro: string
  updated_at: string
}

/** SSO 授权临时状态（state + PKCE verifier，一次性） */
export type SsoStateRow = {
  id: number
  state: string
  code_verifier: string
  /** 登录成功后回到前端哪个路径 */
  return_to: string
  expires_at: string
  used: number
  created_at: string
}

/** 站点文案配置（单例，无 seq id：始终使用 s.site_config，migrate 时补默认值） */
export type SiteConfigRow = {
  brand: string
  heroTitle: string
  heroSubtitle: string
  announcement: string
  tagline: string
  contactEmail: string
  bgWords: string
  /** 首页「关于我们」标题 */
  teamTitle: string
  /** 首页团队介绍（Markdown，由管理员维护） */
  teamIntro: string
  /** 首页团队亮点（每行一条） */
  teamHighlights: string
  /** 超级管理员的 UniSSO sub（逗号分隔；后台可增删） */
  adminSubs: string
  updated_at: string
}

/** UniSSO 用户目录的本地缓存（Pod 内持久化，避免每次搜索都打 SSO） */
export type SsoUserCacheRow = {
  sub: string
  name: string
  email: string
  avatar: string
  student_id: string
  preferred_username: string
  internal: number
  active: number
}

export type SsoUserCache = {
  updated_at: string
  users: SsoUserCacheRow[]
}

const SEQ_KEYS = [
  'jobs',
  'applications',
  'users',
  'departments',
  'resumes',
  'faqs',
  'sso_states',
  'memberships',
  'defenses',
  'defense_reviews',
  'seat_reviews',
  'publicities',
  'history_chapters',
  'hall_of_fame',
  'hall_invites',
  'dev_applications',
] as const

type SeqKey = (typeof SEQ_KEYS)[number]

/** 数据结构版本：用于只执行一次的旧数据补齐（避免每次启动覆盖管理员的手工修改） */
const SCHEMA_VERSION = 16

/** 旧职位只有一段 description 时，按标题拆成职责/要求 */
function splitLegacyDescription(desc: string): {
  responsibilities: string
  requirements: string
} {
  const text = String(desc || '')
    .replace(/\r\n?/g, '\n')
    .trim()
  if (!text) return { responsibilities: '', requirements: '' }
  const reqRe = /(?:任职要求|岗位要求|任职资格|职位要求)[：:]?/
  const idx = text.search(reqRe)
  if (idx > 0) {
    const resp = text
      .slice(0, idx)
      .replace(/^\s*(?:职位职责|岗位职责|工作职责|职责描述)[：:]?\s*/, '')
      .trim()
    const req = text
      .slice(idx)
      .replace(/^\s*(?:任职要求|岗位要求|任职资格|职位要求)[：:]?\s*/, '')
      .trim()
    return { responsibilities: resp.slice(0, 8000), requirements: req.slice(0, 8000) }
  }
  return {
    responsibilities: text
      .replace(/^\s*(?:职位职责|岗位职责|工作职责|职责描述)[：:]?\s*/, '')
      .trim()
      .slice(0, 8000),
    requirements: '',
  }
}

type Store = {
  schema_version?: number
  seq: Record<SeqKey, number>
  jobs: JobRow[]
  applications: ApplicationRow[]
  users: UserRow[]
  departments: DepartmentRow[]
  resumes: ResumeRow[]
  faqs: FaqRow[]
  sso_states: SsoStateRow[]
  memberships: MembershipRow[]
  defenses: DefenseRow[]
  defense_reviews: DefenseReviewRow[]
  seat_reviews: SeatReviewRow[]
  publicities: PublicityRow[]
  history_chapters: HistoryChapterRow[]
  hall_of_fame: HallOfFameRow[]
  hall_invites: HallInviteRow[]
  history_settings: HistorySettingsRow
  site_config: SiteConfigRow
  sso_user_cache: SsoUserCache
  dev_applications: DeveloperApplicationRow[]
}

function nowIso() {
  return new Date().toISOString()
}

function emptySeq(): Record<SeqKey, number> {
  return {
    jobs: 0,
    applications: 0,
    users: 0,
    departments: 0,
    resumes: 0,
    faqs: 0,
    sso_states: 0,
    memberships: 0,
    defenses: 0,
    defense_reviews: 0,
    seat_reviews: 0,
    publicities: 0,
    history_chapters: 0,
    hall_of_fame: 0,
    hall_invites: 0,
    dev_applications: 0,
  }
}

function defaultHistorySettings(): HistorySettingsRow {
  return {
    title: '软工集市年鉴',
    subtitle: '从第一行代码到今天的开发者平台，记录一群人如何把想法做出来。',
    hall_title: '名人堂',
    hall_intro:
      '记录曾为软工集市做出重要贡献的成员。点击卡片，查看他们的集市主页、招聘主页资料与联系方式。',
    updated_at: nowIso(),
  }
}

function defaultSiteConfig(): SiteConfigRow {
  return {
    brand: '软工集市',
    heroTitle: '加入软工集市',
    heroSubtitle: '我们是一群热爱技术与创造的同学。\n报名后我们会尽快联系你，合适的小伙伴一起聊聊，看看能一起做点什么。',
    announcement: '2026 开发者进组 · 正在进行中，期待与你一起做点东西。',
    tagline: '和一群热爱技术的人，一起把想法做出来',
    contactEmail: 'ssemarket@163.com',
    bgWords: '技术 · 创造 · 热爱 · 成长',
    teamTitle: '关于我们',
    // 首页团队介绍由管理员在后台撰写；留空时前台不渲染该区块
    teamIntro: '',
    teamHighlights: '',
    adminSubs: '',
    updated_at: nowIso(),
  }
}

function emptyStore(): Store {
  return {
    schema_version: SCHEMA_VERSION,
    seq: emptySeq(),
    jobs: [],
    applications: [],
    users: [],
    departments: [],
    resumes: [],
    faqs: [],
    sso_states: [],
    memberships: [],
    defenses: [],
    defense_reviews: [],
    seat_reviews: [],
    publicities: [],
    history_chapters: [],
    hall_of_fame: [],
    hall_invites: [],
    history_settings: defaultHistorySettings(),
    site_config: defaultSiteConfig(),
    sso_user_cache: { updated_at: '', users: [] },
    dev_applications: [],
  }
}

/** 把旧数据补齐到当前 schema；每次加载都执行，幂等。 */
function migrate(s: Store): void {
  if (!s.seq) s.seq = emptySeq()
  for (const key of SEQ_KEYS) {
    if (s.seq[key] == null || !Number.isFinite(Number(s.seq[key]))) s.seq[key] = 0
    else s.seq[key] = Number(s.seq[key])
  }
  if (!s.jobs) s.jobs = []
  if (!s.applications) s.applications = []
  if (!s.users) s.users = []
  if (!s.departments) s.departments = []
  if (!s.resumes) s.resumes = []
  if (!s.faqs) s.faqs = []
  if (!s.sso_states) s.sso_states = []
  if (!s.memberships) s.memberships = []
  if (!s.defenses) s.defenses = []
  if (!s.defense_reviews) s.defense_reviews = []
  if (!s.seat_reviews) s.seat_reviews = []
  if (!s.publicities) s.publicities = []
  if (!s.history_chapters) s.history_chapters = []
  if (!s.hall_of_fame) s.hall_of_fame = []
  if (!s.hall_invites) s.hall_invites = []
  if (!s.sso_user_cache) s.sso_user_cache = { updated_at: '', users: [] }
  if (!Array.isArray(s.sso_user_cache.users)) s.sso_user_cache.users = []
  if (!Array.isArray(s.dev_applications)) s.dev_applications = []
  if (s.sso_user_cache.updated_at == null) s.sso_user_cache.updated_at = ''
  const hsDef = defaultHistorySettings()
  if (!s.history_settings) s.history_settings = hsDef
  for (const k of ['title', 'subtitle', 'hall_title', 'hall_intro', 'updated_at'] as const) {
    if (s.history_settings[k] == null) s.history_settings[k] = hsDef[k]
  }
  for (const c of s.history_chapters) {
    if (c.kicker == null) c.kicker = ''
    if (c.title == null) c.title = ''
    if (c.summary == null) c.summary = ''
    if (c.era == null) c.era = ''
    if (c.content == null) c.content = ''
    if (c.sort_order == null || !Number.isFinite(Number(c.sort_order))) c.sort_order = 0
    else c.sort_order = Number(c.sort_order)
    if (c.enabled == null) c.enabled = 1
  }
  for (const h of s.hall_of_fame) {
    if (h.user_id == null || !Number.isFinite(Number(h.user_id))) h.user_id = 0
    else h.user_id = Number(h.user_id)
    for (const k of [
      'name',
      'avatar',
      'title',
      'department',
      'year',
      'quote',
      'bio',
      'achievements',
      'market_url',
      'contact_email',
      'contact_wechat',
      'contact_other',
    ] as const) {
      if (h[k] == null) h[k] = ''
    }
    if (h.sort_order == null || !Number.isFinite(Number(h.sort_order))) h.sort_order = 0
    else h.sort_order = Number(h.sort_order)
    if (h.enabled == null) h.enabled = 1
    h.user_submitted = Number(h.user_submitted) === 1 ? 1 : 0
  }
  for (const inv of s.hall_invites) {
    if (inv.user_id == null || !Number.isFinite(Number(inv.user_id))) inv.user_id = 0
    else inv.user_id = Number(inv.user_id)
    for (const k of [
      'token',
      'department',
      'title',
      'expires_at',
      'created_by',
      'created_at',
      'sent_at',
      'submitted_at',
    ] as const) {
      if (inv[k] == null) inv[k] = ''
    }
    if (!['pending', 'submitted', 'revoked'].includes(String(inv.status))) {
      inv.status = 'pending'
    }
  }
  // 旧版本没有 schema_version：按版本号执行一次性补齐
  const version = Number(s.schema_version) || 0

  for (const j of s.jobs) {
    if (j.slug == null) j.slug = ''
    if (j.department == null) j.department = ''
    if (j.department_id == null || !Number.isFinite(Number(j.department_id))) j.department_id = 0
    else j.department_id = Number(j.department_id)
    if (j.direction == null) j.direction = ''
    if (j.location == null) j.location = ''
    if (j.experience == null) j.experience = ''
    if (j.education == null) j.education = ''
    if (j.salary == null) j.salary = ''
    if (j.contact_wechat == null) j.contact_wechat = ''
    if (j.tags == null) j.tags = ''
    if (j.summary == null) j.summary = ''
    if (j.responsibilities == null) j.responsibilities = ''
    if (j.requirements == null) j.requirements = ''
    if (j.bonus == null) j.bonus = ''
    if (j.description == null) j.description = ''
    if (j.headcount == null || !Number.isFinite(Number(j.headcount))) j.headcount = 0
    if (j.auto_approve == null) j.auto_approve = 0
    else j.auto_approve = Number(j.auto_approve) === 1 ? 1 : 0
    if (j.enabled == null) j.enabled = 1
    if (j.sort_order == null) j.sort_order = 0
    if (!['fulltime', 'intern', 'parttime'].includes(String(j.type))) j.type = 'fulltime'
  }

  for (const d of s.departments) {
    if (d.slug == null) d.slug = ''
    if (d.summary == null) d.summary = ''
    if (d.description == null) d.description = ''
    if (d.color == null) d.color = ''
    if (d.admin_emails == null) d.admin_emails = ''
    if (d.admin_user_ids == null) d.admin_user_ids = ''
    if (d.head_user_id == null || !Number.isFinite(Number(d.head_user_id))) d.head_user_id = 0
    else d.head_user_id = Number(d.head_user_id)
    if (d.base_seats == null || !Number.isFinite(Number(d.base_seats))) d.base_seats = 1
    else d.base_seats = Number(d.base_seats)
    if (d.floating_seats == null || !Number.isFinite(Number(d.floating_seats))) d.floating_seats = 0
    else d.floating_seats = Number(d.floating_seats)
    for (const k of ['output_delivery', 'output_usage', 'output_talent', 'output_activity'] as const) {
      if (d[k] == null || !Number.isFinite(Number(d[k]))) d[k] = 0
      else d[k] = Number(d[k])
    }
    if (d.output_note == null) d.output_note = ''
    if (d.enabled == null) d.enabled = 1
    if (d.sort_order == null) d.sort_order = 0
  }

  for (const a of s.applications) {
    if (a.user_id == null || !Number.isFinite(Number(a.user_id))) a.user_id = 0
    else a.user_id = Number(a.user_id)
    if (a.resume_id == null || !Number.isFinite(Number(a.resume_id))) a.resume_id = 0
    else a.resume_id = Number(a.resume_id)
    if (a.name == null) a.name = ''
    if (a.contact == null) a.contact = ''
    if (a.email == null) a.email = ''
    if (a.phone == null) a.phone = ''
    if (a.wechat == null) a.wechat = ''
    if (a.resume_url == null) a.resume_url = ''
    if (a.resume_snapshot == null) a.resume_snapshot = ''
    if (a.note == null) a.note = ''
    if (a.review_note == null) a.review_note = ''
    if (!a.status) a.status = 'pending'
    if (a.oa_oid == null) a.oa_oid = ''
    if (a.oa_status == null) a.oa_status = ''
    if (a.oa_checked_at == null) a.oa_checked_at = ''
    if (a.oa_timeline == null) a.oa_timeline = ''
    if (a.reviewer == null) a.reviewer = ''
    if (a.stage == null) {
      a.stage = a.status === 'passed' ? 'offered' : a.status === 'rejected' ? 'rejected' : 'submitted'
    }
    if (a.interview_at == null) a.interview_at = ''
    if (a.interview_note == null) a.interview_note = ''
    if (a.confirmed_at == null) a.confirmed_at = ''
    if (a.joined_at == null) a.joined_at = ''
  }

  for (const u of s.users) {
    if (u.email == null) u.email = ''
    if (u.name == null) u.name = u.email.split('@')[0] || ''
    if (u.is_admin == null) u.is_admin = 0
    if (u.avatar == null) u.avatar = ''
    if (u.sso_sub == null) u.sso_sub = ''
    if (u.sse_sub == null) u.sse_sub = ''
    if (u.internal == null) u.internal = 0
    if (u.roles == null) u.roles = ''
    if (u.provider == null) u.provider = 'email'
    if (u.last_login_at == null) u.last_login_at = ''
    if (u.system_role !== 'super_admin') u.system_role = 'user'
    if (u.reviewer_role !== 'resource') u.reviewer_role = ''
    if (u.developer_level !== 'project' && u.developer_level !== 'roundtable') {
      u.developer_level = 'market'
    }
    if (!u.developer_no) u.developer_no = `SSE-D-${String(u.id).padStart(4, '0')}`
    if (u.primary_department_id == null || !Number.isFinite(Number(u.primary_department_id))) {
      u.primary_department_id = 0
    } else u.primary_department_id = Number(u.primary_department_id)
    if (u.department_joined_at == null) u.department_joined_at = ''
    if (u.roundtable_joined_at == null) u.roundtable_joined_at = ''
    if (u.status !== 'exited') u.status = 'active'
    if (u.developer_bio == null) u.developer_bio = ''
    if (u.developer_skills == null) u.developer_skills = ''
    if (u.developer_links == null) u.developer_links = ''
    if (u.sso_developer == null) u.sso_developer = 0
    else u.sso_developer = Number(u.sso_developer) === 1 ? 1 : 0
    if (u.sso_developer_at == null) u.sso_developer_at = ''
  }

  for (const r of s.resumes) {
    if (r.title == null) r.title = ''
    if (r.name == null) r.name = ''
    if (r.phone == null) r.phone = ''
    if (r.email == null) r.email = ''
    if (r.city == null) r.city = ''
    if (r.intention == null) r.intention = ''
    if (r.grade == null) r.grade = ''
    if (r.education == null) r.education = ''
    if (r.school == null) r.school = ''
    if (r.major == null) r.major = ''
    if (r.graduation_year == null) r.graduation_year = ''
    if (r.experience_years == null || !Number.isFinite(Number(r.experience_years))) {
      r.experience_years = 0
    } else r.experience_years = Number(r.experience_years)
    if (r.skills == null) r.skills = ''
    if (r.summary == null) r.summary = ''
    if (r.work_experience == null) r.work_experience = ''
    if (r.project_experience == null) r.project_experience = ''
    if (r.education_experience == null) r.education_experience = ''
    if (r.file_path == null) r.file_path = ''
    if (r.file_name == null) r.file_name = ''
    if (r.file_size == null || !Number.isFinite(Number(r.file_size))) r.file_size = 0
    else r.file_size = Number(r.file_size)
    if (r.parsed_text == null) r.parsed_text = ''
    if (r.parse_note == null) r.parse_note = ''
    if (r.is_default == null) r.is_default = 0
  }

  for (const f of s.faqs) {
    if (f.category == null) f.category = '其他'
    if (f.question == null) f.question = ''
    if (f.answer == null) f.answer = ''
    if (f.sort_order == null) f.sort_order = 0
    if (f.enabled == null) f.enabled = 1
  }

  for (const st of s.sso_states) {
    if (st.code_verifier == null) st.code_verifier = ''
    if (st.return_to == null) st.return_to = ''
    if (st.expires_at == null) st.expires_at = ''
    if (st.used == null) st.used = 0
  }

  // v2：方向/经验/学历/薪资的展示默认值
  if (version < 2) {
    for (const j of s.jobs) {
      if (!j.direction) {
        j.direction = /开发|工程师|技术|算法|前端|后端|全栈|运维|测试|数据/.test(j.title)
          ? '技术研发'
          : '其他'
      }
      if (!j.experience) j.experience = '不限'
      if (!j.education) j.education = '不限'
      if (!j.salary) j.salary = '面议'
    }
  }

  // v3：旧职位只有 description 时，拆出岗位职责 / 任职要求
  if (version < 3) {
    for (const j of s.jobs) {
      if (!j.responsibilities && !j.requirements && j.description) {
        const split = splitLegacyDescription(j.description)
        j.responsibilities = split.responsibilities
        j.requirements = split.requirements
      }
    }
  }
  s.schema_version = SCHEMA_VERSION

  // site_config 单例兜底：合并默认值，缺失字段补默认
  const def = defaultSiteConfig()
  if (!s.site_config) s.site_config = def
  const sc = s.site_config
  for (const k of [
    'brand',
    'heroTitle',
    'heroSubtitle',
    'announcement',
    'tagline',
    'contactEmail',
    'bgWords',
    'teamTitle',
    'teamIntro',
    'teamHighlights',
    'adminSubs',
  ] as const) {
    if (sc[k] == null) sc[k] = def[k]
  }
  if (sc.updated_at == null) sc.updated_at = nowIso()

  // v4：从「公司秋招」语境切换到「校内开发者进组」
  if (version < 4) {
    const oldDefaults = {
      heroSubtitle:
        '我们正在寻找热爱技术与创造的同学。\n投递后我们将尽快联系，合适的候选人会进入团队面试。',
      announcement: '2026 秋季招聘 · 火热进行中，期待与你同行。',
      tagline: '让每个热爱技术的人，都能找到属于他的舞台',
      contactEmail: 'hr@ssemarket.cn',
    }
    if (sc.heroSubtitle === oldDefaults.heroSubtitle) {
      sc.heroSubtitle =
        '我们是一群热爱技术与创造的同学。\n报名后我们会尽快联系你，合适的小伙伴一起聊聊，看看能一起做点什么。'
    }
    if (sc.announcement === oldDefaults.announcement) {
      sc.announcement = '2026 开发者进组 · 正在进行中，期待与你一起做点东西。'
    }
    if (sc.tagline === oldDefaults.tagline) {
      sc.tagline = '和一群热爱技术的人，一起把想法做出来'
    }
    if (sc.contactEmail === oldDefaults.contactEmail) {
      sc.contactEmail = 'ssemarket@163.com'
    }
    sc.updated_at = nowIso()

    for (const j of s.jobs) {
      if (j.salary === '面议') j.salary = ''
      if (['本科及以上', '大专及以上', '硕士及以上', '博士', '高中'].includes(j.education)) {
        j.education = '不限'
      }
      if (
        ['应届生', '1 年以内', '1-3 年', '3-5 年', '5 年以上'].includes(j.experience)
      ) {
        j.experience = '不限'
      }
    }

    // 清空旧问答，ensureSeeds 会按社团语境重新播种
    s.faqs = []
    s.seq.faqs = 0
  }

  // v5：清掉旧数据里「职位职责/任职要求」等公司语境的兼容描述
  if (version < 5) {
    for (const j of s.jobs) {
      if (
        j.description &&
        /职位职责|任职要求|应聘职位|录用申请/.test(j.description) &&
        (j.responsibilities || j.requirements)
      ) {
        j.description = ''
      }
    }
  }
  // v6：开发者身份体系（全员开发者 → 项目开发者 → 圆桌开发者）
  if (version < 6) {
    // 旧数据里通过初审的报名 → 「已通过，待本人确认」；未确认前不自动进组
    for (const a of s.applications) {
      if (a.status === 'passed' && a.stage === 'offered') continue
      if (a.status === 'passed') a.stage = 'offered'
      else if (a.status === 'rejected') a.stage = 'rejected'
      else a.stage = 'submitted'
    }
    // 已配置部门管理员邮箱且能匹配到用户的，自动建立管理员用户 id 关系
    for (const d of s.departments) {
      if (d.admin_user_ids) continue
      const emails = (d.admin_emails || '')
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
      const ids = s.users
        .filter((u) => u.email && emails.includes(u.email.toLowerCase()))
        .map((u) => u.id)
      if (ids.length) {
        d.admin_user_ids = ids.join(',')
        if (!d.head_user_id) d.head_user_id = ids[0]
      }
    }
  }
  // v9：历史页更名「年鉴」；只在标题仍是旧默认值时替换，保留管理员自定义
  if (version < 9) {
    if (s.history_settings.title === '软工集市历史') {
      s.history_settings.title = '软工集市年鉴'
      s.history_settings.updated_at = nowIso()
    }
  }
  // v14：名人堂区分本人填写（寄语/自我介绍）与管理员维护字段；
  // 已有 submitted 邀请的成员视为本人填写。
  if (version < 14) {
    const submittedUserIds = new Set(
      s.hall_invites.filter((i) => i.status === 'submitted').map((i) => i.user_id),
    )
    for (const h of s.hall_of_fame) {
      if (h.user_submitted !== 1 && submittedUserIds.has(h.user_id)) h.user_submitted = 1
    }
  }
  // v15：公开首页收敛为招聘页；隐藏旧问答里「技术部 / 圆桌 / 席位」流程说明
  if (version < 15) {
    const retired = new Set([
      '技术部（圆桌）答辩怎么进行？',
      '技术部席位如何分配？会退出吗？',
    ])
    for (const f of s.faqs) {
      if (retired.has(f.question)) f.enabled = 0
      f.answer = (f.answer || '').replace(/社团成员/g, '团队成员')
    }
    // 团队介绍默认留空：由管理员撰写后才在首页展示
    if (s.site_config.teamIntro === '软工集市是一群热爱技术、愿意把想法真正做出来的同学。我们承接真实项目，也欢迎新的伙伴一起加入。') {
      s.site_config.teamIntro = ''
    }
    if (s.site_config.teamHighlights === '做真实项目\n扁平协作\n一起成长') {
      s.site_config.teamHighlights = ''
    }
  }
  // v16：参与类型收敛为「团队成员 / 项目成员」；问答文案同步
  if (version < 16) {
    for (const j of s.jobs) {
      if (j.type === 'parttime') j.type = 'fulltime'
    }
    for (const f of s.faqs) {
      f.answer = (f.answer || '').replace(/社团成员/g, '团队成员')
    }
  }
  // v13：名人堂「简介 + 主要贡献」合并为单一介绍字段
  if (version < 13) {
    for (const h of s.hall_of_fame) {
      const extra = (h.achievements || '').trim()
      if (extra) {
        h.bio = [(h.bio || '').trim(), extra].filter(Boolean).join('\n\n')
        h.achievements = ''
      }
    }
  }
  // v12：名人堂章节说明改为更自然的表述；只替换旧默认值
  if (version < 12) {
    const oldHallIntro =
      '那些定义过软工集市的人。点击卡片，查看他们的集市主页、在招聘主页上的展示与联系方式。'
    if (s.history_settings.hall_intro === oldHallIntro) {
      s.history_settings.hall_intro =
        '记录曾为软工集市做出重要贡献的成员。点击卡片，查看他们的集市主页、招聘主页资料与联系方式。'
      s.history_settings.updated_at = nowIso()
    }
  }
  // v11：「年轮」定名为「年鉴」；只替换旧默认标题，保留管理员自定义
  if (version < 11) {
    if (s.history_settings.title === '软工集市年轮') {
      s.history_settings.title = '软工集市年鉴'
      s.history_settings.updated_at = nowIso()
    }
  }
  // v10：名人堂成员必须关联系统注册用户；旧数据按姓名/邮箱尽量回填
  if (version < 10) {
    for (const h of s.hall_of_fame) {
      if (h.user_id) continue
      const matched = s.users.find(
        (u) =>
          (h.name && u.name === h.name) ||
          (h.contact_email && u.email.toLowerCase() === h.contact_email.toLowerCase()),
      )
      if (matched) {
        h.user_id = matched.id
        if (!h.name) h.name = matched.name
        if (!h.avatar) h.avatar = matched.avatar
      }
    }
  }
  // v7：公示记录补齐字段
  for (const p of s.publicities) {
    if (p.title == null) p.title = ''
    if (p.meeting_date == null) p.meeting_date = ''
    if (p.summary == null) p.summary = ''
    if (p.seats_json == null) p.seats_json = '[]'
    if (p.promotions_json == null) p.promotions_json = '[]'
    if (p.content == null) p.content = ''
    if (p.published == null) p.published = 1
    if (p.created_by == null) p.created_by = ''
  }
  s.schema_version = SCHEMA_VERSION
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

function nextId(table: SeqKey) {
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
  async insert<K extends SeqKey>(
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

/**
 * 初始化业务种子：部门、示例职位、常见问题。
 * 幂等：已有数据时不覆盖，只补齐关联关系。
 */
export async function ensureSeeds(): Promise<void> {
  assertDbReady()
  const s = store
  let changed = false

  // 1) 旧职位里的 department 文本 → 部门记录
  const names = Array.from(
    new Set(s.jobs.map((j) => (j.department || '').trim()).filter(Boolean)),
  )
  for (const name of names) {
    if (!s.departments.some((d) => d.name === name)) {
      const t = nowIso()
      const id = nextId('departments')
      s.departments.push({
        id,
        name,
        slug: `dept-${id}`,
        summary: '',
        description: '',
        color: '',
        admin_emails: '',
        admin_user_ids: '',
        head_user_id: 0,
        base_seats: 1,
        floating_seats: 0,
        output_delivery: 0,
        output_usage: 0,
        output_talent: 0,
        output_activity: 0,
        output_note: '',
        enabled: 1,
        sort_order: s.departments.length + 1,
        created_at: t,
        updated_at: t,
      })
      changed = true
    }
  }

  // 2) 职位 → 部门 id 关联
  for (const j of s.jobs) {
    if (j.department_id) continue
    const dept = s.departments.find((d) => d.name === (j.department || '').trim())
    if (dept) {
      j.department_id = dept.id
      changed = true
    }
  }

  // 3) 首次初始化（此前从未有过职位）时播种集市部门与示例岗位
  if (s.jobs.length === 0 && s.seq.jobs === 0) {
    const t = nowIso()
    if (s.departments.length === 0) {
      const seeds = [
        {
          name: 'mirror',
          summary: '集市需求与校园技术服务平台，承接真实需求与资源。',
          description:
            'mirror 负责集市需求服务与校园技术服务平台，连接需求方与开发者，承接综测、志愿时与资源激励。',
          color: '#3370ff',
        },
        {
          name: 'iwiki',
          summary: '知识库与文档平台，把知识变成可复用的产品。',
          description:
            'iwiki 负责集市知识库、文档协作与检索能力，沉淀团队知识并对外提供文档服务。',
          color: '#16a34a',
        },
        {
          name: 'sparklabs',
          summary: '前沿技术与 AI 工具的实验场。',
          description:
            'sparklabs 关注 AI 工具、算法应用与创新实验，把探索变成可交付的产品。',
          color: '#9333ea',
        },
        {
          name: '图灵',
          summary: '工程能力与底层基础设施建设。',
          description:
            '图灵负责底层基础设施、工程规范与稳定性建设，为集市各产品线提供支撑。',
          color: '#f59e0b',
        },
      ]
      for (const seed of seeds) {
        s.departments.push({
          id: nextId('departments'),
          name: seed.name,
          slug: seed.name.toLowerCase(),
          summary: seed.summary,
          description: seed.description,
          color: seed.color,
          admin_emails: '',
          admin_user_ids: '',
          head_user_id: 0,
          base_seats: 1,
          floating_seats: 0,
          output_delivery: 0,
          output_usage: 0,
          output_talent: 0,
          output_activity: 0,
          output_note: '',
          enabled: 1,
          sort_order: s.departments.length + 1,
          created_at: t,
          updated_at: t,
        })
      }
    }
    const dept = s.departments[0]
    const description = ''
    s.jobs.push({
      id: nextId('jobs'),
      slug: 'agent-developer',
      title: 'Agent 开发工程师',
      department_id: dept.id,
      department: dept.name,
      direction: '技术研发',
      location: '广州',
      type: 'fulltime',
      experience: '不限',
      education: '不限',
      salary: '',
      contact_wechat: '',
      tags: 'TypeScript,Node.js,大模型',
      summary: '参与集市智能 Agent 的研发与落地。',
      responsibilities: '设计与开发集市内的 AI Agent 应用；与产品、算法同学协作推进智能落地。',
      requirements: '熟悉 TypeScript / Node.js；了解大模型应用开发（RAG、Function Calling 等）；有良好的工程化习惯。',
      bonus: '',
      description,
      headcount: 2,
      auto_approve: 0,
      enabled: 1,
      sort_order: 1,
      created_at: t,
      updated_at: t,
    })
    changed = true
  }

  // 4) 常见问题种子（仅在从未创建过问答时播种，避免管理员清空后被重新灌入）
  if (s.faqs.length === 0 && s.seq.faqs === 0) {
    const t = nowIso()
    const seeds: Omit<FaqRow, 'id' | 'created_at' | 'updated_at'>[] = [
      {
        category: '报名流程',
        question: '如何报名？',
        answer:
          '登录后进入「部门岗位」选择感兴趣的岗位，点击「报名」，选择或新建一份简历即可完成报名。进度可在「我的报名」中查看。',
        sort_order: 1,
        enabled: 1,
      },
      {
        category: '报名流程',
        question: '可以同时报名多个岗位吗？',
        answer:
          '可以。我们鼓励你选择最感兴趣的方向，但同一岗位请勿重复报名。若之前报名未通过，可以完善简历后再次报名。',
        sort_order: 2,
        enabled: 1,
      },
      {
        category: '报名流程',
        question: '报名后多久会收到回复？',
        answer:
          '一般会在 5 个工作日内完成初步评估。通过评估的同学会收到面试/交流邀约，结果也会在「我的报名」中更新。',
        sort_order: 3,
        enabled: 1,
      },
      {
        category: '简历/作品',
        question: '支持上传哪些格式的简历？',
        answer:
          '目前支持 PDF 格式，单个文件不超过 10MB。上传后系统会自动解析文本并帮你填写在线简历，解析结果可以手动修改。',
        sort_order: 1,
        enabled: 1,
      },
      {
        category: '简历/作品',
        question: '没有现成简历可以报名吗？',
        answer:
          '可以。登录后在「我的简历」中新建在线简历，填写基本信息、项目/作品经历与技能即可报名，无需上传附件。',
        sort_order: 2,
        enabled: 1,
      },
      {
        category: '简历/作品',
        question: '我的简历信息会保密吗？',
        answer:
          '简历仅用于本次部门双选评估，仅部门团队与相关方向负责人可见，不会用于其他用途或对外公开。',
        sort_order: 3,
        enabled: 1,
      },
      {
        category: '面试/交流',
        question: '面试/交流流程是怎样的？',
        answer:
          '通常包括简历/作品评估、方向交流和综合沟通。部分方向可能会请你展示作品或现场做一个小练习，具体安排会提前沟通。',
        sort_order: 1,
        enabled: 1,
      },
      {
        category: '面试/交流',
        question: '面试/交流是线上还是线下？',
        answer:
          '以线上交流为主，也会安排线下见面。我们会在邀约时说明形式、时间与需要准备的内容。',
        sort_order: 2,
        enabled: 1,
      },
      {
        category: '社团生活',
        question: '是否接受零基础/低年级同学？',
        answer:
          '欢迎。岗位会标注招募对象，部分岗位零基础也可以报名；我们会提供必要的入门指引和一起做项目的机会。',
        sort_order: 1,
        enabled: 1,
      },
      {
        category: '社团生活',
        question: '加入后可以长期参与吗？',
        answer:
          '可以。团队成员可以持续参与项目与活动；投入较多、表现积极的同学可以承担核心成员或项目负责人角色。',
        sort_order: 2,
        enabled: 1,
      },
      {
        category: '其他',
        question: '如何联系社团？',
        answer: '可通过页面底部或「联系我们」中的社团邮箱与我们联系，我们会尽快回复。',
        sort_order: 1,
        enabled: 1,
      },
      {
        category: '开发者体系',
        question: '注册后是什么身份？',
        answer:
          '使用集市统一身份登录后，自动成为「软工集市开发者」，无需任何审批。你可以浏览公开岗位、使用集市资源，并参与开发者工坊。',
        sort_order: 1,
        enabled: 1,
      },
      {
        category: '开发者体系',
        question: '如何成为项目开发者？',
        answer:
          '在「部门岗位」投递意向部门，部门负责人会安排约 15 分钟的轻沟通，重点看动机与时间投入。双方确认后，身份转为「项目开发者」并归属该部门；未匹配成功仍保留集市开发者身份。',
        sort_order: 2,
        enabled: 1,
      },
      ]
    for (const f of seeds) {
      s.faqs.push({
        id: nextId('faqs'),
        ...f,
        created_at: t,
        updated_at: t,
      })
    }
    changed = true
  }

  // 5) 集市历史章节种子（仅在从未创建过章节时播种，管理员清空后不再回灌）
  if (s.history_chapters.length === 0 && s.seq.history_chapters === 0) {
    const t = nowIso()
    const chapters: Array<Omit<HistoryChapterRow, 'id' | 'created_at' | 'updated_at'>> = [
      {
        kicker: '序章',
        title: '从一张招新文档开始',
        era: '起点',
        summary: '软工集市最初不是平台，只是一群愿意把想法做出来的同学。',
        content: [
          '软工集市诞生于一个很朴素的想法：**让热爱技术的人聚在一起，把想法真正做出来。**',
          '',
          '最早的时候，这里只有一份招新文档、几个还没做完的项目，和一群愿意在课后留下来调试代码的人。我们没有成熟的流程，也没有复杂的层级，只有一条默认的共识——',
          '',
          '> 做出来的东西，要真的有人用。',
          '',
          '这份共识，后来变成了集市所有部门的起点。',
        ].join('\n'),
        sort_order: 1,
        enabled: 1,
      },
      {
        kicker: '第一章',
        title: '让每个人找到自己的位置',
        era: '部门与双选',
        summary: '部门不是壁垒，而是让人和项目彼此找到的坐标系。',
        content: [
          '随着项目变多，一个问题开始出现：**新同学应该从哪里开始？**',
          '',
          '我们逐渐把集市拆成一个个有明确方向的项目部门，用岗位把「想做什么」和「正在做什么」连接起来。报名、沟通、双向确认——每一步都不长，但足够让双方认真做一次选择。',
          '',
          '- 同学在「部门岗位」投递感兴趣的部门；',
          '- 部门安排一次轻量沟通，了解动机与时间投入；',
          '- 双方确认后，身份从「集市开发者」转为「项目开发者」。',
          '',
          '未匹配成功也没有关系。你仍然保留集市开发者身份，可以继续使用公开资源、参加开发者工坊，等下一次更合适的机会。',
        ].join('\n'),
        sort_order: 2,
        enabled: 1,
      },
      {
        kicker: '第二章',
        title: '把规则写下来',
        era: '技术部与圆桌',
        summary: '席位、答辩与公示，让资源分配有据可循。',
        content: [
          '当集市开始承接真实需求，**资源怎么分**就成了绕不开的问题。',
          '',
          '我们建立了技术部（圆桌）与多级答辩机制：项目开发者可以发起答辩，一级由本部门负责人陈述事实，二级由其他部门交叉评审，三级由学院/外院资源方代表评估「你进入技术部后，主张如何帮助学院更好分配资源」。',
          '',
          '> 答辩不是考试，而是一次公开的资源分配讨论。',
          '',
          '每个部门至少保留一个保底席位，浮动席位按交付、使用、出人与社区活跃度评估。席位变动与晋升结果会在「公示」中留档，所有人都可以对照审计。',
        ].join('\n'),
        sort_order: 3,
        enabled: 1,
      },
      {
        kicker: '现在',
        title: '继续向前',
        era: '未完待续',
        summary: '从招聘页面，到一套完整的开发者平台。',
        content: [
          '今天的软工集市，已经不只是招新。',
          '',
          '统一的开发者身份、在线简历与 PDF 解析、部门双选、多级答辩、席位公示、常见问题……这些工具把过去散落在群聊和文档里的流程，慢慢变成了一套可以复用、可以审计的系统。',
          '',
          '但工具从来不是终点。真正让集市成立的，仍然是那些愿意在深夜把最后一个 bug 修完、愿意把机会让给更合适的人、愿意把经验写下来留给后来者的人。',
          '',
          '**这页历史还在继续。**',
        ].join('\n'),
        sort_order: 4,
        enabled: 1,
      },
    ]
    for (const c of chapters) {
      s.history_chapters.push({
        id: nextId('history_chapters'),
        ...c,
        created_at: t,
        updated_at: t,
      })
    }
    changed = true
  }

  if (changed) await persist()
}

export type { Store }
