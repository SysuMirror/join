# 调度 / 重试 / 幂等性审计（SK-E3FDE543）

> 需求单：SK-E3FDE543（缺陷 / 平台 join / normal）
> 审计日期：2026-11-23
> 工作分支：`fix/yz-sk-e3fde543`
> 性质：**只读审计**。本文档为唯一改动，未修改任何现有源码。
> 审计对象：`server/src/`（后端），并参考 `deploy.sh`、`README.md`、`web/src/api/index.ts` 中与后端任务触发相关的前端调用。

---

## 一、审计范围与方法

### 1.1 范围

按需求单要求，覆盖后端所有异步 / 定时 / 重试类任务，包括：

- 数据持久化与双写（本地 JSON + MinIO）；
- 启动初始化、迁移、种子、身份同步；
- UniSSO 用户目录的预热、定时刷新、按需刷新；
- UniSSO 开发者标记同步；
- OA 审批单的提交与状态回填（对账）；
- 邮件通知（名人堂填写邀请：单发、批量、重发）；
- 简历 PDF 解析与 AI 字段提取；
- 投递、常驻招聘自动通过、进组；
- 答辩评审推进与席位递补；
- 公示发布后的部门席位/指标回写；
- SSO 登录临时状态、JWKS/discovery 缓存、限流等带有生命周期/重试语义的旁路任务。

### 1.2 方法

1. 静态阅读 `server/src` 全部 TypeScript 源码（约 10.1k 行），重点检索
   `setInterval / setTimeout / AbortSignal / Promise.race / retry / transaction / persist / unique / 409` 等模式。
2. 交叉核对 `git log -S`，确认历史实现与当前实现是否一致（尤其是 OA 推送链路）。
3. 对每条结论标注具体文件与行号，并在交付前用脚本逐条校验引用行存在、行号未漂移。
4. 仓库内无测试目录、无 `test` 脚本、当前副本无 `node_modules`，因此**无法运行单元/集成测试**；
   自测方式见第七节。

### 1.3 结论先行

系统当前是**单进程、全量 JSON 内存库、按请求同步落盘（本地 + 可选 MinIO 双写）**的架构：

- 没有任务队列、没有 outbox、没有 worker、没有 cron 表、没有死信表；
- 唯一的后台定时器是「每 30 分钟刷新一次 UniSSO 用户目录」；
- 其余"后台任务"实际上都是 **HTTP 请求内同步执行**，或 **管理员手动点击触发**；
- 失败处理基本只有两种：`console.warn` 记日志，或把 `false` 返回给前端让用户重试；
- 幂等性主要依赖外部接口自身幂等（UniSSO `developer/update`、开发者平台 OA `oaid` 409），
  本地 JSON 库没有唯一约束、没有版本号、没有分布式锁。

因此主要风险不在"退避算法不够优雅"，而在**副作用与状态变更之间缺少可靠投递机制**，
以及**存储层的并发/多实例语义没有被显式约束**。

---

## 二、执行模型与关键前提

```
浏览器 / 管理员
   │  HTTP
   ▼
Express (单进程, server/src/index.ts)
   │
   ├─ 同步修改 module 级内存 store (server/src/db.ts:1159)
   │      └─ await db.persist() → 全量 JSON.stringify
   │              ├─ 写本地 DATA_DIR/join-store.json（同步、临时文件 + rename）
   │              └─ 尽力写 MinIO data/join-store.json（12s 超时，失败仅告警）
   │
   ├─ setInterval(30min) → refreshSsoDirectory()
   └─ 请求内直接 await 外部服务（UniSSO / SMTP / 开发者平台 / AI）
```

关键前提（均在代码中可验证）：

- **单实例**：`deploy.sh` 最后 `exec node dist/index.js`，由 supervisor 拉起；代码中没有
  多副本协调、选主或锁。
- **全量内存库**：`server/src/db.ts:1159` 的 `store` 是模块级变量，所有路由读写同一对象；
  `persist()` 每次都序列化整个 store（`server/src/db.ts:1155-1157`、`1183-1186`）。
- **本地是主、MinIO 是"尽力备份"**：`server/src/storage.ts:130-142`；
  但**启动时反而优先读 MinIO**：`server/src/storage.ts:108-127`。
- **没有事务性 outbox**：外部副作用（发信、调 SSO、调 OA）与本地状态写入不在同一事务中。

---

## 三、任务清单

| 编号 | 任务 | 触发方式 | 频率 / 并发 | 失败重试 | 重试上限 | 死信 / 补偿 | 幂等保障 | 崩溃恢复 | 主要引用 |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 内存库持久化 + MinIO 双写 | 每次写操作 | 每请求 1 次；并发请求可重叠 | 无（MinIO 失败仅告警） | — | 无 | 全量覆盖写，无版本号 | 启动从 MinIO/本地重建 | `storage.ts:108-142`、`db.ts:1155-1218` |
| T2 | 启动初始化/迁移/种子/身份同步 | 进程启动 | 每次启动 1 次 | 无（失败则进程退出，由 supervisor 重启） | 平台级 | 无 | 迁移/种子按 schema_version 幂等 | 依赖上次落盘 | `index.ts:103-155`、`db.ts:686-1146`、`db.ts:1225-1570` |
| T3 | SSO 用户目录预热 + 定时刷新 | `listen` 回调 + `setInterval` | 启动 1 次 + 每 30 分钟 | 无；下一次定时器再试 | — | 无 | 全量替换缓存，按 sub 去重 | 缓存已落库，重启可复用 | `index.ts:184-191`、`user-directory.ts:53-81` |
| T4 | SSO 用户目录按需刷新 | 后台选人/邀请时缓存过期 | 每次请求 | 无；**每次请求都会再触发** | — | 无 | 单飞（进程内） | 同上 | `user-directory.ts:94-120`、`admin.ts:173-181` |
| T5 | UniSSO 开发者标记同步 | 进组/确认/管理员改身份 | 每个业务动作 1 次 | 无 | — | 无 | 依赖 UniSSO 接口幂等 | 未同步则本地保持 0，无补偿任务 | `developer-sync.ts:9-30`、`jobs.ts:305`、`me.ts:355`、`admin.ts:753/1111/1234` |
| T6 | OA 审批单提交 | **当前无调用点（链路已断）** | 0 | 无 | — | 无 | 历史设计用 `oaid=join-{id}` | 不适用 | `dev-platform.ts:53-92`、`admin.ts:11`、`jobs.ts:330-376` |
| T7 | OA 状态回填（对账） | 管理员点击「刷新 OA」 | 手动、全量串行 | 无；单条失败继续下一条 | — | 无 | 查询天然幂等 | 成功即逐条落盘 | `admin.ts:830-863` |
| T8 | 名人堂邀请邮件（单发/批量/重发） | 管理员操作 | 单次最多 100 人，串行 | 无自动重试；只能人工重发 | — | 无 | 每用户只保留 1 个有效 token | 先落库后发信；发送结果回写 | `admin-history.ts:439-489/523-595/597-630`、`mail.ts:51-81` |
| T9 | 简历 PDF 解析 + AI 提取 | 用户上传简历 | 请求内串行 | 无 | — | 无 | 无（重复上传产生多份） | 文件先落盘、DB 后落盘 | `me.ts:635-773`、`pdf.ts:46-85`、`ai-resume.ts:48-104` |
| T10 | 投递 / 常驻招聘自动通过 / 进组 | 用户投递 | 请求内 | 无 | — | 无 | 业务查重（非原子唯一约束） | 自动通过用 `db.transaction` | `jobs.ts:149-327`、`org.ts:222-267` |
| T11 | 答辩推进 / 席位递补 | 评审提交、退出圆桌 | 请求内同步状态机 | 无 | — | 无 | 状态条件 + 评审只能提交一次 | 请求内一次落盘 | `defense.ts:386-429/504-590` |
| T12 | 公示发布回写部门席位 | 管理员发布 | 请求内 | 无 | — | 无 | 重复发布结果一致 | 同请求落盘 | `admin.ts:1591-1613`、`publicity.ts:176-190` |
| T13 | SSO state 生命周期 | 发起登录时创建、回调时消费 | 每次登录 | 无（回调失败不重试） | — | 无 | 一次性 + 10 分钟过期 | 已落库 | `auth.ts:198-213/243-261` |
| T14 | JWKS / discovery 缓存 | 校验 id_token 时 | 每次校验 | 有：JWKS 最多 2 次，固定 300ms | 2 次 | 无 | 缓存 1 小时 | 进程内缓存，无持久化 | `unisso.ts:65-66/443-486` |
| T15 | 静默 SSO 限流 | `POST /api/auth/sso/try` | 每 IP 每分钟 10 次 | 不适用 | — | — | 进程内固定窗口 | 重启清零 | `auth.ts:60-77/478-487` |

