import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from './load-env.js';
// 在 config 求值前加载 .env（ESM import 会先提升，故必须在 config.ts 顶层前置加载，
// 保证 config 对象读到的是合并了 .env 的 process.env）
loadEnvFile();
function env(key, fallback = '') {
    return (process.env[key] ?? fallback).trim();
}
const dataDir = env('DATA_DIR') || env('JOIN_DATA_DIR') || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
export const config = {
    port: Number(env('PORT', '8080')),
    dataDir,
    /** 站点对外公网根（前端访问 / 邮件回跳 / 回调等场景用） */
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
    /**
     * 邮箱登录（验证码式）。
     * 当前版实现「邮箱验证码登录」，并预留后续跳转 SSE Market SSO。
     * SMTP 配置由部署平台环境变量注入（兼容 SMTP_ADDR / SMTP_HOST 两种风格），未配置时验证码不走邮箱。
     */
    mail: {
        /** 用户是否允许用邮箱验证码登录；设为 false 则仅留 SSO 入口 */
        enabled: env('JOIN_MAIL_LOGIN', 'true') === 'true',
        /** 验证码有效期（秒） */
        codeTtlSeconds: Number(env('JOIN_MAIL_CODE_TTL', '300')),
        /** 同一邮箱发码最小间隔（秒），防轰炸 */
        codeResendInterval: Number(env('JOIN_MAIL_CODE_RESEND', '60')),
    },
    /**
     * SSE Market SSO（预留：后续跳转登录）。
     * 现在未启用；届时配置 SSEAPI_OAUTH_* 并在 auth.ts 里实现 callback 即可。
     */
    sso: {
        enabled: env('JOIN_SSO_ENABLED', 'false') === 'true',
        baseUrl: env('SSEAPI_OAUTH_BASE_URL', 'https://ssemarket.cn/new').replace(/\/$/, ''),
        apiBaseUrl: env('SSEAPI_OAUTH_API_BASE_URL', 'https://ssemarket.cn').replace(/\/$/, ''),
        appId: env('SSEAPI_OAUTH_APP_ID', 'sse-join'),
        appSecret: env('SSEAPI_OAUTH_APP_SECRET'),
        redirectUri: env('SSEAPI_OAUTH_REDIRECT_URI') || `${env('PUBLIC_BASE') || 'http://localhost:8080'}/auth/sso/callback`,
        scope: env('SSEAPI_OAUTH_SCOPE', 'read_basic'),
    },
    /** 登录会话 JWT 密钥（由部署平台注入的随机长字符串） */
    sessionSecret: env('JOIN_SESSION_SECRET'),
    /** 管理端访问口令（无 SMTP/邮箱登录时的备选；管理页审核入口） */
    adminToken: env('JOIN_ADMIN_TOKEN'),
};
/** 用于 fail-fast 启动校验 */
export function isDevPlatformConfigured() {
    return Boolean(config.devPlatform.moduleSlug && config.devPlatform.modulePrivateKey);
}
/** 邮箱登录是否可用（开启且配置了 SMTP 才能收到验证码；JOIN_MAIL_DEBUG=true 时本地联调允许无 SMTP） */
export function isMailLoginUsable() {
    if (!config.mail.enabled)
        return false;
    if (!config.sessionSecret)
        return false;
    if (process.env.JOIN_MAIL_DEBUG === 'true')
        return true;
    return Boolean(process.env.SMTP_HOST || process.env.SMTP_ADDR);
}
export function isAdminConfigured() {
    return Boolean(config.adminToken);
}
