# 软工集市 · 招聘平台（join-platform）

招聘投递站：**投递 → 本平台初审 → 通过后自动推送到开发者平台 OA 审批**。

| 入口 | 域名 |
|------|------|
| 招聘站点（前端） | https://join.ssemarket.cn |
| 管理审核页 | https://join.ssemarket.cn/admin（需 `JOIN_ADMIN_TOKEN` 口令） |

## 对接开发者平台

本平台在 **开发者平台（developer.ssemarket.cn）** 注册为一个「模块」。候选人投递后，由管理员在本平台「初审通过」，系统自动调用开发者平台的 **OA 审批接口**（`/api/open/oa/submit` + `/api/open/oa/query`）提交录用申请，审批流转全部在开发者平台内完成：

1. 在开发者平台注册一个模块，拿到注册成功弹窗中一次性下发的 **模块私钥**（`JOIN_DEV_MODULE_PRIVATE_KEY`）。
2. 在开发者平台「模块 API → API 广场」为本模块申请 **`oa` 组权限**（`oa.submit` / `oa.query`），等待管理员批准。
3. 本平台配置好环境变量后，投递初审通过 → 自动带 SM2 签名调用 `/api/open/oa/submit` 提交 `oaid = join-{applicationId}` 的审批单。
4. 管理员在开发者平台「OA 审批」处理单子；本平台管理页可轮询 `/api/open/oa/query` 回填审批状态。

## 技术栈

- 后端：Node + Express + TypeScript（ESM, strict），单 JSON 文件存储（本地 + MinIO 双写），sm-crypto（SM2）
- 前端：Vue 3 + Vue Router + Vite，axios
- 部署：SSE Deploy（sseinfra，K8s 组容器，无 Docker）

## 本地开发

```powershell
cd server
copy .env.example .env   # 填 JOIN_DEV_MODULE_SLUG / PRIVATE_KEY / ADMIN_TOKEN 等
npm install
npm run dev

cd ../web
npm install
npm run dev
```

后端默认 `:8080`，前端 Vite 默认 `:5175`（代理 `/api` → `8080`）。

## 部署（SSE Deploy）

模块名建议 `join-platform`。访问域名：`join.ssemarket.cn`（前端 + API 同源，均反代到本容器 `8080`）。

打包：`powershell -ExecutionPolicy Bypass -File .\deploy\pack-sseinfra.ps1` → 生成 `join-platform-sseinfra.zip`（已预构建 server/web dist，敏感值不落包）。

环境变量见 `server/.env.example`，**敏感项一律由部署平台注入**：

| 变量 | 必填 | 说明 |
|------|------|------|
| `JOIN_DEV_MODULE_SLUG` | ✅ | 本站在开发者平台注册的模块 slug |
| `JOIN_DEV_MODULE_PRIVATE_KEY` | ✅ | 注册模块时一次性下发的模块私钥（64 hex） |
| `JOIN_ADMIN_TOKEN` | ✅ | 管理页口令 |
| `DEVELOPER_API_URL` | 可选 | 开发者平台 Base URL，默认 `https://developer.ssemarket.cn` |
| `PUBLIC_BASE` | 可选 | 站点公网根，默认 `https://join.ssemarket.cn` |
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
      db.ts        # 数据模型（jobs / applications）
      sm2-auth.ts  # SM2 签名（对接开发者平台）
      dev-platform.ts # 开发者平台 OA 调用封装
      middleware.ts # ok/fail / 管理口令
      routes/      # jobs（公开）/ admin（管理）
    .env.example
  web/             # 前端
    src/api        # axios 封装 + 接口定义
    src/views      # HomeView / JobDetailView / AdminView
  deploy.sh
  deploy/pack-sseinfra.ps1
```
