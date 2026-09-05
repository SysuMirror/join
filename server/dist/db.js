import { loadStoreRaw, saveStoreRaw } from './storage.js';
const SEQ_KEYS = ['jobs', 'applications', 'users', 'verify_codes'];
function defaultSiteConfig() {
    return {
        brand: '软工集市',
        heroTitle: '加入软工集市',
        heroSubtitle: '我们正在寻找热爱技术与创造的同学。\n投递后我们将尽快联系，合适的候选人会进入团队面试。',
        announcement: '2026 秋季招聘 · 火热进行中，期待与你同行。',
        tagline: '让每个热爱技术的人，都能找到属于他的舞台',
        contactEmail: 'hr@ssemarket.cn',
        bgWords: '技术 · 创造 · 热爱 · 成长',
        adminEmails: '',
        updated_at: nowIso(),
    };
}
function emptyStore() {
    return {
        seq: { jobs: 0, applications: 0, users: 0, verify_codes: 0 },
        jobs: [],
        applications: [],
        users: [],
        verify_codes: [],
        site_config: defaultSiteConfig(),
    };
}
function nowIso() {
    return new Date().toISOString();
}
function migrate(s) {
    if (!s.seq)
        s.seq = emptyStore().seq;
    for (const key of SEQ_KEYS) {
        if (s.seq[key] == null || !Number.isFinite(s.seq[key]))
            s.seq[key] = 0;
    }
    if (!s.jobs)
        s.jobs = [];
    if (!s.applications)
        s.applications = [];
    if (!s.users)
        s.users = [];
    if (!s.verify_codes)
        s.verify_codes = [];
    for (const j of s.jobs) {
        if (j.slug == null)
            j.slug = '';
        if (j.department == null)
            j.department = '';
        if (j.location == null)
            j.location = '';
        if (j.summary == null)
            j.summary = '';
        if (j.description == null)
            j.description = '';
        if (j.headcount == null || !Number.isFinite(Number(j.headcount)))
            j.headcount = 0;
        if (j.enabled == null)
            j.enabled = 1;
        if (j.sort_order == null)
            j.sort_order = 0;
        if (!['fulltime', 'intern', 'parttime'].includes(String(j.type)))
            j.type = 'fulltime';
    }
    for (const a of s.applications) {
        if (a.name == null)
            a.name = '';
        if (a.contact == null)
            a.contact = '';
        if (a.resume_url == null)
            a.resume_url = '';
        if (a.note == null)
            a.note = '';
        if (a.review_note == null)
            a.review_note = '';
        if (!a.status)
            a.status = 'pending';
        if (a.oa_oid == null)
            a.oa_oid = '';
        if (a.oa_status == null)
            a.oa_status = '';
        if (a.oa_checked_at == null)
            a.oa_checked_at = '';
        if (a.oa_timeline == null)
            a.oa_timeline = '';
        if (a.reviewer == null)
            a.reviewer = '';
    }
    for (const u of s.users) {
        if (u.name == null)
            u.name = u.email?.split('@')[0] || '';
        if (u.is_admin == null)
            u.is_admin = 0;
        if (u.last_login_at == null)
            u.last_login_at = '';
    }
    for (const c of s.verify_codes) {
        if (c.expires_at == null)
            c.expires_at = '';
        if (c.used == null)
            c.used = 0;
    }
    // site_config 单例兜底：合并默认值，缺失字段补默认
    const def = defaultSiteConfig();
    if (!s.site_config)
        s.site_config = def;
    const sc = s.site_config;
    for (const k of ['brand', 'heroTitle', 'heroSubtitle', 'announcement', 'tagline', 'contactEmail', 'bgWords', 'adminEmails']) {
        if (sc[k] == null)
            sc[k] = def[k];
    }
    if (sc.updated_at == null)
        sc.updated_at = nowIso();
}
function parseStore(raw) {
    if (!raw)
        return emptyStore();
    const s = JSON.parse(raw);
    migrate(s);
    return s;
}
async function save(s) {
    await saveStoreRaw(JSON.stringify(s, null, 2));
}
let store = emptyStore();
let ready = false;
export async function initDb() {
    const raw = await loadStoreRaw();
    store = parseStore(raw);
    await save(store);
    ready = true;
}
export function assertDbReady() {
    if (!ready)
        throw new Error('数据库尚未初始化，请先 await initDb()');
}
export function now() {
    return new Date().toISOString();
}
function nextId(table) {
    const cur = Number(store.seq[table]);
    store.seq[table] = (Number.isFinite(cur) ? cur : 0) + 1;
    return store.seq[table];
}
async function persist() {
    assertDbReady();
    await save(store);
}
export const db = {
    getStore: () => {
        assertDbReady();
        return store;
    },
    persist,
    reload: async () => {
        const raw = await loadStoreRaw();
        store = parseStore(raw);
    },
    nextId,
    async insert(table, row) {
        const created = { ...row, id: row.id ?? nextId(table) };
        store[table].push(created);
        await persist();
        return created;
    },
    async transaction(fn) {
        const snap = JSON.parse(JSON.stringify(store));
        try {
            const r = fn();
            await persist();
            return r;
        }
        catch (e) {
            store = snap;
            throw e;
        }
    },
};
