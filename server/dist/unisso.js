import crypto from 'node:crypto';
import { config } from './config.js';
function fallbackDiscovery() {
    const issuer = config.unisso.issuer;
    return {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/api/oauth/token`,
        userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
    };
}
let discoveryCache = null;
function fetchWithTimeout(url, ms, init = {}) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
/** 读取 OIDC discovery（缓存 1 小时；失败时回退到已知端点） */
export async function getDiscovery() {
    const ttl = 3600_000;
    if (discoveryCache && Date.now() - discoveryCache.at < ttl)
        return discoveryCache.data;
    const fallback = fallbackDiscovery();
    try {
        const res = await fetchWithTimeout(`${config.unisso.issuer}/.well-known/openid-configuration`, 8000, { headers: { accept: 'application/json' } });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const j = (await res.json());
        const data = {
            issuer: j.issuer || fallback.issuer,
            authorization_endpoint: j.authorization_endpoint || fallback.authorization_endpoint,
            token_endpoint: j.token_endpoint || fallback.token_endpoint,
            userinfo_endpoint: j.userinfo_endpoint || fallback.userinfo_endpoint,
            jwks_uri: j.jwks_uri || fallback.jwks_uri,
        };
        discoveryCache = { at: Date.now(), data };
        return data;
    }
    catch (e) {
        console.warn(`[unisso] discovery 获取失败，使用内置端点：${e instanceof Error ? e.message : e}`);
        // 失败也短暂缓存，避免每次登录都等待超时
        discoveryCache = { at: Date.now() - ttl + 60_000, data: fallback };
        return fallback;
    }
}
/** 生成 PKCE verifier / S256 challenge */
export function createPkcePair() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}
export function createState() {
    return crypto.randomBytes(24).toString('base64url');
}
/** 构造授权跳转地址 */
export async function buildAuthorizeUrl(params) {
    const d = await getDiscovery();
    const url = new URL(d.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.unisso.clientId);
    url.searchParams.set('redirect_uri', config.unisso.redirectUri);
    url.searchParams.set('scope', params.scope || config.unisso.scopes);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
}
/** 用授权码换 token（服务端调用，携带 client_secret + code_verifier） */
export async function exchangeCode(code, codeVerifier) {
    const d = await getDiscovery();
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.unisso.redirectUri,
        client_id: config.unisso.clientId,
        client_secret: config.unisso.clientSecret,
        code_verifier: codeVerifier,
    });
    const res = await fetchWithTimeout(d.token_endpoint, 12_000, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
        },
        body,
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    }
    catch {
        throw new Error(`UniSSO token 接口返回非 JSON（HTTP ${res.status}）`);
    }
    if (!res.ok || json.error) {
        throw new Error(`UniSSO 授权码交换失败：${json.error_description || json.error || `HTTP ${res.status}`}`);
    }
    if (!json.access_token)
        throw new Error('UniSSO 未返回 access_token');
    return json;
}
/** 用 access token 拉取用户信息 */
export async function fetchUserInfo(accessToken) {
    const d = await getDiscovery();
    const res = await fetchWithTimeout(d.userinfo_endpoint, 10_000, {
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });
    if (!res.ok)
        throw new Error(`UniSSO 用户信息获取失败：HTTP ${res.status}`);
    const body = (await res.json());
    // 兼容 { code: 0, data: {...} } 包装
    const data = body && typeof body === 'object' && 'data' in body && body.data && typeof body.data === 'object'
        ? body.data
        : body;
    return data;
}
export function unissoUserIsActive(user) {
    const v = user.active;
    if (v === undefined || v === null)
        return true;
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'number')
        return v !== 0;
    return !['0', 'false', 'inactive', 'disabled'].includes(String(v).toLowerCase());
}
let usersListCache = null;
/**
 * 查询 UniSSO 全部用户（M2M，/api/oauth/users/list）。
 * 管理员邀请场景使用：即使对方还没在本平台注册，也能查到并邀请。
 * 缓存 60 秒，避免后台搜索反复打 SSO。
 */
export async function listUnissoUsers(force = false) {
    const ttl = 60_000;
    if (!force && usersListCache && Date.now() - usersListCache.at < ttl) {
        return usersListCache.users;
    }
    const res = await fetchWithTimeout(`${config.unisso.issuer}/api/oauth/users/list`, 15_000, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            client_id: config.unisso.clientId,
            client_secret: config.unisso.clientSecret,
        }),
    });
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    }
    catch {
        throw new Error(`UniSSO 用户目录返回非 JSON（HTTP ${res.status}）`);
    }
    if (!res.ok || body.ok === false) {
        const msg = String(body.message || body.error_description || body.error || '').trim() ||
            `HTTP ${res.status}`;
        throw new Error(`UniSSO 用户目录查询失败：${msg}`);
    }
    const raw = Array.isArray(body.users)
        ? body.users
        : body.data && typeof body.data === 'object' && Array.isArray(body.data.users)
            ? body.data.users
            : [];
    const users = raw.filter((x) => Boolean(x && typeof x === 'object'));
    usersListCache = { at: Date.now(), users };
    return users;
}
/**
 * 机器对机器密码校验（无感登录）：POST /api/oauth/password/verify。
 * 成功返回 { ok:true, user:{sub,internal,...} }；401 invalid_credentials；429 限频（调用方勿自动重试）。
 */
export async function verifyPassword(email, password) {
    const res = await fetchWithTimeout(`${config.unisso.issuer}/api/oauth/password/verify`, 12_000, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
        },
        body: new URLSearchParams({
            email,
            password,
            client_id: config.unisso.clientId,
            client_secret: config.unisso.clientSecret,
        }),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    }
    catch {
        throw new Error(`UniSSO 密码校验接口返回非 JSON（HTTP ${res.status}）`);
    }
    return { ...json, status: res.status };
}
/**
 * 开通 / 撤销 UniSSO 开发者权限（后端 M2M，不需要用户登录态）：
 * POST /api/oauth/developer/update
 * 幂等：重复提交同一值不会出错。
 */
export async function updateUnissoDeveloper(email, isDeveloper = true) {
    const target = String(email || '').trim().toLowerCase();
    if (!target) {
        return { ok: false, status: 400, error: 'invalid_request', message: '缺少邮箱，无法开通开发者权限' };
    }
    if (!config.unisso.clientId || !config.unisso.clientSecret) {
        return {
            ok: false,
            status: 503,
            error: 'not_configured',
            message: 'UniSSO 未配置，无法开通开发者权限',
        };
    }
    const res = await fetchWithTimeout(`${config.unisso.issuer}/api/oauth/developer/update`, 12_000, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            client_id: config.unisso.clientId,
            client_secret: config.unisso.clientSecret,
            email: target,
            is_developer: isDeveloper,
        }),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    }
    catch {
        return {
            ok: false,
            status: res.status,
            error: 'invalid_response',
            message: `UniSSO 开发者接口返回非 JSON（HTTP ${res.status}）`,
        };
    }
    return { ...json, status: res.status };
}
/**
 * 共享父域 SSO 会话校验：POST /api/oauth/session/verify。
 * Cookie 值不可信，只当会话指针；身份以本接口返回为准。
 */
export async function verifySession(session) {
    const res = await fetchWithTimeout(`${config.unisso.issuer}/api/oauth/session/verify`, 12_000, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
        },
        body: new URLSearchParams({
            session,
            client_id: config.unisso.clientId,
            client_secret: config.unisso.clientSecret,
        }),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    }
    catch {
        return {
            ok: false,
            status: res.status,
            message: `UniSSO 会话校验接口返回非 JSON（HTTP ${res.status}）`,
        };
    }
    return { ...json, status: res.status };
}
/** 单点登出：吊销父域 SSO 会话（best-effort，失败不影响本地登出） */
export async function revokeSession(session) {
    try {
        await fetchWithTimeout(`${config.unisso.issuer}/api/oauth/session/revoke`, 5_000, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                accept: 'application/json',
            },
            body: new URLSearchParams({
                session,
                client_id: config.unisso.clientId,
                client_secret: config.unisso.clientSecret,
            }),
        });
    }
    catch {
        /* 网络失败也照常清本地会话与 Cookie */
    }
}
/** JWKS 获取失败（网络/HTTP/空集合），与签名校验失败区分开 */
export class JwksError extends Error {
    constructor(message) {
        super(message);
        this.name = 'JwksError';
    }
}
let jwksCache = null;
async function fetchJwksOnce(d) {
    try {
        const res = await fetchWithTimeout(d.jwks_uri, 6000, {
            headers: { accept: 'application/json' },
        });
        if (!res.ok)
            throw new JwksError(`JWKS 获取失败：HTTP ${res.status}`);
        const body = (await res.json());
        const keys = Array.isArray(body.keys) ? body.keys : [];
        if (!keys.length)
            throw new JwksError('JWKS 为空');
        return keys;
    }
    catch (e) {
        if (e instanceof JwksError)
            throw e;
        throw new JwksError(`JWKS 获取失败：${e instanceof Error ? e.message : '网络错误'}`);
    }
}
async function getJwks(force = false) {
    const ttl = 3600_000;
    if (!force && jwksCache && Date.now() - jwksCache.at < ttl)
        return jwksCache.keys;
    const d = await getDiscovery();
    let lastErr;
    // 503/网络抖动时快速重试一次
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const keys = await fetchJwksOnce(d);
            jwksCache = { at: Date.now(), keys };
            return keys;
        }
        catch (e) {
            lastErr = e;
            if (attempt === 0)
                await new Promise((r) => setTimeout(r, 300));
        }
    }
    throw lastErr instanceof Error ? lastErr : new JwksError('JWKS 获取失败');
}
function decodeJsonPart(part) {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}
/**
 * 校验 id_token（RS256 / JWKS）：签名、iss、aud、exp。
 * 校验失败抛错；返回 payload。
 */
export async function verifyIdToken(idToken) {
    const parts = idToken.split('.');
    if (parts.length !== 3)
        throw new Error('id_token 格式不正确');
    const [h, p, sig] = parts;
    const header = decodeJsonPart(h);
    if (header.alg !== 'RS256')
        throw new Error(`id_token 签名算法不支持：${header.alg || 'unknown'}`);
    let keys = await getJwks();
    let jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
    if (!jwk) {
        keys = await getJwks(true);
        jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
    }
    if (!jwk)
        throw new Error('找不到对应的签名公钥');
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const valid = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(sig, 'base64url'));
    if (!valid)
        throw new Error('id_token 签名校验失败');
    const payload = decodeJsonPart(p);
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < nowSec - 30) {
        throw new Error('id_token 已过期');
    }
    const iss = typeof payload.iss === 'string' ? payload.iss : '';
    if (iss && iss.replace(/\/$/, '') !== config.unisso.issuer.replace(/\/$/, '')) {
        throw new Error('id_token issuer 不匹配');
    }
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.aud && !aud.includes(config.unisso.clientId)) {
        throw new Error('id_token audience 不匹配');
    }
    return payload;
}
