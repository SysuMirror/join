# 软工集市 · 开发者平台（join-platform）

面向「软工集市」的开发者进组、身份与答辩管理平台。按《软工集市 · 管理体系方案公开》实现：

**注册即成为集市开发者 → 部门双选成为项目开发者 → 多级答辩进入技术部（圆桌）→ 年度复审与退出。**

| 入口 | 地址 | 说明 |
|------|------|------|
| 首页 | https://join.ssemarket.cn | 品牌、管理员维护的团队介绍与常见问题 |
| 部门岗位 | https://join.ssemarket.cn/jobs | 关键词 / 部门 / 方向 / 类型 / 地点筛选 |
| 岗位详情 | https://join.ssemarket.cn/jobs/:slug | 职责、要求、部门介绍、登录后报名 |
| 项目广场 | https://join.ssemarket.cn/projects | 浏览开发者平台的项目，选简历申请加入（leader 在开发者平台审批） |
| 席位与晋升公示 | https://join.ssemarket.cn/teams | 会议公示列表 + 技术部席位名额表 |
| 部门介绍 | https://join.ssemarket.cn/departments/:slug | 负责人填写的部门介绍与部门岗位 |
| 公示详情 | https://join.ssemarket.cn/publicity/:id | 自动生成的会议公示文档（可打印 / 复制） |
| 常见问题 | https://join.ssemarket.cn/faq | 分类、搜索、折叠问答 |
| 年鉴与名人堂 | https://join.ssemarket.cn/history | 章节式长文档 + 名人堂卡片，点击查看主页与联系方式 |
| 名人堂资料填写 | https://join.ssemarket.cn/hall-invite/:token | 邮件邀请链接，本人填写/更新名人堂资料 |
| 登录 | https://join.ssemarket.cn/login | UniSSO 无感登录（邮箱密码）；授权跳转保留作演示 |
| 个人主页 | https://join.ssemarket.cn/me | 开发者编号 / 层级 / 部门 / 席位 / 答辩 / 待评审任务 |
| 发起答辩 | https://join.ssemarket.cn/me/defense/new | 项目开发者发起技术部答辩 |
| 答辩详情 | https://join.ssemarket.cn/defenses/:id | 多级评审进度、提交评审、撤回 |
| 管理后台 | https://join.ssemarket.cn/admin | 成员权限、部门、岗位、报名、答辩、圆桌、问答、站点 |

## 一、身份与答辩体系

### 1. 三级开发者身份

| 身份 | 获得方式 | 默认权益 |
|------|----------|----------|
| **集市开发者** | 使用集市统一身份登录即自动获得，无需审批 | 集市公开资源、开发者工坊（共学/分享） |
| **项目开发者** | 在部门岗位投递意向部门 → 部门 15 分钟轻沟通 → 双方确认 | 归属部门/产品线，参与实际项目 |
| **圆桌开发者（技术部）** | 项目开发者发起答辩 → 一级/二级/三级评审 → 席位裁决 | 参与技术部与学院资源分配决策 |

未匹配成功的同学仍保留「集市开发者」身份。所有登录用户都会分配唯一开发者编号（`SSE-D-0001` 起）。

### 2. 部门双选

1. 同学在 `/jobs` 投递岗位（必须登录）。
2. 部门管理员在后台「报名」中约沟通（记录时间与动机/时间投入），或直接双选通过。
3. 部门通过后状态为「部门已通过 · 待本人确认」，**不会自动进组**。
4. 同学在「个人主页 / 我的报名」点击「确认加入」后，才转为项目开发者并建立部门成员关系。
5. 未匹配可驳回；被驳回后可重新投递（同一岗位未通过/撤回后可再次报名）。

### 3. 技术部答辩（多级评审）

答辩核心：**「你进入技术部后，主张如何帮助学院更好分配资源」**。

| 级别 | 评审人 | 规则 |
|------|--------|------|
| 一级 | 本部门负责人 | **陈述事实、回避打分**；记录投入、产出与协作情况 |
| 二级 | 其他 2-3 个部门负责人 | 交叉评审，防小圈子；本部门负责人/管理员必须回避 |
| 三级 | 学院/外院资源方代表 | 评估资源分配主张；未配置代表时由超级管理员代行 |

