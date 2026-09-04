import fs from 'node:fs'
import path from 'node:path'

function env(key: string, fallback = ''): string {
  return (process.env[key] ?? fallback).trim()
}

const dataDir =
  env('DATA_DIR') || env('JOIN_DATA_DIR') || path.join(process.cwd(), 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const config = {
  port: Number(env('PORT', '8080')),
  dataDir,
  /** 站点对外公网根（前端访问 / 回调等场景用） */
  publicBase: env('PUBLIC_BASE') || env('JOIN_PUBLIC_URL', 'http://localhost:8080').replace(/\/$/, ''),
  frontendDist: env('JOIN_FRONTEND_DIST') || path.join(process.cwd(), '../web/dist'),

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
    /** 平台管理员查看录用单在开发者平台 OA 中流转，审批由平台侧管理员执行 */
  },

  /** 管理端访问口令（非强安全；管理页靠查询口令限制，生产建议置于平台反代之后） */
  adminToken: env('JOIN_ADMIN_TOKEN'),

  /** 面试/录用通知发件邮箱显示信息（可选；本版不强依赖 SMTP） */
  contactEmail: env('JOIN_CONTACT_EMAIL', 'hr@ssemarket.cn'),
}

/** 用于 fail-fast 启动校验 */
export function isDevPlatformConfigured(): boolean {
  return Boolean(config.devPlatform.moduleSlug && config.devPlatform.modulePrivateKey)
}

export function isAdminConfigured(): boolean {
  return Boolean(config.adminToken)
}
