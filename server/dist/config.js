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
const publicBase = (env('PUBLIC_BASE') || env('JOIN_PUBLIC_URL', 'http://localhost:8080')).replace(/\/$/, '');
export const config = {
    port: Number(env('PORT', '8080')),
    dataDir,
    /** 站点对外公网根（前端访问 / 邮件回跳 / OAuth redirect_uri 等场景用） */
    publicBase,
    frontendDist: env('JOIN_FRONTEND_DIST') || path.join(process.cwd(), '../web/dist'),
    /** 简历附件等用户上传文件（落在持久化盘，随 DATA_DIR 一起） */
    uploads: {
        maxResumeBytes: Math.max(1, Number(env('JOIN_RESUME_MAX_MB', '10')) || 10) * 1024 * 1024,
        /** PDF 最多解析页数，避免超长文档拖垮进程 */
        maxPdfPages: Math.max(1, Number(env('JOIN_PDF_MAX_PAGES', '30')) || 30),
    },
    /**
     * 新版开发者平台（SysuMirror/developer）的 join 接入。
     * join 用共享密钥直接调用其对外的 /api/join/*；不再使用旧的 SM2 模块认证与 OA 审批。
     * 密钥必须通过环境变量注入，不作为默认值落包。
     */
    devPlatform: {
        /** 开发者平台 Base URL，默认主域 */
        baseUrl: env('DEVELOPER_API_URL', 'https://developer.ssemarket.cn').replace(/\/$/, ''),
        /** 共享密钥，与开发者平台侧的 JOIN_API_KEY 一致；留空时 /api/developer/* 返回 503 */
        joinApiKey: env('JOIN_API_KEY'),
        /** 简历外链签名密钥；未单独配置时复用登录会话密钥 */
        resumeLinkSecret: env('JOIN_RESUME_LINK_SECRET') || env('JOIN_SESSION_SECRET'),
        /** 简历外链有效期（天） */
        resumeLinkDays: Math.max(1, Number(env('JOIN_RESUME_LINK_DAYS', '90')) || 90),
    },
    /**
     * UniSSO（OAuth2 Authorization Code + PKCE S256 / OIDC）。
     * 注册应用后由部署平台注入 UNISSO_CLIENT_ID / UNISSO_CLIENT_SECRET。
     * redirect_uri 必须与 UniSSO 应用管理里登记的完全一致。
     */
    unisso: {
        issuer: (env('UNISSO_ISSUER', 'https://sso.ssemarket.cn') || 'https://sso.ssemarket.cn').replace(/\/$/, ''),
        clientId: env('UNISSO_CLIENT_ID') || env('SSEAPI_OAUTH_APP_ID'),
        clientSecret: env('UNISSO_CLIENT_SECRET') || env('SSEAPI_OAUTH_APP_SECRET'),
        redirectUri: env('UNISSO_REDIRECT_URI') || `${publicBase}/api/auth/sso/callback`,
        scopes: env('UNISSO_SCOPES', 'openid profile email') || 'openid profile email',
        /** 登录成功后跳转的前端默认路径 */
        defaultReturnTo: env('UNISSO_DEFAULT_RETURN_TO', '/me'),
    },
    /** 登录会话签名密钥（由部署平台注入的随机长字符串） */
    sessionSecret: env('JOIN_SESSION_SECRET'),
    /** AI 简历解析（OpenAI 兼容 chat/completions） */
    ai: {
        url: env('JOIN_AI_API_URL', 'https://api.ssemarket.cn/v1/chat/completions'),
        apiKey: env('JOIN_AI_API_KEY'),
        model: env('JOIN_AI_MODEL', 'qwen-3.8-flash'),
        timeoutMs: Math.max(3000, Number(env('JOIN_AI_TIMEOUT_MS', '30000')) || 30_000),
    },
    /** 超级管理员 UniSSO sub 白名单（逗号分隔；站点配置 adminSubs 会合并进来） */
    adminSubs: env('JOIN_ADMIN_SUBS'),
};
/** UniSSO 是否已配置（缺 client_id / client_secret 时登录页会提示未启用） */
export function isUnissoConfigured() {
    return Boolean(config.unisso.clientId && config.unisso.clientSecret);
}
/** AI 简历解析是否已配置 */
export function isAiConfigured() {
    return Boolean(config.ai.url && config.ai.apiKey);
}
/** 开发者平台 join 接入是否已配置（缺共享密钥时相关接口返回 503） */
export function isDevPlatformConfigured() {
    return Boolean(config.devPlatform.baseUrl && config.devPlatform.joinApiKey);
}