系统自动指派评审人：

- 一级：部门负责人 → 部门管理员 → 超级管理员（都缺席时开放认领）。
- 二级：其他部门负责人优先，补足其他部门管理员/超级管理员；自动排除本部门负责人、本部门管理员和一级陈述人。
- 三级：`reviewer_role = resource` 的资源方代表；自动排除本部门负责人/管理员；没有代表时由超级管理员评审。

判定规则（可在前端查看每一级结果）：

- **二级**：至少 2 人提交（不足 2 人按实际人数）；无人反对、至少 2 票赞成（单人评审时 1 票）、平均分 ≥ 60。
- **三级**：至少 2 人提交（不足 2 人按实际人数）；无人反对、至少 1 票赞成、平均分 ≥ 60。
- 任一级不通过即结束；通过后进入席位裁决。
- 超级管理员可在答辩详情/后台「答辩」中人工裁决，但「通过」仍需本部门有空余席位。

### 4. 席位、候补与退出

- 每个部门技术部席位 = **保底席位（≥1）+ 浮动席位**。
- 答辩通过时：
  - 部门有空位 → 立即成为圆桌开发者；
  - 无空位 → 状态为「候补席位」，保留答辩结果。
- 席位释放时（退出/年度复审未通过），候补队列**按发起时间自动递补**。
- 圆桌成员卸任负责人或年度复审未达产出要求 → 自动退出圆桌、回到项目开发者、释放席位。
  - 在「部门」中更换负责人，或在「成员与权限」中取消其全部负责人部门时，系统会自动检查：若该成员不再负责任何部门，则自动退出圆桌并递补候补者。
- 每次技术部会议的席位分配与晋升结果在 `/teams` 公示，并自动生成可打印的公示文档。

## 二、管理后台（人事系统）

`/admin` 根据角色显示不同标签：

| 标签 | 超级管理员 | 部门管理员 | 资源方代表 |
|------|:---:|:---:|:---:|
| 概览 | ✅ | ✅ | ✅ |
| 成员与权限 | ✅（全部用户） | ✅（本部门成员） | — |
| 部门 | ✅ | — | — |
| 岗位 | ✅ | ✅（本部门） | — |
| 报名 | ✅ | ✅（本部门） | — |
| 答辩 | ✅ | ✅（本部门 + 被指派） | ✅（三级 + 被指派） |
| 圆桌与复审 | ✅ | — | — |
| 公示 | ✅ | — | — |
| 部门介绍 | ✅ | ✅（本部门） | — |
| 问答 / 站点配置 | ✅ | — | — |
| 年鉴与名人堂 | ✅ | — | — |

### 成员与权限（核心）

- 按姓名、邮箱、开发者编号、部门搜索；按角色、层级、部门、状态筛选；分页。
- 打开成员详情后可：
  - 设为 **超级管理员**（全局管理；不能移除最后一位超管）；
  - 设为 **资源方代表**（参与三级答辩评审）；
  - 勾选 **部门管理员**（可管理该部门岗位、报名、成员与答辩）；
  - 勾选 **部门负责人**（一级答辩陈述人，自动获得该部门管理员权限）；
  - 调整身份层级（集市 / 项目 / 圆桌）、归属部门、账号状态、技能与简介。
- 取消部门管理员/负责人时，会同步清理旧的部门管理员邮箱白名单，避免权限残留。
- 将身份改为圆桌开发者会检查该部门剩余席位；席位不足会拒绝，需先在「部门」中调整席位。

### 部门与产出

- 部门名称、slug、介绍、负责人、前台展示、排序。
- **保底 / 浮动席位与四项部门指标（交付量、使用量、出人贡献、社区活跃度）不在部门编辑里直接修改**，必须通过「公示」发布。
- 公示发布后自动写回各部门当前席位与指标，并作为下一次审计的基准。

### 答辩管理