> 说明：T6 在历史提交 `211d466` 中存在（初审通过后调用 `submitOa`），在提交 `3d5285c`
> 中被删除，但 `import { submitOa }`、`buildOaBody` 和 `oa_*` 字段仍保留。详见 4.4。

---

## 四、逐项审计

### 4.1 T1 数据持久化与 MinIO 双写

**现状**

- `saveStoreRaw()` 先同步写本地：临时文件 `${path}.${process.pid}.tmp` + `rename`（`server/src/storage.ts:88-94`），
  再发起 MinIO `PutObject`，用 `Promise.race` 加 12 秒超时（`server/src/storage.ts:130-142`）。
- MinIO 写失败只 `console.error`，不向上抛出（`server/src/storage.ts:139-141`）；
  超时 Promise 只是"放弃等待"，**没有取消底层 PutObject**（未传 `AbortSignal`）。
- 启动加载时，只要配置了 MinIO，就**优先读远端**并覆盖本地（`server/src/storage.ts:111-116`）；
  只有远端返回 `NoSuchKey/404` 才回退本地（`server/src/storage.ts:117-123`）；
  其他网络/权限错误直接抛出，`initDb()` 失败（`server/src/db.ts:1162-1167`、`index.ts:103`）。
- 每次 `persist()` 都 `JSON.stringify(整个 store)`（`server/src/db.ts:1155-1157`），
  库内包含最多 5000 条 `sso_user_cache`（`user-directory.ts:8/67-70`）、简历 `parsed_text`
  和 OA `timeline`，体积会随业务增长。
- `db.transaction()` 通过 `JSON.parse(JSON.stringify(store))` 做全量快照（`server/src/db.ts:1208-1218`），
  失败时整体回滚；但 `fn` 是同步签名，当前只有一处调用（`jobs.ts:297-303`）。

**风险场景与影响**

1. **MinIO 写入乱序 → 重启回滚（高危）**
   - 请求 A、B 先后 `persist`：A 先写本地 S1、发起远端写；B 后写本地 S2、发起远端写。
     两个 PutObject 并发到同一个 key，S3 语义按**完成顺序**覆盖，不按发起顺序。
     若 A 的请求后完成，远端最终是 S1（旧数据），本地是 S2（新数据）。
   - Pod 重建后 `loadStoreRaw()` 优先读远端并覆盖本地，**最新数据被旧数据覆盖**。
   - 12 秒超时后未取消的慢请求还会在更晚时间落地，进一步放大乱序窗口。
2. **MinIO 短暂不可用 → 服务无法启动（高）**
   - 配置了 MinIO 时，`readFromMinio()` 对非 404 错误直接抛出；本地备份明明存在却不会被使用，
     supervisor 会反复拉起失败进程。
3. **本地磁盘写失败 → 内存与磁盘不一致（中）**
   - `writeLocal()` 抛错时，`persist()` 拒绝，但此前的内存修改不会回滚（`db.insert` 等不是事务）；
     调用方通常只返回 500，内存里已出现"写了但没落盘"的状态。
4. **多实例/共享盘下的临时文件碰撞（中，条件触发）**
   - 临时文件名只带 `process.pid`；容器内通常是 PID 1，若两个副本写同一共享目录，
     会落到同一个 `.tmp` 路径，存在互相截断/覆盖风险。
5. **性能与事件循环阻塞（中）**
   - 全量序列化 + 单次数 MB 的同步 `writeFileSync` 发生在请求线程上；
     登录、任何后台写操作都会重复这一成本，库越大延迟越明显。

**改进建议（按成本从低到高）**

1. **明确单副本约束并写入部署说明**：在 `deploy.sh` / README 中声明"本服务必须单副本"，
   在启动时检查（如通过环境变量 `REPLICA_COUNT` 或 K8s Downward API）并拒绝多副本。
2. **MinIO 写串行化**：在 `storage.ts` 内维护一条 `writeChain = writeChain.then(...)`，
   保证同一进程内 PutObject 严格按 persist 顺序完成；超时只影响本次等待，不破坏顺序。
3. **启动选择更新的版本**：store 增加单调递增 `revision` 字段；本地/远端都带 revision，
   启动时选 revision 大者，而不是无条件远端优先；MinIO 不可达时回退本地并告警。
4. **MinIO 写失败进入重试队列**：失败记录"待同步 revision"，由低频定时任务补偿；
   不要静默丢弃。
5. **拆分存储**：把体积大、可再生的 `sso_user_cache` 从主业务 store 拆到独立文件/对象；
   主库只保留业务数据，降低每次 persist 的序列化成本。
6. **迁移到真正的数据库**（中期）：SQLite/Postgres 提供事务、唯一约束、行级并发控制，
   可一并解决 T10/T11 的幂等与多实例问题。

