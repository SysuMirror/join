import { db, now } from '../db.js';
import { listUnissoUsers, unissoUserIsActive } from '../unisso.js';
import { ssoNameOf, ssoSubOf } from './sso-users.js';
/** SSO 用户目录缓存有效期（30 分钟）。过期后先返回旧缓存，再后台刷新。 */
const CACHE_TTL_MS = 30 * 60_000;
/** 单次最多返回的候选人数，避免前端一次渲染过多节点。 */
const MAX_RESULTS = 5000;
let inflight = null;
let lastError = '';
function normalizeRecord(record) {
    const sub = ssoSubOf(record);
    if (!sub)
        return null;
    const email = String(record.email || '').trim().toLowerCase();
    const name = ssoNameOf(record);
    return {
        sub,
        name,
        email,
        avatar: String(record.picture || '').trim().slice(0, 500),
        student_id: String(record.student_id || '').trim(),
        preferred_username: String(record.preferred_username || '').trim(),
        internal: record.internal === true ? 1 : 0,
        active: unissoUserIsActive(record) ? 1 : 0,
    };
}
/** 强制从 UniSSO 拉取全量目录并落盘。失败时保留旧缓存。 */
export async function refreshSsoDirectory() {
    if (inflight)
        return inflight;
    inflight = (async () => {
        try {
            const records = await listUnissoUsers(true);
            const users = [];
            const seen = new Set();
            for (const record of records) {
                const row = normalizeRecord(record);
                if (!row || seen.has(row.sub))
                    continue;
                seen.add(row.sub);
                users.push(row);
            }
            // 只保留必要字段，避免缓存文件无限膨胀
            db.getStore().sso_user_cache = {
                updated_at: now(),
                users: users.slice(0, MAX_RESULTS),
            };
            await db.persist();
            lastError = '';
        }
        catch (e) {
            lastError = e instanceof Error ? e.message : 'SSO 用户目录暂不可用';
            throw e;
        }
        finally {
            inflight = null;
        }
    })();
    return inflight;
}
function cacheAgeMs() {
    const at = Date.parse(db.getStore().sso_user_cache.updated_at || '');
    return Number.isFinite(at) ? Date.now() - at : Number.POSITIVE_INFINITY;
}
/**
 * 读取 SSO 目录：
 * - 缓存新鲜：直接返回；
 * - 缓存过期：先返回旧数据，同时后台刷新（stale-while-revalidate）；
 * - 无缓存：同步刷新，失败时回退到本地用户。
 */