- 全部答辩列表、状态筛选、搜索、「只看待我评审」。
- 每一级评审进度、待评审数量、席位占用。
- 详情页可直接提交一级事实陈述 / 二级、三级评审；超级管理员可裁决或改派评审人。

### 会议与席位公示

- 超级管理员在「公示 → + 创建公示」中创建一次会议公示。
- 填写：标题、会议时间、说明；表格中逐部门填写保底/浮动席位与四项指标；系统自动带出上次公示以来的晋升结果，也可手动添加。
- 「保存并发布」后：公示出现在 `/teams`，并自动生成可打印的公示文档（`/publicity/:id`）；同时写回各部门当前席位与指标。
- 草稿可在列表中点「发布」正式生效。

### 集市年鉴与名人堂

- `/history` 把「集市年鉴」组织成一篇可编辑的章节式长文档：左侧目录随滚动高亮，右侧按 `sort_order` 顺序渲染每一章。
- 章节正文使用 Markdown（标题、列表、引用、表格、链接、围栏代码块），由前端轻量渲染器转义后展示；管理员在后台「年鉴与名人堂」中新增/编辑/删除章节，并可直接预览。
- **名人堂固定作为最后一章**，以特殊的双列卡片展示成员：头像/首字、姓名、年份、头衔/部门与一句话寄语。点击卡片打开详情弹层，展示集市主页账号、招聘主页介绍与邮箱 / 微信 / 其他主页（未填写则不展示，微信支持一键复制）。
- **名人堂成员必须来自系统已注册用户**：后台通过搜索下拉选择用户（按姓名 / 邮箱 / 开发者编号检索），保存时校验 `user_id`；姓名与默认头像以用户资料为准，用户改名后前台展示同步更新。
- 成员资料包含：一句话寄语、自我介绍（Markdown）、贡献（Markdown）、职位/头衔、年份、部门、集市主页与联系方式。
- **权限边界**：通过邀请提交的资料，寄语和自我介绍由本人填写，管理员不可覆盖；职位、贡献、部门、年份、主页与联系方式管理员可以调整。管理员直接创建的成员不受此限制。
- 邀请填写页不展示部门选择，提交后默认归入「软工集市」；管理员可在成员编辑中改为「iwiki」等选项。
- 管理员可以直接添加成员，也可以**批量发送填写邀请**：搜索并多选 UniSSO 用户（含尚未在本平台注册的人），可预填头衔，系统为每人生成 14 天有效的专属链接并发送邮件；被邀请人通过 `/hall-invite/:token` 自行填写或更新资料，无需登录。SMTP 未配置时后台会显示链接，可复制手动发送。
- 邀请未注册的 SSO 用户时，系统会先按 SSO 资料自动创建本地账号（`sso_sub` 匹配，邮箱必填、账号需激活），再发送邀请。
- 同一用户只保留最新一个有效邀请；后台可查看状态（待填写 / 已提交 / 已过期 / 已撤销）、复制链接、重发或撤销。
- 成员展示顺序由管理员在后台用「上移 / 下移」调整。
- 页面标题、导语、名人堂章节标题与说明同样可在后台维护，保存后前台即时生效。
- 初始章节内容是一次性的编辑模板，管理员清空后不会自动回灌。

### 圆桌与年度复审

- 查看各部门席位占用、候补队列、圆桌成员。
- 年度复审：填写年度、产出评分、是否达标；未达标自动退出圆桌并释放席位。
- 主动退出圆桌：记录原因，立即释放席位并自动递补。
- 手动触发候补递补。

## 三、角色与权限

| 角色 | 配置方式 | 权限 |
|------|----------|------|
| 超级管理员 | 后台「成员与权限」；部署环境变量 `JOIN_ADMIN_EMAILS` / 站点配置管理员邮箱作为启动引导 | 全部部门、用户角色、岗位、报名、答辩、圆桌、问答、站点配置 |
| 部门管理员 | 后台「成员与权限」勾选部门（或负责人自动获得） | 本部门岗位、报名、成员、答辩；不能管理其他部门/问答/站点 |
| 部门负责人 | 后台「部门」或「成员与权限」设置 | 一级答辩事实陈述；自动获得该部门管理员权限 |
| 资源方代表 | 后台「成员与权限」勾选 | 三级答辩评审；可进入答辩后台 |
| 项目/集市/圆桌开发者 | 登录 / 双选 / 答辩自动流转 | 浏览岗位、维护简历、报名、发起答辩、查看自己的进度 |