---

### 4.2 T2 启动初始化、迁移与种子

**现状**

- `initDb()` 读取 store、执行 `parseStore → migrate`、立即 `save` 一次（`server/src/db.ts:1148-1167`）。
- `migrate()` 以 `schema_version` 做一次性补齐（`server/src/db.ts:551/769/946/1145`），
  每次加载还会做字段兜底（如 `db.ts:686-920`），注释声明"每次加载都执行，幂等"。
- `ensureSeeds()` 仅在 `jobs.length===0 && seq.jobs===0` 等条件下播种（`server/src/db.ts:1275-1481/1484-1567`）。
- `syncIdentityAndAdmins()` 启动时把环境变量/站点配置里的超管 sub 提升为超管、
  补齐部门负责人管理员关系（`server/src/index.ts:112-155`）；`mergeDuplicateEmailAccounts()`
  合并同邮箱账号（`server/src/index.ts:120`、`org.ts:433-454`）。
- 启动校验缺必填环境变量时 `process.exit(1)`（`server/src/index.ts:158-167`）。

**风险场景与影响**

1. **多副本同时启动 → 种子重复/互相覆盖（高，条件触发）**
   - 两个副本都读到旧库，`seq.jobs===0` 都成立，各自播种并写回，最后写入者覆盖前者；
     若 ID 生成与数组追加交错，可能出现重复部门/岗位或序号回退。
2. **启动失败没有降级（中）**
   - MinIO 读失败、本地磁盘不可写、迁移抛异常都会让进程直接退出；
     当前没有"只读启动 + 告警"或"使用本地旧库启动"的降级路径。
3. **迁移本身不是事务（低-中）**
   - 迁移在内存中逐段修改，最后统一 `persist`；中途抛异常时内存已部分修改，但进程会退出，
     下次启动重新从磁盘加载，通常可恢复。风险主要在"迁移与 seed 混在一起"的可读性/可测试性。
4. **每次启动都会全量重写 store（低）**
   - `initDb` 无条件 `save`，即使没有任何变更；大库时启动 I/O 与 MinIO 上传无谓放大。

**改进建议**

1. 启动前获取**单实例租约**（K8s Lease / 文件锁 / DB advisory lock），拿不到则只读启动或退出；
   这是多副本场景的最低成本护栏。
2. `initDb` 仅在 `migrate` 返回 changed 或版本变化时落盘；避免无变更启动写。
3. 迁移函数返回 `changed`，并对每段迁移加独立版本号；便于测试与回滚。
4. 对 MinIO 读失败增加显式降级：使用本地副本启动 + 在 `/api/health` 暴露 `store_degraded`。

---

### 4.3 T3 / T4 UniSSO 用户目录刷新

**现状**

- 启动 `listen` 后 `warmUserDirectory()` 预热（`server/src/index.ts:185`、`user-directory.ts:246-254`），
  之后 `setInterval` 每 30 分钟刷新（`server/src/index.ts:186-191`），`timer.unref()`。
- `refreshSsoDirectory()` 用模块级 `inflight` 做**进程内单飞**（`user-directory.ts:32/53-81`），
  成功后整体替换 `sso_user_cache` 并 `db.persist()`；失败记录 `lastError` 并抛出。
- `ensureSsoDirectory()` 的 stale-while-revalidate：缓存过期且非空时，**先返回旧缓存**，
  同时 `void refreshSsoDirectory()` 后台刷新（`user-directory.ts:94-120`）。
- 管理员手动刷新接口：`POST /api/admin/directory/refresh`（`admin.ts:173-181`）。
- 上游 `listUnissoUsers()` 自身有 60 秒缓存和 15 秒超时（`unisso.ts:249-289`）。

**风险场景与影响**

1. **SSO 故障时的刷新风暴（中-高）**
   - `inflight` 只防止"同时"，不防止"失败后立刻再试"。
     缓存已过期时，**每一个后台选人/邀请请求**都会触发一次后台刷新（`user-directory.ts:109-112`）；
     SSO 持续不可用时，等于每个请求都打一次 SSO（单飞只是把它们合并成串行请求）。
2. **30 分钟固定间隔、无抖动（低-中）**
   - 单实例无所谓；一旦多副本，所有副本会在同一时刻刷新，形成尖峰。
3. **刷新失败不可观测（中）**
   - `lastError` 只在内存、只通过接口 warning 返回一次；没有持久化失败计数/最后成功时间，
     运维无法判断"目录已经 3 天没更新"。
4. **写入与业务写竞争（中）**
   - `refreshSsoDirectory` 先改内存 `sso_user_cache`，再 `await db.persist()`；
     期间其他请求的写入可能穿插，最终落盘内容以后写者为准（本进程内不丢，但与 T1 的 MinIO 乱序叠加）。

**改进建议**

1. **失败冷却 + 指数退避**：记录 `lastAttemptAt / lastErrorAt / failureCount`，
   失败后 1/2/4/8… 分钟再试，封顶（如 30 分钟）；冷却期内 `ensureSsoDirectory` 不再触发刷新。
2. **把"刷新中/失败"状态持久化**到 store（或独立 metrics），在 `/api/health` 暴露
   `directory_updated_at / last_error / failure_count`。
3. **定时器加抖动**：`30min + random(0..5min)`，为未来多副本做准备。
4. **手动刷新做权限与频控**：`/directory/refresh` 已要求超管，但可加最小间隔（如 60s），
   避免连续点击造成 SSO 压力。

---

### 4.4 T5 UniSSO 开发者标记同步

**现状**

- `syncUnissoDeveloper(user)`：若本地 `sso_developer===1` 直接返回；否则调用
  `updateUnissoDeveloper(email, true)`（12 秒超时，`unisso.ts:339-380`），
  成功则改内存标记并返回 `true`；任何失败只 `console.warn`，返回 `false`（`developer-sync.ts:9-30`）。
- 调用点：
  - 常驻招聘自动通过：`jobs.ts:305`（事务提交之后）；
  - 本人确认加入：`me.ts:355`；
  - 管理员确认加入：`admin.ts:753`；
  - 部门负责人任命：`admin.ts:392`；
  - 用户权限/身份调整：`admin.ts:1111`、`admin.ts:1234`；
  - 用户主动开通：`me.ts:244-262`。
- 没有定时对账、没有待办表：失败后**不会自动重试**，只能等用户/管理员再次触发相关动作。

**风险场景与影响**

1. **一次失败 → 本地与 SSO 长期不一致（中-高）**
   - 进组时 SSO 恰好 5xx/超时，用户在本平台是项目开发者，但 UniSSO 仍是普通用户；
     之后若无人再改动该用户身份，`sso_developer` 永远为 0。
   - 反向也会发生：SSO 已开通成功，但本地持久化失败/进程崩溃，本地记录 0，后续重复调用（接口幂等，可接受）。
