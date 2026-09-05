import crypto from 'node:crypto';
import { config } from '../config.js';
/**
 * 轻量会话 token：`base64url(payload).base64url(hmac)`
 * payload = JSON<{ uid, email, exp }>，用 JOIN_SESSION_SECRET 做 HMAC-SHA256 签名。
 * 避免引入 jsonwebtoken 依赖；满足本平台的简单登录态即可。
 */
const b64u = (buf) => Buffer.from(typeof buf === 'string' ? buf : buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url').toString('utf8');
function secret() {
    if (!config.sessionSecret)
        throw new Error('JOIN_SESSION_SECRET 未配置');
    return config.sessionSecret;
}
function sign(payloadB64) {
    return crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}
export function createSessionToken(payload) {
    const exp = Date.now() + 7 * 24 * 3600 * 1000; // 7 天
    const payloadB64 = b64u(JSON.stringify({ ...payload, exp }));
    return `${payloadB64}.${sign(payloadB64)}`;
}
export function verifySessionToken(token) {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig)
        return null;
    const expect = sign(payloadB64);
    // 恒定时间比较，防时序攻击
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
        return null;
    try {
        const payload = JSON.parse(fromB64u(payloadB64));
        if (typeof payload.exp !== 'number' || payload.exp < Date.now())
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