- 账号以**邮箱为唯一主键**：同一邮箱只保留一个账号；登录或启动时会自动合并同邮箱的历史账号（岗位/简历/答辩/成员关系一并归并）。
- 身份优先按 `sub` 匹配；没有匹配时按邮箱认领并补写 `sub`。
- 旧数据里的部门管理员邮箱仍兼容；一旦在「成员与权限」重新保存角色，将以用户 ID 关系为准并清理多余邮箱。
- `JOIN_ADMIN_EMAILS` 是**启动引导**超管：每次服务启动都会把这些邮箱提升为超级管理员，适合作为救急入口；日常授权请在「成员与权限」中操作。取消站点配置里的管理员邮箱时，后台会同步移除，避免权限残留。

## 四、登录与认证

### UniSSO 无感登录（主路径）

登录页默认展示邮箱 + 密码表单，调用 `POST /api/auth/login`：

1. 服务端调用 UniSSO `POST /api/oauth/password/verify`（M2M，携带 client_id / client_secret）；
2. 成功响应按 `sub` upsert 本地用户，首次登录自动获得「软工集市开发者」身份，并自动向 UniSSO 同步开发者权限（`is_developer=true`）；
3. 签发本应用 HMAC 会话 Cookie（HttpOnly），并按 UniSSO 返回的 `sso_session / sso_cookie_name / sso_cookie_domain / sso_max_age` 种父域共享 Cookie；
4. 401 / 403 / 429 分别透传「邮箱或密码错误 / 应用未开启无感登录 / 尝试过于频繁」；
5. 管理员与普通用户共用该入口，后台权限只由 `JOIN_ADMIN_SUBS` 与站点配置决定。

### OAuth 授权跳转（保留演示）

登录页同时保留「统一身份授权登录（跳转演示）」，用于展示完整 OAuth2 Authorization Code + PKCE 流程：

1. `/api/auth/sso/start` 生成一次性 `state` 与 PKCE verifier/challenge，302 到 UniSSO `authorize`。
2. 回调 `/api/auth/sso/callback`；服务端用 `client_secret` + `code_verifier` 换 token。
3. 校验 `id_token`（RS256 / JWKS / iss / aud / exp），调用 `userinfo` 获取身份。
4. 按 `sub` 建号或更新，**自动补齐开发者身份**，签发本应用 HMAC 会话（HttpOnly Cookie），302 回 `returnTo`。
5. 不保存 UniSSO access token 作为本应用会话；`sse_sub` 仅作为外部 id 保存。

静默 SSO（`POST /api/auth/sso/try`）仍用于管理员在父域已有 SSO 会话时免刷新进入后台。

### M2M 用户目录

管理员邀请名人堂成员时使用 `POST /api/oauth/users/list` 查询 UniSSO 全量用户（按姓名 / 邮箱 / 学号 / 开发者编号搜索）。该接口与密码校验使用同一套内接应用凭据，需要应用开启「无感登录」（m2m_enabled）；结果服务端缓存 60 秒。

### UniSSO 应用注册信息

在 **应用管理**（https://sso.ssemarket.cn/admin/apps）注册：

| 字段 | 建议值 |
|------|--------|
| 应用名称 | `软工集市 · 开发者平台` |
| Redirect URI（生产） | `https://join.ssemarket.cn/api/auth/sso/callback` |
| Redirect URI（本地联调） | `http://localhost:8091/api/auth/sso/callback` |
| Scopes | `openid profile email` |
| Confidential | `true` |
| Icon URL | `https://join.ssemarket.cn/logo.png` |

Redirect URI 必须完全一致。注册后注入：