2. **长等待放大请求延迟（中）**
   - `admin.ts:392/1111/1234` 在业务修改之后、`db.persist()` 之前 `await` 最长 12 秒的网络调用；
     期间内存已改、响应未发，既扩大崩溃丢写窗口，也让管理员操作明显变慢。
3. **多副本重复调用（低）**
   - 接口幂等，重复调用无害，但会产生额外 SSO 压力。

**改进建议**

1. 增加 `sso_sync_pending` / `sso_sync_attempts` / `sso_sync_next_at` 字段（或独立 outbox 表），
   失败后由后台 worker 按指数退避重试，达到上限进入人工处理列表。
2. **先落盘、后同步**：把 `db.persist()` 放在业务状态变更之后立即执行，
   再异步触发 SSO 同步，避免网络等待期间的内存/磁盘不一致。
3. 增加每日对账任务：对 `developer_level in (project, roundtable)` 且 `sso_developer!==1`
   的用户批量补同步，并对 SSO 侧标记为 developer 但本地非 project/roundtable 的差异输出报告。

---

### 4.5 T6 / T7 OA 审批单提交与状态回填（对账）

**现状**

- `dev-platform.ts` 提供 `submitOa()`（`53-92`）与 `queryOa()`（`95-115`），
  均使用裸 `fetch`，**没有 `AbortSignal`/超时**；网络错误被转成 `{httpStatus:502,error}`。
- 历史版本（`git show 211d466:server/src/routes/admin.ts`）在"初审通过"时调用 `submitOa`，
  写回 `app.oa_oid/oa_status/oa_timeline`；提交 `3d5285c` 删除了该调用，
  但：
  - `admin.ts:11` 仍 `import { submitOa, queryOa }`；`admin.ts:12` 仍 `import { buildOaBody }`；
  - `jobs.ts:330-376` 仍导出 `buildOaBody`；
  - `applications` 仍保留 `oa_oid/oa_status/oa_checked_at/oa_timeline` 字段（`db.ts:143-150`）；
  - 前端仍保留「刷新 OA」按钮与 `oaTimeline` 展示（`web/src/views/AdminView.vue:170/638-641`）。
- 当前 `app.oa_oid` 从未被赋值（`jobs.ts:288` 初始化为空串），因此
  `POST /api/admin/applications/refresh-oa` 的目标集合
  `status==='passed' && oa_oid && oa_status==='pending'`（`admin.ts:853-856`）**恒为空**。
- `refreshOa()` 内部 `queryOa` 成功后逐条 `await db.persist()`（`admin.ts:830-842`）；
  外层循环串行（`admin.ts:857-861`），并且 `updated += 1` 无论是否真正更新。
- 前端该接口设置 30 秒超时（`web/src/api/index.ts:950-955`），但服务端没有超时，
  浏览器超时后服务端仍会继续执行。

**风险场景与影响**

1. **功能静默失效（高）**
   - 代码、字段、按钮、README（`README.md:91` 仍称"初审通过 → 推送 OA 由人工点击触发"）
     都暗示 OA 链路存在，实际**没有任何路径会推送 OA**；
     管理员看到"已刷新 0 条"会误以为正常。
2. **对账任务不可用（高）**
   - 即使历史数据里有 `oa_oid`，`queryOa` 没有超时；开发者平台无响应时，
     `/refresh-oa` 可能按"每条数分钟 × N 条"挂住，前端 30 秒断开后服务端继续跑，
     重复点击会叠加多个长任务。
3. **部分失败无记录（中）**
   - 单条查询失败不写 `oa_checked_at`，也没有失败原因/重试次数，无法区分"没查"与"查失败"。
4. **统计口径错误（低-中）**
   - `updated` 统计的是"尝试条数"，不是"实际更新条数"（`admin.ts:858-860`）。

**改进建议**

1. **先做决策，再改代码**：
   - 若 OA 对接仍需保留：在明确的状态节点（如 `offered` 或 `joined`）恢复 `submitOa` 调用，
     使用 `oaid=join-{applicationId}` 作为幂等键，持久化 `oa_oid`；
     调用失败不能让业务失败，应写入待推送状态由后台重试。
   - 若 OA 对接已废弃：删除 `submitOa`/`buildOaBody`/`oa_*` 字段/前端按钮/README 表述，
     避免"看起来有、实际没有"的认知负担。
2. 为 `dev-platform.ts` 的所有 `fetch` 增加 `signal: AbortSignal.timeout(10_000~15_000)`；
   批量刷新设置总预算（如 60 秒）与单次最大条数（如 20 条），剩余留到下一轮。
3. 把"刷新 OA"改成后台任务：接口只负责入队并立即返回 `task_id`，前端轮询任务状态；
   失败条目记录 `last_error/attempts/next_retry_at`，进入死信列表供人工处理。
4. 接口返回值区分 `attempted / updated / failed / skipped`，并写审计日志。

---

### 4.6 T8 邮件通知（名人堂邀请）

**现状**

- `sendMail()` 每次调用新建 `nodemailer.createTransport(...)`，没有连接池、没有显式
  `connectionTimeout/greetingTimeout/socketTimeout`；失败 `console.error` 并返回 `false`（`mail.ts:51-81`）。
- 单发 `createInviteForUser()`：先撤销该用户所有 `pending/submitted` 邀请，
  再生成新 token、`await db.persist()`，然后发信，成功后再 `persist` 写 `sent_at`
  （`admin-history.ts:439-489`）。
- 批量邀请：最多 100 人，**串行**逐个 `resolveInviteTarget → createInviteForUser`
  （`admin-history.ts:523-595`）。
- 重发：未过期且未撤销时复用原 token，只重发邮件；过期/撤销时换新 token（`admin-history.ts:597-630`）。
- 无通知队列；没有针对投递状态变更的邮件通知（目前邮件只用于名人堂邀请）。

**风险场景与影响**

1. **SMTP 慢/挂时请求长时间挂起（中-高）**
   - 单封可能等待分钟级；批量 100 封串行最坏可达数小时。
     前端批量接口超时 120 秒（`web/src/api/index.ts` 中 `adminCreateHallInvitesBatch`），
     用户会先看到失败并重试，而服务端仍在继续发信。
2. **重试导致重复邮件/链接失效（中）**
   - 批量接口非事务：重试会对已成功的人**再建一个新邀请**，撤销旧 token 并再发一封邮件；
     第一封邮件里的链接在第二封发出后失效，收件人体验受损。
   - 若发信成功但第二次 `persist` 失败/进程崩溃，`sent_at` 未记录，后台显示"未发送"，诱发重复发送。
3. **没有退避/死信（中）**
   - SMTP 临时限流（4xx）后没有自动重试；全部依赖管理员手工点"重发"。
