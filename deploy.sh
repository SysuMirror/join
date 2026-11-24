#!/usr/bin/env bash
# sseinfra 部署入口：监听 0.0.0.0:$PORT，前台常驻
set -euo pipefail

PORT="${PORT:-8080}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

DATA_DIR="${JOIN_DATA_DIR:-${DATA_DIR:-$ROOT/data}}"
mkdir -p "$DATA_DIR"
export DATA_DIR
export PORT

# 构建阶段禁止 production，否则 npm 跳过 devDependencies（tsc/vite）
# 若平台注入了 NODE_ENV=production，这里先清掉
unset NODE_ENV || true

# 站点对外公网根（正文链接等）
export PUBLIC_BASE="${PUBLIC_BASE:-${JOIN_PUBLIC_URL:-https://join.ssemarket.cn}}"

# 临时：新版开发者平台先行指向 dev 环境，正式域名切换后删除本段
# （supervisor 注入的是旧域名，这里显式覆盖；平台注入 JOIN_DEVELOPER_API_URL 时以它为准）
export DEVELOPER_API_URL="${JOIN_DEVELOPER_API_URL:-https://ssemarket.cn:23063}"

echo "[deploy] PORT=$PORT DATA_DIR=$DATA_DIR"
echo "[deploy] PUBLIC_BASE=$PUBLIC_BASE (join platform)"
echo "[deploy] DEVELOPER_API_URL=$DEVELOPER_API_URL"

# 敏感值（JOIN_SESSION_SECRET 等）一律由部署平台注入，
# 不在代码/包内提供默认值，避免密钥落仓库。
for v in JOIN_SESSION_SECRET; do
  if [ -z "${!v:-}" ]; then
    echo "[deploy] FATAL: $v 未注入（请在部署平台环境变量中配置）" >&2
    exit 1
  fi
done
export JOIN_SESSION_SECRET

# 开发者平台 join 接入：未注入时网站照常启动，只是 /api/developer/* 返回 503。
# 根目录 .env 会在 node 启动时由 load-env 读取，这里一并检查，避免误报。
if [ -z "${JOIN_API_KEY:-}" ] && ! grep -q '^JOIN_API_KEY=.' "$ROOT/.env" 2>/dev/null; then
  echo "[deploy] WARN: JOIN_API_KEY 未注入，开发者平台项目申请暂不可用" >&2
fi

# 若包内有 server/.env，补缺（不覆盖已 export / 平台注入的键）
if [ -f "$ROOT/server/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/server/.env" || true
  set +a
fi

npm_ci_or_install() {
  # 强制带上 devDependencies，避免 NODE_ENV/omit=dev 干扰
  if [ -f package-lock.json ]; then
    npm ci --include=dev
  else
    npm install --include=dev
  fi
}

# —— server ——
if [ -f server/package.json ]; then
  if [ ! -f server/dist/index.js ]; then
    echo "[deploy] building server (dist missing)…"
    cd server
    npm_ci_or_install
    npm run build
    cd "$ROOT"
  else
    echo "[deploy] server/dist 已存在，跳过 tsc；仅安装生产依赖"
    cd server
    npm ci --omit=dev 2>/dev/null || npm install --omit=dev
    cd "$ROOT"
  fi
  if [ ! -f server/dist/index.js ]; then
    echo "[deploy] FATAL: server/dist/index.js 不存在（tsc 未产出）。请检查 zip 是否含 server/src" >&2
    ls -la server/src 2>&1 | head -20 >&2 || true
    ls -la server/dist 2>&1 | head -20 >&2 || true
    exit 1
  fi
  echo "[deploy] server OK: server/dist/index.js"
fi

# —— web ——
if [ -f web/package.json ]; then
  export VITE_BASE_PATH="/"
  export VITE_API_BASE=""
  if [ ! -f web/dist/index.html ]; then
    echo "[deploy] building web…"
    cd web
    npm_ci_or_install
    npm run build
    cd "$ROOT"
  else
    echo "[deploy] web/dist 已存在，跳过 vite build"
  fi
  if [ ! -f web/dist/index.html ]; then
    echo "[deploy] FATAL: web/dist/index.html 不存在" >&2
    exit 1
  fi
  echo "[deploy] web OK: web/dist/index.html"
fi

export JOIN_FRONTEND_DIST="${JOIN_FRONTEND_DIST:-$ROOT/web/dist}"

export NODE_ENV=production
cd server
echo "[deploy] starting node dist/index.js"
exec node dist/index.js