```ini
UNISSO_ISSUER=https://sso.ssemarket.cn
UNISSO_CLIENT_ID=<client_id>
UNISSO_CLIENT_SECRET=<client_secret>
UNISSO_REDIRECT_URI=https://join.ssemarket.cn/api/auth/sso/callback
UNISSO_SCOPES=openid profile email
UNISSO_DEFAULT_RETURN_TO=/me
```

## 五、简历与报名

- **岗位筛选**：关键词、部门、岗位方向、参与类型、活动地点、常驻招聘；默认排序 / 最新发布。
- **在线简历**：只保留学校社团真正需要的字段——姓名、年级、邮箱、简介（手机号选填）。修改后自动保存；新建时草稿保存在本机。
- **PDF 简历解析**：≤10MB PDF，服务端先提取文本，再调用 AI（`JOIN_AI_*`，OpenAI 兼容接口）提取姓名、年级、邮箱、手机与简介；AI 不可用时回退到规则解析。扫描件会提示手动填写。
- **常驻招聘（自动通过）**：岗位可标记为「常驻招聘」。报名时系统检查简历是否包含姓名、联系方式、教育背景、技能或项目经历；完整时立即通过并加入部门，不完整时返回缺失项提示。
- **报名管理**：选择简历报名；同一岗位未通过/撤回后可重新报名；报名保存简历快照。
- **双选确认**：普通岗位部门通过后本人确认才进组；个人中心实时展示阶段。

## 五之二、登录即自动开通开发者权限

- **使用集市统一身份登录成功时，系统自动调用 UniSSO `POST /api/oauth/developer/update` 把该用户标记为开发者（`is_developer=true`）**，同时在本地记录 `sso_developer` / `sso_developer_at`。
- 不再要求用户先申请加入「软工集市团队」或先完善简历；登录（邮箱密码无感登录、OAuth 回调、静默 SSO）都会触发。
- 已是开发者、账号已退出（`status=exited`）、缺少邮箱或 UniSSO 未配置时跳过。
- 开通请求最多等待 4 秒：失败只记日志、**不阻断登录**，下次登录自动重试。
- `/join-team` 页面保留为「开发者身份」状态页；如果自动开通因 SSO 临时不可用失败，可在页面点「重试开通」（`POST /api/me/join-team`，无需简历）或重新登录。
- 接口幂等，可重复开通；SSO 不可用时返回明确错误，不静默成功。

## 五之三、后台用户目录缓存

- 后台的负责人 / 部门管理员 / 名人堂邀请等「选人」表单统一使用可搜索下拉，不再手填邮箱。
- 服务端把 UniSSO 全量用户目录缓存到 Pod 本地存储（`sso_user_cache`，30 分钟 TTL，过期后台刷新），搜索只读缓存，避免每次按键都请求 SSO。
- 前端再把合并后的目录缓存到 `sessionStorage`（10 分钟），打开下拉即时匹配；也可手动点「刷新」强制更新。

## 六、技术栈

- 后端：Node 22 + Express + TypeScript（ESM, strict），本地 JSON 存储（可选 MinIO 双写），pdfjs-dist，nodemailer，sm-crypto。
- 前端：Vue 3 + Vue Router + Vite + axios。
- 部署：SSE Deploy（sseinfra，K8s 组容器，无 Docker）。

## 七、本地开发

```bash
# 依赖（server 需要 devDependencies 才能编译）
cd server && npm install --include=dev
cd ../web && npm install

# 后端（默认 :8080）
cd ../server && npm run dev

# 前端（Vite :5175，代理 /api → :8080）
cd ../web && npm run dev
```

本地联调提示：

- 无 SMTP 时可设 `JOIN_MAIL_DEBUG=true` + 清空 `SMTP_HOST`，验证码会回显到服务端日志。
- 验证 SSO 时把 `UNISSO_REDIRECT_URI` 指到本地回调，并在 UniSSO 应用里登记同样的 URI。
- 简历上传走 base64 JSON，`express.json` body 上限按 `JOIN_RESUME_MAX_MB` 自动计算。