4. **单连接模式（低-中）**
   - 每次发信新建 transport，TLS 握手成本高，也更容易触发服务商频控。

**改进建议**

1. **邮件 outbox**：邀请记录先落库（状态 `pending_send`），后台 worker 取出后发送，
   成功写 `sent_at`，失败写 `attempts/last_error/next_retry_at`，超过上限进入死信。
   接口立即返回"已排队"。
2. **批量接口幂等**：请求带 `batch_id`（或幂等键）；同一 `batch_id` 重试只补发失败项，
   不重新生成已成功项。
3. `nodemailer` 复用单例 transport，并设置 `connectionTimeout: 10s`、`greetingTimeout: 10s`、
   `socketTimeout: 30s`；批量并发限制（如 2-3 并发）而非无限串行。
4. 发送结果写审计记录（谁、何时、模板、结果、错误），支持按邀请查询投递历史。

---

### 4.7 T9 简历 PDF 解析与 AI 字段提取

**现状**

- `POST /api/me/resumes/upload`：base64 解码 → 校验 PDF → 同步 `fs.writeFileSync` 落文件
  （`me.ts:671-684`）→ `await extractPdfText(buf)`（pdfjs，最多 30 页，`config.uploads.maxPdfPages`）
  → `parseResumeText` → `await parseResumeWithAi(text)`（OpenAI 兼容接口，超时由
  `AbortSignal.timeout(config.ai.timeoutMs)` 控制，默认 30 秒，`ai-resume.ts:84`、`config.ts:78`）
  → 构造并插入简历行 → `db.persist()`（`me.ts:686-762`）。
- 解析失败会被 `catch`，仍然创建简历并写入 `parse_note`（`me.ts:705-708`）。
- 前端上传超时 120 秒（`web/src/api/index.ts` 中 `uploadResume`）。
- 无任务队列、无去重键、无按用户限流；每次上传生成 `randomUUID` 文件名（`me.ts:677`）。

**风险场景与影响**

1. **请求内做 CPU/网络长任务（中-高）**
   - pdfjs 解析大 PDF 可能长时间占用事件循环，影响所有并发请求；
     AI 调用最长 30 秒。极端 PDF 可让 Node 进程接近"假死"。
2. **崩溃/持久化失败产生孤儿文件（中）**
   - 文件在 DB 行落库前写入；若 `db.persist()` 失败或进程崩溃，磁盘留下无引用的 PDF，
     简历记录丢失（用户需重传）。
3. **重复提交无幂等（中）**
   - 双击/网络重试会生成两份文件、两条简历记录；没有基于内容哈希的去重。
4. **无配额/限流（中）**
   - 单用户可反复上传 10MB 文件并触发 AI 调用，造成磁盘与 AI 配额消耗。
5. **AI 解析失败静默降级（低）**
   - 返回 `null` 后使用规则解析，用户只看到提示；没有失败指标，难以发现上游持续故障。

**改进建议**

1. **异步化**：上传接口只负责落文件 + 创建 `resume (parse_status=pending)` 行并立即返回；
   后台 worker 解析/AI 提取后回填，前端轮询或刷新查看。至少把 AI 与 pdfjs 移出请求路径。
2. **先落库再落文件**或使用"文件副本 + 引用计数"，并增加孤儿文件清理任务
   （扫描 `uploads/resumes` 与 `resumes.file_path` 差集，超过 N 天未引用则删除）。
3. **内容哈希去重**：同一用户相同 SHA-256 的文件直接复用已有简历或提示重复。
4. 增加按用户限流（如每分钟 3 次上传）与单用户存储配额。
5. 记录 `parse_status/parse_error/parse_attempts`，提供重试入口。

---

### 4.8 T10 投递、常驻招聘自动通过、进组

**现状**

- 投递查重：同 `job_id + user_id` 且 `stage` 不是 `rejected/withdrawn` 的申请存在则 409
  （`jobs.ts:194-203`）。JSON 库中没有唯一约束。
- 自动通过：校验简历完整后，在 `db.transaction` 内 push 申请并 `joinDepartment`
  （`jobs.ts:296-303`）；事务外再 `await syncUnissoDeveloper` 并可能再次 `persist`
  （`jobs.ts:305`）。
- `joinDepartment()` 会结束其他部门的 active membership、复用/新建当前部门 membership、
  更新用户主部门与身份（`org.ts:222-267`）。
- 普通投递：`db.insert('applications', row)` 内部先 push 再 `persist`（`db.ts:1199-1207`）。

**风险场景与影响**

1. **查重不是原子唯一约束（中-高，多实例/并发）**
   - 单进程内因为查重与插入之间没有 `await`，实际是原子的；
     但多副本下两个请求可同时通过查重，产生重复申请。
     迁移到数据库后如果没有唯一索引，同样会复现。
2. **自动通过事务与 SSO 同步不原子（中）**
   - 事务已落盘（用户已进组）后，`syncUnissoDeveloper` 失败只记日志；
     用户成为项目开发者但 SSO `is_developer` 未开通（与 4.4 同类问题）。
3. **崩溃窗口（中）**
   - 普通投递 `db.insert` 若本地写失败，行已 push 进内存但未落盘；
     后续请求可能看到该申请，重启后消失。
4. **进组副作用无幂等键（低）**
   - `joinDepartment` 通过"是否已有 active membership"实现幂等，重复调用不会重复建关系；
     但 `source_application_id` 只保留最后一次，历史来源可能被覆盖。

**改进建议**

1. 在 store 层提供 `findOrInsert`/唯一键校验，或用数据库唯一索引
   `(job_id, user_id, active_flag)`；写入前在同一临界区内完成查重与插入。
2. 自动通过事务内只写业务状态；SSO 同步放入 outbox（见 4.4），保证最终一致。
3. 为 `applications` 增加 `idempotency_key`（前端生成），重复提交直接返回已有记录。

---

### 4.9 T11 答辩推进与席位递补

**现状**

- 评审提交：`submitReview()` 校验权限与状态后，写评审结果，调用 `advanceDefense()` 同步推进
  一级→二级→三级→通过/拒绝/候补（`defense.ts:448-486`、`386-429`），路由最后 `db.persist()`
  （`admin.ts:1336-1362`）。
- 通过时 `finalizePass()` 读取 `departmentSeatStats()`，无空位则 `waitlist`，有空位则升级为
  `roundtable` 并可能 `joinDepartment`（`defense.ts:332-372`）。
- 退出圆桌/复审未达标时 `releaseRoundtableSeat()` → `promoteWaitlist()` 循环递补
  （`defense.ts:504-590`）。
- 管理员强制裁决 `forceDecide()` 可跳过未完成评审，但仍走 `finalizePass` 的席位检查
  （`defense.ts:489-501`）。

**风险场景与影响**

