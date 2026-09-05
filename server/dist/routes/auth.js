import { Router } from 'express';
import { config, isMailLoginUsable } from '../config.js';
import { db, now } from '../db.js';
import { ok, fail } from '../middleware.js';
import { sendVerifyCodeMail } from '../services/mail.js';
import { createSessionToken, verifySessionToken } from '../services/session.js';
export const authRouter = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 当前登录用户（解析 Authorization: Bearer <token>） */
export function requireUser(req, res, next) {
    const token = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
        fail(res, 401, '未登录或登录已失效');
        return;
    }
    ;
    req.session = {
        uid: payload.uid,
        email: payload.email,
    };
    next();
}
/** 供路由取当前登录用户 */
export function getSessionUser(req) {
    return (req.session) || null;
}
function mapUser(u) {
    return { id: u.id, email: u.email, name: u.name, is_admin: u.is_admin === 1 };
}
/**
 * 是否为管理员邮箱。
 * 来源有二：部署环境变量 JOIN_ADMIN_EMAILS（静态）+ 站点配置 adminEmails（后台可增删，动态）。
 * 二选一命中即为管理员。
 */
function isAdminEmail(email) {
    const e = email.toLowerCase();
    const envList = (process.env.JOIN_ADMIN_EMAILS || '');
    const dbList = db.getStore().site_config.adminEmails || '';
    const list = `${envList},${dbList}`
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    return list.includes(e);
}
// ===== 发送验证码（仅供管理员邮箱登录） =====
authRouter.post('/code', async (req, res) => {
    if (!config.mail.enabled) {
        fail(res, 400, '邮箱登录未启用');
        return;
    }
    if (!isMailLoginUsable()) {
        fail(res, 500, '邮箱登录未就绪：请配置 SMTP 与 JOIN_SESSION_SECRET');
        return;
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
        fail(res, 400, '邮箱格式不正确');
        return;
    }
    if (!isAdminEmail(email)) {
        fail(res, 403, '该邮箱无后台管理权限');
        return;
    }
    const s = db.getStore();
    // 频率限制：interval 内仅允许一次
    const last = s.verify_codes
        .filter((c) => c.email === email)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    const intervalMs = config.mail.codeResendInterval * 1000;
    if (last && !last.used && Date.parse(last.created_at) + intervalMs > Date.now()) {
        fail(res, 429, `发送过于频繁，请 ${Math.ceil((Date.parse(last.created_at) + intervalMs - Date.now()) / 1000)} 秒后再试`);
        return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const t = now();
    const row = {
        email,
        code,
        expires_at: new Date(Date.now() + config.mail.codeTtlSeconds * 1000).toISOString(),
        used: 0,
        created_at: t,
    };
    await db.insert('verify_codes', row);
    const sent = await sendVerifyCodeMail(email, code);
    ok(res, { sent, email, ttl: config.mail.codeTtlSeconds }, sent ? '验证码已发送' : '验证码已生成（邮件发送未配置）');
});
// ===== 验证码登录（仅管理员白名单邮箱） =====
authRouter.post('/login', async (req, res) => {
    if (!config.mail.enabled) {
        fail(res, 400, '邮箱登录未启用');
        return;
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    if (!EMAIL_RE.test(email)) {
        fail(res, 400, '邮箱格式不正确');
        return;
    }
    if (!/^\d{6}$/.test(code)) {
        fail(res, 400, '验证码格式不正确');
        return;
    }
    if (!isAdminEmail(email)) {
        fail(res, 403, '该邮箱无后台管理权限');
        return;
    }
    const s = db.getStore();
    // 取该邮箱最新一条未使用、未过期的验证码
    const target = s.verify_codes
        .filter((c) => c.email === email && !c.used && Date.parse(c.expires_at) > Date.now())
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    if (!target || target.code !== code) {
        fail(res, 401, '验证码错误或已过期');
        return;
    }
    target.used = 1;
    // 管理员邮箱首次登录自动建号（登录即授予管理权限）
    let user = s.users.find((u) => u.email === email);
    const t = now();
    if (!user) {
        user = {
            id: db.nextId('users'),
            email,
            name: email.split('@')[0],
            is_admin: 1,
            last_login_at: t,
            created_at: t,
        };
        s.users.push(user);
    }
    else {
        user.last_login_at = t;
        user.is_admin = 1;
    }
    await db.persist();
    const token = createSessionToken({ uid: user.id, email: user.email });
    ok(res, { token, user: mapUser(user) }, '登录成功');
});
// ===== 当前用户 =====
authRouter.get('/me', requireUser, (req, res) => {
    const session = getSessionUser(req);
    const user = db.getStore().users.find((u) => u.id === session.uid);
    if (!user) {
        fail(res, 401, '用户不存在');
        return;
    }
    ok(res, mapUser(user));
});
// ===== 退出 =====
authRouter.post('/logout', (_req, res) => {
    // 无状态 token，客户端删除本地 token 即可；此处仅作接口占位
    ok(res, { done: true }, '已退出');
});
// ===== SSE Market SSO（预留） =====
authRouter.get('/sso/authorize', (_req, res) => {
    const c = config.sso;
    if (!c.enabled) {
        fail(res, 400, 'SSO 登录未启用');
        return;
    }
    const url = `${c.baseUrl}/connect?client_id=${c.appId}&redirect_uri=${encodeURIComponent(c.redirectUri)}&response_type=code&scope=${encodeURIComponent(c.scope)}`;
    res.redirect(url);
});
authRouter.get('/sso/callback', async (req, res) => {
    const c = config.sso;
    if (!c.enabled) {
        fail(res, 400, 'SSO 登录未启用');
        return;
    }
    const code = String(req.query.code || '');
    if (!code) {
        fail(res, 400, '缺少授权 code');
        return;
    }
    // TODO(subsequent): 用 appId/appSecret 向 SSE Market 换 token → 拿用户信息 → 建/取本地用户 → 签发会话
    fail(res, 501, 'SSO 回调待接入');
});