## 八、构建与部署

```bash
cd server && npm run build      # tsc → server/dist
cd ../web && npm run build      # vue-tsc + vite → web/dist
```

- 编译产物按项目约定进仓库；`deploy.sh` 发现 dist 已存在时会跳过编译。
- 改源码后重新构建并重启受管进程：
  ```bash
  supervisorctl -c ~/deploy/supervisord.conf restart deploy-JyekPlhqwQ
  ```
- 数据目录 `DATA_DIR`（生产 `/home/cloud/data`）是持久化盘；简历附件在 `DATA_DIR/uploads/resumes/`。
- 配置 MinIO 时，`join-store.json` 会双写；未配置时只落本地持久化盘。

## 九、环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `JOIN_SESSION_SECRET` | ✅ | 会话 HMAC 密钥 |
| `JOIN_API_KEY` | 项目广场必填 | 与开发者平台一致的共享密钥；留空时 `/api/developer/*` 返回 503 |
| `JOIN_RESUME_LINK_SECRET` | 可选 | 简历外链签名密钥，默认复用 `JOIN_SESSION_SECRET` |
| `JOIN_RESUME_LINK_DAYS` | 可选 | 简历外链有效期（天），默认 `90` |
| `JOIN_ADMIN_EMAILS` | 建议 | 启动引导超管邮箱（逗号分隔） |
| `UNISSO_CLIENT_ID` / `UNISSO_CLIENT_SECRET` | SSO 必填 | UniSSO 应用凭证 |
| `UNISSO_ISSUER` | 可选 | 默认 `https://sso.ssemarket.cn` |
| `UNISSO_REDIRECT_URI` | 可选 | 默认 `${PUBLIC_BASE}/api/auth/sso/callback` |
| `UNISSO_SCOPES` | 可选 | 默认 `openid profile email` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | 邮箱登录必填 | 发验证码 |
| `JOIN_MAIL_LOGIN` | 可选 | 管理员邮箱登录开关，默认 `true` |
| `JOIN_RESUME_MAX_MB` | 可选 | PDF 大小上限，默认 `10` |
| `JOIN_AI_API_URL` | 可选 | AI 简历解析接口，默认 `https://api.ssemarket.cn/v1/chat/completions` |
| `JOIN_AI_API_KEY` | 可选 | AI 接口 Bearer Token（不落仓库，放 `.env`） |
| `JOIN_AI_MODEL` | 可选 | 模型名，默认 `qwen-3.8-flash` |
| `JOIN_PDF_MAX_PAGES` | 可选 | PDF 最多解析页数，默认 `30` |
| `DEVELOPER_API_URL` | 可选 | 默认 `https://developer.ssemarket.cn` |
| `PUBLIC_BASE` | 可选 | 站点公网根，默认 `https://join.ssemarket.cn` |
| `MINIO_ENDPOINT/ACCESS_KEY/SECRET/BUCKET` | 可选 | 四项全配启用 MinIO 双写 |

完整占位见 `server/.env.example`。

## 十、数据模型与目录

新增/扩展的核心表（JSON store）：

