import fs from 'node:fs'
import path from 'node:path'
import { loadEnvFile } from './load-env.js'

// 在 config 求值前加载 .env（ESM import 会先提升，故必须在 config.ts 顶层前置加载，
// 保证 config 对象读到的是合并了 .env 的 process.env）
loadEnvFile()

function env(key: string, fallback = ''): string {
  return (process.env[key] ?? fallback).trim()
}

const dataDir =
  env('DATA_DIR') || env('JOIN_DATA_DIR') || path.join(process.cwd(), 'data')
fs.mkdirSync(dataDir, { recursive: true })

const publicBase = (env('PUBLIC_BASE') || env('JOIN_PUBLIC_URL', 'http://localhost:8080')).replace(
  /\/$/,
  '',
)

export const config = {
  port: Number(env('PORT', '8080')),
  dataDir,
  /** 站点对外公网根（前端访问 / 邮件回跳 / OAuth redirect_uri 等场景用） */
  publicBase,
  frontendDist: env('JOIN_FRONTEND_DIST') || path.join(process.cwd(), '../web/dist'),

  /** 简历附件等用户上传文件（落在持久化盘，随 DATA_DIR 一起） */
  uploads: {
    maxResumeBytes:
      Math.max(1, Number(env('JOIN_RESUME_MAX_MB', '10')) || 10) * 1024 * 1024,
    /** PDF 最多解析页数，避免超长文档拖垮进程 */
    maxPdfPages: Math.max(1, Number(env('JOIN_PDF_MAX_PAGES', '30')) || 30),
  },

  /**
   * 对接开发者平台的「模块」身份（用于调用 /api/open/* 的 SM2 签名）。
   * 私钥 = 在开发者平台注册模块时一次性下发的模块私钥；platform 公钥根 = developer.ssemarket.cn。
   * 必须通过环境变量注入，不作为默认值落包。
   */
  devPlatform: {
    /** 开发者平台 Base URL，默认主域 */
    baseUrl: env('DEVELOPER_API_URL', 'https://developer.ssemarket.cn').replace(/\/$/, ''),
    /** 本站在开发者平台注册的模块 slug（模块认证第一段，签名串成员） */
    moduleSlug: env('JOIN_DEV_MODULE_SLUG'),
    /** 模块私钥（sm-crypto 64 hex；开发者平台注册模块时一次性下发，此后不落库） */
    modulePrivateKey: env('JOIN_DEV_MODULE_PRIVATE_KEY'),
  },

  /**
   * UniSSO（OAuth2 Authorization Code + PKCE S256 / OIDC）。
   * 注册应用后由部署平台注入 UNISSO_CLIENT_ID / UNISSO_CLIENT_SECRET。
   * redirect_uri 必须与 UniSSO 应用管理里登记的完全一致。
   */
  unisso: {
    issuer: (env('UNISSO_ISSUER', 'https://sso.ssemarket.cn') || 'https://sso.ssemarket.cn').replace(
      /\/$/,
      '',
    ),
    clientId: env('UNISSO_CLIENT_ID') || env('SSEAPI_OAUTH_APP_ID'),
    clientSecret: env('UNISSO_CLIENT_SECRET') || env('SSEAPI_OAUTH_APP_SECRET'),
    redirectUri:
      env('UNISSO_REDIRECT_URI') || `${publicBase}/api/auth/sso/callback`,
    scopes: env('UNISSO_SCOPES', 'openid profile email') || 'openid profile email',
    /** 登录成功后跳转的前端默认路径 */
    defaultReturnTo: env('UNISSO_DEFAULT_RETURN_TO', '/me'),
  },

  /** 登录会话签名密钥（由部署平台注入的随机长字符串） */
  sessionSecret: env('JOIN_SESSION_SECRET'),

  /** 超级管理员 UniSSO sub 白名单（逗号分隔；站点配置 adminSubs 会合并进来） */
  adminSubs: env('JOIN_ADMIN_SUBS'),
}

/** UniSSO 是否已配置（缺 client_id / client_secret 时登录页会提示未启用） */
export function isUnissoConfigured(): boolean {
  return Boolean(config.unisso.clientId && config.unisso.clientSecret)
}

/** 用于 fail-fast 启动校验 */
export function isDevPlatformConfigured(): boolean {
  return Boolean(config.devPlatform.moduleSlug && config.devPlatform.modulePrivateKey)
}
