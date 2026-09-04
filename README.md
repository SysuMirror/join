# 软工集市 · 招聘平台（join-platform）

招聘投递站：**投递 → 本平台初审 → 通过后自动推送到开发者平台 OA 审批**。

| 入口 | 域名 |
|------|------|
| 招聘站点（前端） | https://join.ssemarket.cn |
| 登录页 | https://join.ssemarket.cn/login（邮箱验证码登录，预留 SSE Market SSO） |
| 管理审核页 | https://join.ssemarket.cn/admin（需登录白名单管理员邮箱，见 `JOIN_ADMIN_EMAILS`） |

## 登录 / 认证

- **邮箱验证码登录**（默认开启）：输入邮箱 → `POST /api/auth/code` 发 6 位验证码至邮箱 → `POST /api/auth/login` 换取会话 token（HMAC 签名，7 天有效）。
- 管理端鉴权：登录用户需在 `JOIN_ADMIN_EMAILS`（逗号分隔白名单）中，才可进入 `/admin` 审核页；`/api/admin/*` 全部走 Bearer 会话 token。
- **SSE Market SSO（预留）**：`JOIN_SSO_ENABLED=true` + 配置 `SSEAPI_OAUTH_*` 后，`/api/auth/sso/authorize` 跳转集市账号登录，`/api/auth/sso/callback` 待接入（当前返回 501）。现在默认走邮箱验证码。

## 对接开发者平台

本平台在 **开发者平台（developer.ssemarket.cn）** 注册为一个「模块」。候选人投递后，由管理员在本平台「初审通过」，系统自动调用开发者平台的 **OA 审批接口**（`/api/open/oa/submit` + `/api/open/oa/query`）提交录用申请，审批流转全部在开发者平台内完成：

1. 在开发者平台注册一个模块，拿到注册成功弹窗中一次性下发的 **模块私钥**（`JOIN_DEV_MODULE_PRIVATE_KEY`）。
2. 在开发者平台「模块 API → API 广场」为本模块申请 **`oa` 组权限**（`oa.submit` / `oa.query`），等待管理员批准。
3. 本平台配置好环境变量后，投递初审通过 → 自动带 SM2 签名调用 `/api/open/oa/submit` 提交 `oaid = join-{applicationId}` 的审批单。
4. 管理员在开发者平台「OA 审批」处理单子；本平台管理页可轮询 `/api/open/oa/query` 回填审批状态。

## 技术栈

- 后端：Node + Express + TypeScript（ESM, strict），单 JSON 文件存储（本地 + MinIO 双写），sm-crypto（SM2），nodemailer（SMTP 发信）
- 前端：Vue 3 + Vue Router + Vite，axios
- 部署：SSE Deploy（sseinfra，K8s 组容器，无 Docker）

## 本地开发

```powershell
cd server
copy .env.example .env   # 填 JOIN_DEV_MODULE_SLUG / PRIVATE_KEY / JOIN_SESSION_SECRET / SMTP_HOST 等
npm install
npm run dev

cd ../web
npm install
npm run dev
```

后端默认 `:8080`，前端 Vite 默认 `:5175`（代理 `/api` → `8080`）。

> 本地无 SMTP 时，可设 `JOIN_MAIL_DEBUG=true`，未配置 SMTP 时验证码会回显到服务端日志，便于联调登录链路（生产请关闭并配置 SMTP）。

## 部署（SSE Deploy）

模块名建议 `join-platform`。访问域名：`join.ssemarket.cn`（前端 + API 同源，均反代到本容器 `8080`）。

打包：`powershell -ExecutionPolicy Bypass -File .\deploy\pack-sseinfra.ps1` → 生成 `join-platform-sseinfra.zip`（已预构建 server/web dist，敏感值不落包）。

环境变量见 `server/.env.example`，**敏感项一律由部署平台注入**：

| 变量 | 必填 | 说明 |
|------|------|------|
| `JOIN_DEV_MODULE_SLUG` | ✅ | 本站在开发者平台注册的模块 slug |
| `JOIN_DEV_MODULE_PRIVATE_KEY` | ✅ | 注册模块时一次性下发的模块私钥（64 hex） |
| `JOIN_SESSION_SECRET` | ✅ | 登录会话签名密钥（随机长字符串） |
| `JOIN_ADMIN_EMAILS` | ✅ | 管理端白名单邮箱（逗号分隔） |
| `SMTP_HOST/PORT/USER/PASS/FROM` | ✅（收验证码必需） | 发信 SMTP 配置（支持 `SMTP_ADDR`、`SMTP_EMAIL_*` 风格） |
| `JOIN_MAIL_LOGIN` | 可选 | 是否启用邮箱登录，默认 `true` |
| `JOIN_ADMIN_TOKEN` | 可选 | 兼容旧式管理口令（备选） |
| `DEVELOPER_API_URL` | 可选 | 开发者平台 Base URL，默认 `https://developer.ssemarket.cn` |
| `PUBLIC_BASE` | 可选 | 站点公网根，默认 `https://join.ssemarket.cn` |
| `JOIN_SSO_ENABLED` / `SSEAPI_OAUTH_*` | 可选 | SSE Market SSO（预留，未启用） |
| `MINIO_ENDPOINT/ACCESS_KEY/SECRET/BUCKET` | 可选 | 四项全配启用 MinIO 存储 |

缺必填项时 `deploy.sh` 与服务启动双重 fail-fast 报错退出。

## 目录结构

```text
join-platform/
  server/          # 后端
    src/
      config.ts    # 环境变量集中加载
      load-env.ts  # .env 轻量加载（不覆盖已有 env）
      storage.ts   # 本地 JSON + MinIO 双写
      db.ts        # 数据模型（jobs / applications / users / verify_codes）
      sm2-auth.ts  # SM2 签名（对接开发者平台）
      dev-platform.ts # 开发者平台 OA 调用封装
      middleware.ts # ok/fail / 管理鉴权
      services/
        mail.ts    # SMTP 发信（验证码）
        session.ts # HMAC 会话 token
      routes/      # jobs（公开）/ admin（管理）/ auth（登录）
    .env.example
  web/             # 前端
    src/api        # axios 封装 + 接口定义
    src/views      # HomeView / JobDetailView / AdminView / LoginView
  deploy.sh
  deploy/pack-sseinfra.ps1
```