- `users`：新增 `system_role`、`reviewer_role`、`developer_no`、`developer_level`、`primary_department_id`、`department_joined_at`、`roundtable_joined_at`、`status`、`developer_bio/skills/links`、`sso_developer`（已同步 UniSSO 开发者权限）、`sso_developer_at`。
- `jobs`：新增 `auto_approve`（常驻招聘报名自动通过）；岗位方向 / 地点 / 招募对象 / 年级 / 时间投入在后台改为下拉选择。
- `departments`：新增 `head_user_id`、`admin_user_ids`、`base_seats`、`floating_seats`、四项产出与 `output_note`。
- `site_config`：新增 `teamTitle`、`teamIntro`（Markdown）、`teamHighlights`（每行一条）；团队介绍为空时首页不渲染对应区块。
- `sso_user_cache`：UniSSO 全量用户目录的 Pod 内缓存（30 分钟 TTL），供后台选人下拉搜索。
- `applications`：新增 `stage`（submitted/interview/offered/joined/rejected/withdrawn）、`interview_at/note`、`confirmed_at`、`joined_at`。
- `resumes`：新增 `grade`（年级）；旧的 education/school/major 等字段保留兼容，前台不再要求填写。
- `memberships`：部门成员关系与进出历史。
- `defenses`：答辩单（陈述、资源分配主张、产出、状态、结论）。
- `defense_reviews`：一级事实陈述、二级交叉评审、三级资源方评审。
- `seat_reviews`：年度复审与退出记录。
- `history_chapters`：集市年鉴章节（眉标、标题、摘要、年代、Markdown 正文、排序、显隐）。
- `hall_of_fame`：名人堂成员（`user_id` 关联系统用户、姓名/头像快照、头衔、部门、年份、寄语、自我介绍、贡献、`user_submitted` 标记、集市主页与联系方式）。
- `hall_invites`：名人堂资料填写邀请（用户、token、预填头衔、状态、有效期、发送与提交时间；部门默认软工集市）。
- `history_settings`：年鉴页文案单例（页面标题、导语、名人堂章节标题与说明）。

迁移：`schema_version = 16`，启动时幂等补齐；旧 `applications.status` 会映射到新的 `stage`（`passed → offered`，需本人确认才进组）。v15 补 `auto_approve`、团队介绍字段与 SSO 目录缓存，并隐藏公开问答里与技术部席位流程相关的旧条目；v16 补 `sso_developer` 字段，并把旧的「志愿者 / 社团成员」参与类型收敛为「团队成员」。

```text
join-platform/
  server/src/
    db.ts                  # 数据模型 / 迁移 / 种子
    middleware.ts          # 会话、超管/部门管理员/资源方鉴权
    routes/
      jobs.ts              # 公开岗位 / 双选投递
      departments.ts       # 公开部门（含席位与产出）
      org.ts               # 管理体系公开数据（身份/流程/席位/圆桌）
      auth.ts              # UniSSO + 管理员邮箱登录 + 自动开发者身份
      me.ts                # 个人中心 / 简历 / 身份 / 答辩 / 评审
      admin.ts             # 后台：成员权限、部门、岗位、报名、答辩、圆桌
      faqs.ts / site.ts / history.ts / admin-history.ts
    services/
      org.ts               # 身份、部门成员、席位与公开画像
      defense.ts           # 多级答辩流水线、席位裁决、候补递补
      hall.ts              # 名人堂部门选项与展示名
      sso-users.ts         # SSO 用户目录匹配 / 邀请前自动建号
      pdf.ts / resume-parse.ts / mail.ts / session.ts
    unisso.ts / dev-platform.ts / storage.ts / config.ts
  web/src/
    views/
      HomeView / JobsView / JobDetailView / FaqView / LoginView
      HistoryView          # 集市年鉴长文档 + 名人堂卡片与详情
      HallInviteView       # 邮件邀请链接：本人填写名人堂资料
      MeView               # 个人主页 / 报名 / 简历
      TeamsView            # 席位与晋升公示
      PublicityDetailView  # 公示文档
      DepartmentView       # 部门介绍
      DefenseNewView       # 发起答辩
      DefenseDetailView    # 答辩进度与评审
      AdminView            # 管理后台框架
    components/admin/
      UsersPanel.vue       # 成员查询与角色/人事设置
      DefensesPanel.vue    # 答辩管理
      RoundtablePanel.vue  # 圆桌席位与年度复审
      HistoryPanel.vue     # 年鉴章节、名人堂成员、填写邀请与排名
      UserPicker.vue       # 本地注册用户搜索下拉（名人堂直接添加）
      SsoUserPicker.vue    # UniSSO 用户多选（批量邀请，支持未注册自动建号）
  deploy.sh
```