export async function ensureSsoDirectory(force = false) {
    const cached = db.getStore().sso_user_cache;
    const fresh = cached.users.length > 0 && cacheAgeMs() < CACHE_TTL_MS;
    if (force) {
        try {
            await refreshSsoDirectory();
        }
        catch (e) {
            return {
                stale: cached.users.length > 0,
                warning: e instanceof Error ? e.message : 'SSO 用户目录刷新失败',
            };
        }
        return { stale: false, warning: '' };
    }
    if (fresh)
        return { stale: false, warning: lastError };
    if (cached.users.length) {
        // 后台刷新，不阻塞当前请求
        void refreshSsoDirectory().catch(() => undefined);
        return { stale: true, warning: lastError };
    }
    try {
        await refreshSsoDirectory();
        return { stale: false, warning: '' };
    }
    catch (e) {
        return { stale: false, warning: e instanceof Error ? e.message : 'SSO 用户目录暂不可用' };
    }
}
function localMatch(sub, email) {
    const s = db.getStore();
    if (sub) {
        const bySub = s.users.find((u) => u.sso_sub && u.sso_sub === sub);
        if (bySub)
            return bySub;
    }
    if (email) {
        const byEmail = s.users.find((u) => (u.email || '').trim().toLowerCase() === email);
        if (byEmail)
            return byEmail;
    }
    return null;
}
/** 把 SSO 缓存与本地已注册用户合并成统一的候选列表。 */
export function mergedDirectory() {
    const s = db.getStore();
    const out = [];
    const seenUsers = new Set();
    const seenKeys = new Set();
    for (const row of s.sso_user_cache.users) {
        const local = localMatch(row.sub, row.email);
        if (local)
            seenUsers.add(local.id);
        const key = row.sub || `email:${row.email}`;
        if (seenKeys.has(key))
            continue;
        seenKeys.add(key);
        out.push({
            user_id: local?.id || 0,
            sso_sub: row.sub,
            name: local?.name || row.name || row.email.split('@')[0] || '未命名',
            email: local?.email || row.email,
            avatar: local?.avatar || row.avatar,
            developer_no: local?.developer_no || '',
            developer_level: local?.developer_level || 'market',
            student_id: row.student_id,
            internal: local ? local.internal === 1 : row.internal === 1,
            active: local ? local.status === 'active' : row.active === 1,
            registered: Boolean(local),
        });
    }
    // 本地用户若不在 SSO 目录里（历史账号 / 邮箱认领账号），也补进来
    for (const u of s.users) {
        if (seenUsers.has(u.id))
            continue;
        const key = u.sso_sub || (u.email ? `email:${u.email.toLowerCase()}` : `user:${u.id}`);
        if (seenKeys.has(key))
            continue;
        seenKeys.add(key);
        out.push({
            user_id: u.id,
            sso_sub: u.sso_sub,
            name: u.name || u.email.split('@')[0] || `用户 ${u.id}`,
            email: u.email,
            avatar: u.avatar,
            developer_no: u.developer_no,
            developer_level: u.developer_level,
            student_id: '',
            internal: u.internal === 1,
            active: u.status === 'active',
            registered: true,
        });
    }
    return out.sort((a, b) => Number(b.registered) - Number(a.registered) ||
        a.name.localeCompare(b.name, 'zh-CN') ||
        a.email.localeCompare(b.email));
}
function haystack(u) {
    return [u.name, u.email, u.developer_no, u.student_id, u.sso_sub]
        .join(' ')
        .toLowerCase();
}
export function searchDirectory(q, opts = {}) {
    const query = q.trim().toLowerCase();
    const includeUnregistered = opts.includeUnregistered !== false;
    const limit = Math.min(MAX_RESULTS, Math.max(1, opts.limit || MAX_RESULTS));
    return mergedDirectory()
        .filter((u) => (opts.registeredOnly ? u.registered : true))
        .filter((u) => (includeUnregistered ? true : u.registered))
        .filter((u) => (query ? haystack(u).includes(query) : true))
        .slice(0, limit);
}
/** 从本地缓存还原一条 UniSSO 记录（邀请未注册用户时自动建号用）。 */
export function cachedRecordBySub(sub) {
    const key = String(sub || '').trim();
    if (!key)
        return null;
    const row = db.getStore().sso_user_cache.users.find((u) => u.sub === key);
    if (!row)
        return null;
    return {
        sub: row.sub,
        sso_sub: row.sub,
        name: row.name,
        email: row.email,
        picture: row.avatar,
        student_id: row.student_id,
        preferred_username: row.preferred_username,
        internal: row.internal === 1,
        active: row.active === 1,
    };
}
export async function getDirectory(q, opts = {}) {
    const status = await ensureSsoDirectory(Boolean(opts.force));
    const users = searchDirectory(q, opts);
    return {
        users,
        cachedAt: db.getStore().sso_user_cache.updated_at,
        stale: status.stale,
        warning: status.warning,
    };
}
/** 启动后预热，不阻塞 listen；失败只记日志。 */
export function warmUserDirectory() {
    if (!db.getStore().sso_user_cache.users.length || cacheAgeMs() > CACHE_TTL_MS) {
        void refreshSsoDirectory().catch((e) => {
            console.warn(`[directory] SSO 用户目录预热失败：${e instanceof Error ? e.message : e}`);
        });
    }
}