1. **多实例下席位超发（高，条件触发）**
   - 两个副本同时处理两位候选人的最后一份评审：各自读到"剩余 1 个席位"，各自 `finalizePass`，
     最终两人都成为 roundtable，占用超过总席位。
   - 递补 `promoteWaitlist` 同理，可能一次递补过多。
2. **状态机与外部副作用无事务（中，单进程可接受）**
   - 单进程内 `advanceDefense` 全同步，没有 `await`，不会被其他请求打断；
     但若未来在其中加入网络调用，就需要显式锁/事务。
3. **评审提交重复（低）**
   - `canSubmitReview` 要求 `status==='pending'`，重复提交会被拒绝，幂等性尚可。
4. **强制裁决与自动流程竞争（低）**
   - `forceDecide` 只检查终态；若同时有评审在推进（单进程串行），后到者看到的已是终态，安全。
     多实例下同样需要锁。

**改进建议**

1. 多实例前，把"席位分配"收敛为数据库原子操作：
   `UPDATE departments SET occupied=occupied+1 WHERE occupied < total RETURNING ...`，
   或对部门行加 `SELECT ... FOR UPDATE`。
2. 若短期维持 JSON 存储，增加进程级互斥（`async-mutex`）包住"评审推进 + 席位分配 + 落盘"，
   并在部署上强制单副本。
3. 为 `defenses` 增加状态迁移审计日志（谁、从什么状态到什么状态、依据哪次评审），
   便于事后核对超发。

---

### 4.10 T12 公示发布回写部门席位

**现状**

- `POST /api/admin/publicities`：解析席位/晋升 → 构造公示行 → push →
  若已发布则 `applyPublicityToDepartments(seats)` 写回部门当前席位与四项指标 →
  `db.persist()`（`admin.ts:1591-1613`、`publicity.ts:176-190`）。
- 仅超级管理员可操作（`admin.ts:1527` 的 `adminRouter.use('/publicities', requireGlobalAdmin)`）。

**风险场景与影响**

1. **重复发布/并发发布（低-中）**
   - 同一份席位重复发布会得到相同结果，近似幂等；
     两位超管同时发布不同表格时，单进程串行、后写者覆盖，符合"最后操作生效"直觉。
2. **席位回写与答辩占用不一致（中）**
   - `applyPublicityToDepartments` 直接按公示表覆盖 `base/floating`；
     如果当前 roundtable 人数已超过新总席位，系统不会阻止，后续答辩/递补会看到 `available=0`，
     但已超员状态会保留到有人退出。
3. **无草稿到发布的版本记录（低）**
   - 每次发布新增一行，历史可追溯；但编辑草稿 `PUT` 也会直接改已发布行，缺少"发布快照不可变"约束。

**改进建议**

1. 发布前校验 `occupied <= base + floating`，不满足则要求先处理超员（退出/调整）。
2. 已发布公示的席位表设为不可变（编辑生成新版本或需显式"重新发布"）。
3. 发布动作记录审计日志，并在响应中返回受影响的部门与人数变化。

---

### 4.11 T13 SSO 登录临时状态

**现状**

- `/api/auth/sso/start`：每次发起登录时顺手清理 15 分钟前的旧 state
  （`auth.ts:198-202`），写入新 state + PKCE verifier，10 分钟过期（`auth.ts:203-213`）。
- 回调：按 state 查找，校验未使用、未过期；**先标记 `used=1` 并 `persist`，再兑换 code**
  （`auth.ts:243-261`）。
- 兑换失败/网络异常时 state 已经被消费，用户只能重新发起登录（`auth.ts:263-368`）。

**风险场景与影响**

1. **瞬时网络失败导致登录失败一次（低-中）**
   - code 兑换超时后 state 已作废，浏览器回退/重试回调会得到"登录凭证已使用"。
     用户需要重新点登录，体验受损。
2. **未发起新登录时旧 state 不会被清理（低）**
   - 清理只在 `/sso/start` 执行；若站点长期无人登录，过期 state 会一直留在 JSON 里
     （体积很小，但属于无界增长模式）。
3. **多实例下 state 不共享（高，条件触发）**
   - state 存在单实例内存/本地 JSON；若多副本且回调落到另一副本，会报"登录状态不存在"
     （代码注释已提示"可能进程重启或跨实例"，`auth.ts:246`）。

**改进建议**

1. 将"标记已使用"放到 code 兑换成功之后，或允许在 10 分钟有效期内、同一 state 的
   瞬时失败重试一次（需要防重放策略，例如记录 attempt 计数与时间窗）。
2. 增加独立的 state 清理定时任务（例如每小时），或在 `persist` 时顺带裁剪。
3. 多实例场景把 state 放入共享存储（Redis/DB）；短期至少保证会话粘性或强制单副本。

---

### 4.12 T14 JWKS / discovery 缓存重试

**现状**

- `fetchWithTimeout()` 统一加 `AbortSignal.timeout`（`unisso.ts:65-66`）。
- `getJwks(force)`：缓存 1 小时；失败时最多 2 次尝试，间隔固定 300ms（`unisso.ts:469-486`）。
- discovery 失败回退到硬编码端点（`unisso.ts:52-71`）。
- 登录回调对 `JwksError` 有降级：JWKS 不可用时继续用 userinfo 验证身份（`auth.ts:266-279`）。

**风险场景与影响**

1. **固定 300ms 重试对瞬时抖动帮助有限（低）**
   - 只有 2 次尝试；上游 503 持续超过 ~600ms 就会失败。好在有 userinfo 降级路径。
2. **JWKS 缓存只在内存（低）**
   - 重启后首次登录需要拉取；上游故障时重启窗口内无法校验 id_token（会走降级）。

**改进建议**

1. 重试改为 2-3 次、指数退避 + 小抖动（如 300ms/900ms），仍保持总预算 < 5 秒。
2. `kid` 找不到时强制刷新已有（`verifyIdToken` 已实现），可再加"刷新失败仍用旧 key 集合"的兜底。
3. 监控 JWKS 拉取失败率与降级次数。

---

### 4.13 T15 静默 SSO 限流

**现状**

- 进程内 `Map<ip,{count,resetAt}>`，每 IP 每分钟 10 次（`auth.ts:60-77`）；
  仅在新建窗口时顺带清理过期条目（`auth.ts:70-72`）。
- IP 取 `X-Forwarded-For` 首跳，否则 `req.ip`（`auth.ts:49-58`）。

**风险场景与影响**

1. **多实例下限流失效（中，条件触发）**：每个副本独立计数，实际额度 = 10 × 副本数。
2. **XFF 可伪造（中，安全侧）**：若入口不是受信代理，攻击者可伪造首跳 IP 绕过限流。
3. **Map 增长（低）**：仅在新窗口创建时清理，攻击者用大量不同 IP 可让 Map 持续增长；
   单 IP 条目很小，风险有限。