## 十一、常用 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/history` | 集市年鉴：页面文案、章节列表与名人堂（仅展示已启用项） |
| GET/POST | `/api/history/invite/:token` | 读取邀请信息 / 提交本人名人堂资料 |
| POST | `/api/auth/login` | 邮箱 + 密码无感登录（UniSSO M2M） |
| GET | `/api/admin/history/meta` | 部门选项与 SMTP 配置状态 |
| GET/POST | `/api/admin/history/invites` | 邀请列表 / 发送单个填写邀请 |
| POST | `/api/admin/history/invites/batch` | 批量发送填写邀请（自动创建未注册 SSO 用户） |
| GET | `/api/admin/history/sso-users` | 搜索 UniSSO 全量用户（含未注册，读 Pod 内缓存） |
| GET | `/api/admin/directory/users` | 后台选人下拉：缓存 + 本地用户合并搜索（`registeredOnly=1` 仅本地账号） |
| POST | `/api/admin/directory/refresh` | 强制刷新 UniSSO 用户目录缓存 |
| POST/DELETE | `/api/admin/history/invites/:id/resend` `/invites/:id` | 重发 / 撤销邀请 |
| POST | `/api/admin/history/hall/reorder` | 按 ids 顺序重写名人堂展示排名 |
| GET | `/api/org/overview` | 身份层级、流程、部门席位、圆桌成员、统计 |
| GET | `/api/org/departments/:slug` | 部门详情 + 成员列表 + 产出 |
| GET | `/api/me/developer` | 个人主页、席位、答辩、待评审任务、部门履历 |
| POST | `/api/me/defenses` | 发起答辩（项目开发者） |
| GET | `/api/me/defenses/:id` | 答辩详情（申请人/评审人/管理员） |
| POST | `/api/me/defenses/:id/withdraw` | 撤回答辩 |
| POST | `/api/me/reviews/:id` | 提交评审（一级事实 / 二三级投票） |
| POST | `/api/me/applications/:id/confirm` | 本人确认部门双选 |
| GET | `/api/me/join-team` | 开发者权限状态（登录时已自动开通，这里用于查看/兜底） |
| POST | `/api/me/join-team` | 手动重试开通 UniSSO 开发者权限（无需简历） |
| GET | `/api/admin/users` | 用户搜索（角色/层级/部门/状态/分页） |
| PATCH | `/api/admin/users/:id/role` | 设置超管、资源方、部门管理员、负责人 |
| PATCH | `/api/admin/users/:id/identity` | 调整层级、部门、状态、简介 |
| GET | `/api/admin/defenses` | 答辩列表（按权限裁剪） |
| POST | `/api/admin/defenses/:id/decide` | 超管裁决 |
| GET | `/api/admin/roundtable` | 席位、圆桌成员、候补、复审记录 |
| POST | `/api/admin/roundtable/:userId/review` | 年度复审 |
| POST | `/api/admin/roundtable/:userId/exit` | 退出圆桌并释放席位 |
| POST | `/api/admin/roundtable/promote` | 手动递补候补 |
| GET/PUT | `/api/admin/history/settings` | 年鉴页文案（标题、导语、名人堂章节说明） |
| GET/POST | `/api/admin/history/chapters` | 章节列表 / 新建章节 |
| PUT/DELETE | `/api/admin/history/chapters/:id` | 更新 / 删除章节 |
| GET/POST | `/api/admin/history/hall` | 名人堂成员列表 / 添加成员 |
| PUT/DELETE | `/api/admin/history/hall/:id` | 更新 / 删除名人堂成员 |

## 十二、FAQ

- 首次登录后为什么还是集市开发者？需要在 `/jobs` 投递部门，部门通过后本人确认，才会成为项目开发者。
- 如何发起答辩？先成为项目开发者，然后在「个人主页」点击「发起技术部答辩」（或访问 `/me/defense/new`），填写个人陈述、产出与「如何帮助学院更好分配资源」的核心主张；提交后进入一级 → 二级 → 三级评审。
- 答辩席位满了怎么办？答辩结果会保留为「候补席位」，席位释放时自动递补。
- 如何成为资源方代表？超级管理员在「成员与权限」中勾选；资源方代表参与三级评审。
- 如何设置部门负责人？在「部门」编辑中选择负责人，或在「成员与权限」中勾选负责人部门。