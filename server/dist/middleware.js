import { config } from './config.js';
import { db } from './db.js';
import { verifySessionToken } from './services/session.js';
import { departmentAdminDepartmentsOf, headDepartmentsOf, isResourceReviewer, isStaffUser, isSuperAdminUser, } from './services/org.js';
export function ok(res, data, message = 'ok') {
    res.json({ code: 0, message, data });
}
export function fail(res, status, message) {
    res.status(status).json({ code: status, message });
}
export const SESSION_COOKIE = 'join_session';
/** 解析 Cookie 请求头（不引入 cookie-parser） */
export function parseCookies(header) {
    const out = {};
    if (!header)
        return out;
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i <= 0)
            continue;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        if (!k)
            continue;
        try {
            out[k] = decodeURIComponent(v);
        }
        catch {
            out[k] = v;
        }
    }
    return out;
}
/** 从 Authorization: Bearer 或 HttpOnly Cookie 取会话 token */
export function readSessionToken(req) {
    const bearer = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer)
        return bearer;
    const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    return cookie ? String(cookie) : '';
}
export function getSessionPayload(req) {
    // Bearer 优先；若失效则回退到 HttpOnly Cookie（避免旧的 localStorage token 遮挡 SSO 会话）
    const bearer = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
        const p = verifySessionToken(bearer);
        if (p)
            return p;
    }
    const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    return cookie ? verifySessionToken(String(cookie)) : null;
}
/** 当前登录用户（已失效/不存在返回 null） */
export function getCurrentUser(req) {
    const payload = getSessionPayload(req);
    if (!payload)
        return null;
    return db.getStore().users.find((u) => u.id === payload.uid) || null;
}
function isSecureRequest(req) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    return proto === 'https' || config.publicBase.startsWith('https://');
}
/** 登录成功后写入 HttpOnly 会话 Cookie（7 天，与 token 有效期一致） */
export function setSessionCookie(req, res, token) {
    const parts = [
        `${SESSION_COOKIE}=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${7 * 24 * 3600}`,
    ];
    if (isSecureRequest(req))
        parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
}
export function clearSessionCookie(req, res) {
    const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (isSecureRequest(req))
        parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
}
/** 共享父域 SSO Cookie：值由 UniSSO 签发，服务端只当会话指针使用。
 * 改名过渡（sse_sso→unisso_sid）：新名优先读，清除时新旧名都清。 */
export const SSO_COOKIE = 'unisso_sid';
export const SSO_COOKIE_LEGACY = 'sse_sso';
export const SSO_COOKIE_NAMES = Array.from(new Set([SSO_COOKIE, SSO_COOKIE_LEGACY]));
/** 登录成功后把 unisso 返回的 SSO 会话种到父域（可与会话 Cookie 并存） */
export function setSsoCookie(res, value, meta = {}) {
    const name = meta.name || SSO_COOKIE;
    const domain = meta.domain || '.ssemarket.cn';
    const maxAge = Number(meta.maxAge) > 0 ? Number(meta.maxAge) : 604800;
    res.append('Set-Cookie', `${name}=${value}; Domain=${domain}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`);
}
/** 清父域 SSO Cookie（登出 / 会话失效）；改名过渡：新旧名都清 */
export function clearSsoCookie(res, meta = {}) {
    const domain = meta.domain || '.ssemarket.cn';
    const names = meta.name ? Array.from(new Set([meta.name, ...SSO_COOKIE_NAMES])) : SSO_COOKIE_NAMES;
    for (const name of names) {
        res.append('Set-Cookie', `${name}=; Domain=${domain}; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    }
}
/** 改名过渡双读：unisso_sid 优先，sse_sso 兜底 */
export function readSsoSession(req) {
    const cookies = parseCookies(req.headers.cookie);
    for (const name of SSO_COOKIE_NAMES) {
        const v = String(cookies[name] || '').trim();
        if (v)
            return v;
    }
    return '';
}
/** 超级管理员 UniSSO sub 白名单：部署环境变量 JOIN_ADMIN_SUBS + 站点配置 adminSubs */
export function adminSubsList() {
    const envList = config.adminSubs || '';
    const dbList = db.getStore().site_config.adminSubs || '';
    return `${envList},${dbList}`
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
export function isAdminSub(sub) {
    const s = (sub || '').trim();
    if (!s)
        return false;
    return adminSubsList().includes(s);
}
export function parseEmailList(raw) {
    return String(raw || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}
/** 该邮箱负责的部门（部门管理员；兼容旧数据） */
export function departmentAdminDepartments(email) {
    const e = (email || '').trim().toLowerCase();
    if (!e)
        return [];
    return db
        .getStore()
        .departments.filter((d) => parseEmailList(d.admin_emails).includes(e))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}
/** 是否为某个部门的管理员（旧邮箱语义） */
export function isDepartmentAdmin(email) {
    return departmentAdminDepartments(email).length > 0;
}
/** 解析当前请求的后台权限范围 */
export function getAdminContext(req) {
    const user = getCurrentUser(req);
    const global = user ? isSuperAdminUser(user) : false;
    const departments = global
        ? [...db.getStore().departments].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        : user
            ? departmentAdminDepartmentsOf(user)
            : [];
    return {
        user,
        global,
        resourceReviewer: Boolean(user && isResourceReviewer(user)),
        headDepartments: user ? headDepartmentsOf(user.id) : [],
        departments,
        departmentIds: departments.map((d) => d.id),
    };
}
/** 需要登录的接口 */
export function requireUser(req, res, next) {
    const user = getCurrentUser(req);
    if (!user) {
        fail(res, 401, '未登录或登录已失效');
        return;
    }
    ;
    req.session = { uid: user.id, email: user.email };
    req.user = user;
    next();
}
/**
 * 后台入口鉴权：超级管理员或部门管理员均可进入；
 * 具体能操作哪些部门由 getAdminContext() 决定。
 */
export function requireStaff(req, res, next) {
    const ctx = getAdminContext(req);
    if (!ctx.user) {
        fail(res, 403, '无管理权限');
        return;
    }
    if (!isStaffUser(ctx.user) && !isAdminSub(ctx.user.sso_sub)) {
        fail(res, 403, '无后台管理权限');
        return;
    }
    ;
    req.session = {
        uid: ctx.user.id,
        email: ctx.user.email,
    };
    req.user = ctx.user;
    next();
}
/** 仅超级管理员（部门 CRUD、部门管理员设置、站点配置、问答管理） */
export function requireGlobalAdmin(req, res, next) {
    const ctx = getAdminContext(req);
    if (!ctx.global) {
        fail(res, 403, '仅超级管理员可执行此操作');
        return;
    }
    if (ctx.user) {
        ;
        req.session = {
            uid: ctx.user.id,
            email: ctx.user.email,
        };
        req.user = ctx.user;
    }
    next();
}
/** 兼容旧引用 */
export const requireAdmin = requireGlobalAdmin;