**改进建议**

1. 明确部署拓扑：只有受信代理（frps/nginx）才能设置 XFF；服务端校验来源或改用代理注入的可信头。
2. 多实例时改用 Redis 固定窗口/令牌桶（平台已提供 Redis 凭证）。
3. 定期全量清理过期条目，或改用有界 LRU。

---

## 五、横切问题

### 5.1 没有 outbox / 投递语义

所有"状态变更 + 外部副作用"组合都是**先改内存、再调用外部、再落盘**或**先落盘、再调用外部**，
没有任何一种能同时保证：

- 状态变更一定持久化；
- 副作用一定至少执行一次；
- 失败可重试且不会重复产生用户可见副作用。

典型组合：

| 组合 | 现状 | 可能结果 |
|---|---|---|
| 进组 + SSO 开通 | 事务落盘 → `await sync` → 失败仅日志 | 本地进组成功、SSO 未开通 |
| 邀请落库 + 发信 | 落库 → `await send` → 成功回写 `sent_at` | 发信成功、回写失败 → 重复发送 |
| 管理员改身份 + 落盘 | 改内存 → `await sync`（最长 12s）→ 落盘 | 期间崩溃 → 内存/磁盘全丢 |
| OA 推送（历史） | 外部提交 → 写回本地 | 提交成功、写回失败 → 重复提交（靠 oaid 幂等） |

### 5.2 没有统一的失败观测

- 失败主要是 `console.warn/error`；没有结构化日志字段（task、attempt、next_retry）、
  没有指标、没有管理端"任务失败列表"。
- `/api/health` 只返回配置状态与时间（`index.ts:58-71`），不包含目录刷新/存储同步/邮件队列状态。

### 5.3 定时任务能力几乎为空

- 唯一定时器是 30 分钟目录刷新；
- 没有持久化的 `next_run_at`，进程重启后节奏重置；
- 没有错过执行的补偿（例如停机期间应跑的清理/对账不会补跑）；
- 没有任务互斥（进程内单飞不等于跨实例互斥）。

### 5.4 幂等性现状总结

| 对象 | 幂等键/机制 | 评价 |
|---|---|---|
| OA 提交 | `oaid=join-{applicationId}`，409 视为已提交 | 设计正确，但当前未启用 |
| UniSSO 开发者开通 | 接口自身幂等 | 可重复调用，但无本地重试 |
| 名人堂邀请 | 每用户只保留 1 个有效 token | 单次幂等，重试会换 token 并重复发信 |
| 投递 | 业务查重（非唯一约束） | 单进程安全，多实例不安全 |
| 进组 membership | 查 active 关系后复用 | 单进程安全，`source_application_id` 会被覆盖 |
| 评审提交 | `status='pending'` 条件 | 幂等 |
| 席位分配/递补 | 无唯一约束、无锁 | 多实例会超发 |
| 简历上传 | 无 | 重复上传产生多份 |
| 持久化 | 全量覆盖、无 revision | 乱序写会回滚 |
| 邮件发送 | 无 | 重试/重放会重复 |

### 5.5 代码级遗漏

- `POST /api/admin/defenses/:id/reassign` 修改了 `review.reviewer_user_id / reviewer_name`
  但**没有调用 `db.persist()`**（`admin.ts:1387-1414`）。
  响应成功，内存生效；若在下次任意写操作前进程重启，调整丢失。
- `admin.ts:11-12` 的 `submitOa`、`buildOaBody` 为未使用导入；`dev-platform.ts` 的 `submitOa`
  为死代码（见 4.5）。
- `db.reload()`（`db.ts:1194-1197`）没有调用点，外部直接修改 MinIO 对象不会被运行中的进程感知。

---

## 六、改进建议（按风险 / 成本排序）

> 排序原则：先做"防止数据回滚/副作用丢失"的低成本护栏，再做架构级重构。
> 成本估计：S（< 0.5 天）、M（1-3 天）、L（1-2 周，需改存储）。

| 优先级 | 建议 | 解决的风险 | 成本 | 备注 |
|---|---|---|---|---|
| P0-1 | **强制单副本**：部署说明 + 启动检查（环境变量/Downward API），禁止多副本 | T1/T2/T10/T11/T13 的所有多实例问题 | S | 当前架构的最重要前提 |
| P0-2 | **MinIO 写串行化 + 启动选新版本**：进程内写链；store 加 `revision`；启动比较本地/远端 revision；远端不可达回退本地 | 重启数据回滚、MinIO 故障无法启动 | M | 改动集中在 `storage.ts` |
| P0-3 | **失败不静默**：MinIO 写失败进入待同步队列/告警；`/api/health` 暴露 store 同步状态 | 远端长期落后无人知 | S-M | 可先只做指标/日志 |
| P1-1 | **引入 outbox 表 + 后台 worker**（邮件、SSO 开发者同步、OA 推送、目录刷新） | 副作用丢失、重复发送、无重试 | M-L | 统一 `status/attempts/next_at/last_error` |
| P1-2 | **所有外部调用加超时**：`dev-platform.ts` 加 `AbortSignal`；`mail.ts` 设置 SMTP 超时；批量限并发 | 请求挂死、批量任务数小时 | S | 低成本高收益 |
| P1-3 | **OA 链路决策**：恢复推送或彻底删除死代码/字段/前端按钮/README | 功能静默失效、对账空转 | S（删除）/ M（恢复） | 需产品确认 |
| P1-4 | **长任务移出请求路径**：简历解析/AI、批量邀请、refresh-oa 改为"入队 + 轮询" | 事件循环阻塞、浏览器超时后服务端继续跑 | M | 可先对批量与 OA 做 |
| P2-1 | **幂等约束**：投递唯一键、上传内容哈希、邀请 batch_id、简历上传限流 | 重复数据、重复邮件 | M | 与存储迁移一起做更顺 |
| P2-2 | **目录刷新退避/冷却 + 抖动 + 状态持久化** | SSO 故障刷新风暴 | S-M | 改动小 |
| P2-3 | **先落盘后外部调用**：把 `await syncUnissoDeveloper` 移到 `db.persist()` 之后（或 outbox 化） | 崩溃丢写窗口、请求变慢 | S-M | `admin.ts:392/1111/1234`、`me.ts:355` |
| P2-4 | **修复 `reassign` 未持久化** | 评审人调整丢失 | S | `admin.ts:1411-1413` |
| P3-1 | **SSO state 独立清理 + 兑换失败可重试** | 临时状态堆积、登录一次失败 | S-M | 需防重放设计 |
| P3-2 | **JWKS 退避重试 + 指标** | 登录抖动 | S | |
| P3-3 | **限流共享化 + 可信 XFF** | 多实例限流失效、绕过 | M | 依赖 Redis |
| P3-4 | **优雅停机**：SIGTERM 停止接单、等待 in-flight persist、刷新 MinIO | 重启尾部丢写 | S-M | supervisor `stopwaitsecs` 配合 |
| P3-5 | **拆分 `sso_user_cache` / 减少全量写** | 序列化开销、磁盘写放大 | M | 可与 P0-2 一起做 |

### 建议的落地顺序（最小改动版）

1. P0-1 + P0-2 + P2-4（半天到一天，先止血）。
2. P1-2（所有外部调用超时，半天）。
3. P1-3 决策（删除或恢复 OA，半天到两天）。
4. P1-1 + P1-4（outbox 与后台 worker，1-2 周）。
5. P2/P3 按需。

---

## 七、Top 5 风险

1. **MinIO 双写乱序 + 启动无条件优先远端 → 重启后数据回滚（P0）**
   并发 `persist` 的 PutObject 完成顺序不可控；12 秒超时不取消底层写；
   启动时远端覆盖本地。一次 Pod 重建就可能丢掉最近的业务变更。
   引用：`storage.ts:96-142`、`db.ts:1155-1167`。
2. **没有 outbox / 重试 / 死信：外部副作用失败即永久丢失（P1）**
   进组的 UniSSO 开发者标记、名人堂邀请邮件、目录刷新、OA 状态回填，
   失败后都只记一条日志，没有自动补偿；只能依赖用户/管理员再次触发或人工重发。
   引用：`developer-sync.ts:9-30`、`mail.ts:51-81`、`user-directory.ts:53-81`、`admin.ts:830-863`。
3. **单进程内存库 + 无锁：多副本会重复副作用、丢更新、席位超发（P1）**
   代码没有选主/租约/分布式锁；`deploy.sh` 单实例执行只是部署约定，不是代码保证。
   一旦横向扩容：并发投递重复、批量邀请重复发信、答辩同时通过导致圆桌人数超过席位、
   state/限流/定时刷新各自为政。引用：`db.ts:1159-1218`、`jobs.ts:194-203`、
   `defense.ts:332-372/569-590`、`auth.ts:60-77`。
4. **OA 审批链路已断且对账不可用，同时外部调用缺少超时（P1）**
   `submitOa` 在 `3d5285c` 中被移除，`oa_oid` 恒为空，`refresh-oa` 恒刷新 0 条，
   但 UI/字段/README 仍保留；`dev-platform.ts` 的 `fetch` 无超时，
   一旦恢复调用或存在历史数据，可能挂住数分钟并叠加重复任务。引用：`admin.ts:11-12/830-863`、
   `dev-platform.ts:53-115`、`jobs.ts:330-376`。
5. **长耗时任务内联在 HTTP 请求中，缺少队列/超时/并发限制（P1）**
   简历 PDF 解析与 AI 提取（最长 30 秒，CPU 密集）、最多 100 人的串行邀请邮件、
   全量 OA 刷新都在请求线程里执行；浏览器超时后服务端仍在继续，
   重复点击会叠加任务，容易拖慢甚至拖垮整个单进程服务。
   引用：`me.ts:635-762`、`pdf.ts:46-85`、`ai-resume.ts:48-104`、
   `admin-history.ts:523-595`、`admin.ts:845-863`。

---

## 八、验证记录（自测说明）

本需求为只读审计，交付物只有本文档。验证方式：

1. `git status` / `git diff --stat`：确认只新增 `docs/scheduling-audit.md`，未修改源码。
2. 引用行校验：用脚本提取文中所有 `server/src/**/*.ts:行号` 引用，
   逐条读取对应行，确认文件存在、行号在范围内、内容与描述一致（关键引用人工二次核对）。
3. `git diff --check`：确认无空白错误。
4. 未运行构建/测试的原因：仓库内没有测试目录与 `test` 脚本；当前沙箱副本没有 `node_modules`，
   且本次改动不涉及 TypeScript 代码，编译不会提供额外信号。
   建议后续在 CI 中补充"任务失败注入 + 幂等"测试（见第六节 P2-1/P1-1）。

---

## 附录 A：关键引用索引

| 主题 | 位置 |
|---|---|
| 唯一定时器（30 分钟目录刷新） | `server/src/index.ts:184-191` |
| 启动初始化/迁移/身份同步 | `server/src/index.ts:103-155`、`server/src/db.ts:1148-1167` |
| 内存 store 与 persist | `server/src/db.ts:1159-1218` |
| 事务快照/回滚 | `server/src/db.ts:1208-1218` |
| 本地写（tmp + rename） | `server/src/storage.ts:88-94` |
| 启动读 MinIO 优先、覆盖本地 | `server/src/storage.ts:108-127` |
| MinIO 尽力双写 + 12s 超时 | `server/src/storage.ts:130-142` |
| 目录单飞/刷新/失败 | `server/src/services/user-directory.ts:32-120` |
| 目录预热 | `server/src/services/user-directory.ts:246-254` |
| 开发者标记同步 | `server/src/services/developer-sync.ts:9-30` |
| OA 提交/查询（裸 fetch） | `server/src/dev-platform.ts:53-115` |
| OA 刷新路由 | `server/src/routes/admin.ts:830-863` |
| OA 无用导入 | `server/src/routes/admin.ts:11-12` |
| `buildOaBody`（当前无调用） | `server/src/routes/jobs.ts:330-376` |
| 邮件发送 | `server/src/services/mail.ts:51-81` |
| 邀请创建/批量/重发 | `server/src/routes/admin-history.ts:439-489/523-595/597-630` |
| 简历上传解析 | `server/src/routes/me.ts:635-773` |
| PDF 解析 | `server/src/services/pdf.ts:46-85` |
| AI 提取（30s 超时） | `server/src/services/ai-resume.ts:48-104`、`server/src/config.ts:73-79` |
| 投递 / 自动通过 | `server/src/routes/jobs.ts:149-327` |
| 进组 membership | `server/src/services/org.ts:222-267` |
| 答辩状态机 | `server/src/services/defense.ts:332-429` |
| 席位递补 | `server/src/services/defense.ts:504-590` |
| 评审提交路由 | `server/src/routes/admin.ts:1336-1362` |
| 评审人调整（未持久化） | `server/src/routes/admin.ts:1387-1414` |
| 公示发布回写 | `server/src/routes/admin.ts:1591-1613`、`server/src/services/publicity.ts:176-190` |
| SSO state 创建/清理/消费 | `server/src/routes/auth.ts:198-213/243-261` |
| SSO 限流 | `server/src/routes/auth.ts:60-77/478-487` |
| JWKS 重试 | `server/src/unisso.ts:469-486` |
| 前端 refresh-oa 30s 超时 | `web/src/api/index.ts:950-955` |
| 部署入口（单进程 exec） | `deploy.sh:98-101` |
