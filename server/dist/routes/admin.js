import { Router } from 'express';
import { db, now } from '../db.js';
import { ok, fail, requireStaff, requireGlobalAdmin, getAdminContext, getCurrentUser, } from '../middleware.js';
import { queryOa } from '../dev-platform.js';
import { getDirectory, refreshSsoDirectory, } from '../services/user-directory.js';
import { departmentAdminDepartmentsOf, departmentPublicView, departmentSeatStats, headDepartmentsOf, isDepartmentAdminUser, isSuperAdminUser, joinDepartment, leaveDepartment, userIdentityView, } from '../services/org.js';
import { defenseView, forceDecide, recordSeatReview, releaseRoundtableSeat, submitReview, canViewDefense, promoteWaitlist, } from '../services/defense.js';
import { syncUnissoDeveloper } from '../services/developer-sync.js';
import { applyPublicityToDepartments, buildPublicityContent, currentSeatTable, lastPublicityDate, makePublicityRow, publicityView, recentPromotions, touchPublicity, } from '../services/publicity.js';
export const adminRouter = Router();
// 超级管理员 + 部门管理员均可进入；具体数据范围由 getAdminContext() 裁剪
adminRouter.use(requireStaff);
/** 仅超级管理员可执行的写操作 */
function ensureGlobal(req, res) {
    if (!getAdminContext(req).global) {
        fail(res, 403, '仅超级管理员可执行此操作');
        return false;
    }
    return true;
}
/** 校验并规范化部门管理员邮箱列表 */
function parseAdminEmails(v) {
    const list = String(v ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    for (const e of list) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
            return { value: '', error: `邮箱格式不正确：${e}` };
        }
    }
    return { value: Array.from(new Set(list)).slice(0, 50).join(',') };
}
/** 当前请求可管辖的部门 id 集合 */
function scopedDepartmentIds(req) {
    return new Set(getAdminContext(req).departmentIds);
}
function jobInScope(req, job) {
    const ctx = getAdminContext(req);
    return ctx.global || ctx.departmentIds.includes(job.department_id);
}
function str(v, max) {
    return String(v ?? '')
        .trim()
        .slice(0, max);
}
function num(v, min, max, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
}
function slugify(name, prefix) {
    return (name
        .toLowerCase()
        .replace(/[^a-z0-9一-龥]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || `${prefix}-${Date.now()}`);
}
function adminName(req) {
    return getCurrentUser(req)?.email || 'admin';
}
function parseSnapshot(json) {
    try {
        return json ? JSON.parse(json) : {};
    }
    catch {
        return {};
    }
}
// ===== 当前后台身份与权限范围 =====
adminRouter.get('/me', (req, res) => {
    const ctx = getAdminContext(req);
    ok(res, {
        global: ctx.global,
        resourceReviewer: ctx.resourceReviewer,
        user: ctx.user
            ? {
                id: ctx.user.id,
                email: ctx.user.email,
                name: ctx.user.name,
                avatar: ctx.user.avatar,
                is_admin: isSuperAdminUser(ctx.user),
                identity: userIdentityView(ctx.user),
            }
            : null,
        departments: ctx.departments.map((d) => ({
            id: d.id,
            name: d.name,
            slug: d.slug,
            admin_emails: d.admin_emails,
            head_user_id: d.head_user_id,
            base_seats: d.base_seats,
            floating_seats: d.floating_seats,
        })),
        head_departments: ctx.headDepartments.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
        permissions: {
            departments: ctx.global,
            departmentAdmins: ctx.global,
            users: ctx.global,
            defenses: true,
            roundtable: ctx.global,
            faqs: ctx.global,
            site: ctx.global,
            history: ctx.global,
            jobs: true,
            applications: true,
        },
    });
});
// ===== 用户目录（Pod 内缓存，供后台下拉快速匹配） =====
adminRouter.get('/directory/users', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const q = String(req.query.q || '').trim();
    const registeredOnly = String(req.query.registeredOnly || '') === '1';
    const includeUnregistered = String(req.query.includeUnregistered || '') !== '0';
    const force = String(req.query.refresh || '') === '1';
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 5000));
    const page = await getDirectory(q, { registeredOnly, includeUnregistered, force, limit });
    ok(res, page);
});
adminRouter.post('/directory/refresh', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    try {
        await refreshSsoDirectory();
        ok(res, { cachedAt: db.getStore().sso_user_cache.updated_at, total: db.getStore().sso_user_cache.users.length });
    }
    catch (e) {
        fail(res, 503, e instanceof Error ? e.message : 'SSO 用户目录刷新失败');
    }
});
// ===== 部门管理 =====
function mapDepartment(d) {
    const s = db.getStore();
    const jobs = s.jobs.filter((j) => j.department_id === d.id);
    const seat = departmentSeatStats(d);
    return {
        ...d,
        ...departmentPublicView(d),
        admin_user_ids: d.admin_user_ids,
        adminUsers: (d.admin_user_ids || '')
            .split(',')
            .map((x) => Number(x.trim()))
            .filter((n) => Number.isFinite(n) && n > 0)
            .map((id) => s.users.find((u) => u.id === id))
            .filter(Boolean)
            .map((u) => ({ id: u.id, name: u.name, email: u.email })),
        jobCount: jobs.length,
        openJobCount: jobs.filter((j) => j.enabled === 1).length,
        seat,
    };
}
adminRouter.get('/departments', (req, res) => {
    const ids = scopedDepartmentIds(req);
    const ctx = getAdminContext(req);
    const rows = [...db.getStore().departments]
        .filter((d) => ctx.global || ids.has(d.id))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    ok(res, rows.map(mapDepartment));
});
adminRouter.post('/departments', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const b = (req.body || {});
    const adminEmails = parseAdminEmails(b.admin_emails);
    if (adminEmails.error) {
        fail(res, 400, adminEmails.error);
        return;
    }
    const name = str(b.name, 60);
    if (!name) {
        fail(res, 400, '部门名称必填');
        return;
    }
    const s = db.getStore();
    if (s.departments.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
        fail(res, 409, '同名部门已存在');
        return;
    }
    const id = db.nextId('departments');
    let slug = slugify(name, 'dept');
    if (s.departments.some((d) => d.slug === slug))
        slug = `${slug}-${id}`;
    const t = now();
    const row = {
        id,
        name,
        slug,
        summary: str(b.summary, 300),
        description: str(b.description, 5000),
        color: str(b.color, 20),
        admin_emails: adminEmails.value,
        admin_user_ids: '',
        head_user_id: num(b.head_user_id, 0, 999999, 0),
        base_seats: Math.max(1, num(b.base_seats, 1, 9999, 1)),
        floating_seats: num(b.floating_seats, 0, 9999, 0),
        output_delivery: num(b.output_delivery, 0, 100, 0),
        output_usage: num(b.output_usage, 0, 100, 0),
        output_talent: num(b.output_talent, 0, 100, 0),
        output_activity: num(b.output_activity, 0, 100, 0),
        output_note: str(b.output_note, 3000),
        enabled: b.enabled === false || b.enabled === 0 ? 0 : 1,
        sort_order: num(b.sort_order, -9999, 9999, s.departments.length + 1),
        created_at: t,
        updated_at: t,
    };
    s.departments.push(row);
    // 新建时也支持直接指定部门管理员（界面使用用户下拉，不再手填邮箱）
    if (Array.isArray(b.admin_user_ids)) {
        const ids = b.admin_user_ids
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0 && s.users.some((u) => u.id === n));
        row.admin_user_ids = Array.from(new Set(ids)).join(',');
    }
    if (row.head_user_id) {
        const ids = row.admin_user_ids
            .split(',')
            .map((x) => Number(x.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (!ids.includes(row.head_user_id))
            row.admin_user_ids = [...ids, row.head_user_id].join(',');
    }
    await db.persist();
    ok(res, mapDepartment(row), '部门已创建');
});
adminRouter.put('/departments/:id', async (req, res) => {
    const s = db.getStore();
    const d = s.departments.find((x) => x.id === Number(req.params.id));
    if (!d) {
        fail(res, 404, '部门不存在');
        return;
    }
    const b = (req.body || {});
    const locked = [
        'base_seats',
        'floating_seats',
        'output_delivery',
        'output_usage',
        'output_talent',
        'output_activity',
        'output_note',
    ].filter((k) => b[k] != null);
    if (locked.length) {
        fail(res, 400, '席位与部门指标请通过「公示」发布维护，不能直接修改');
        return;
    }
    const ctx = getAdminContext(req);
    // 部门负责人/管理员可维护本部门介绍，其他字段仍仅限超级管理员
    if (!ctx.global) {
        if (!ctx.departmentIds.includes(d.id)) {
            fail(res, 403, '无权管理该部门');
            return;
        }
        if (b.summary != null)
            d.summary = str(b.summary, 300);
        if (b.description != null)
            d.description = str(b.description, 5000);
        d.updated_at = now();
        await db.persist();
        ok(res, mapDepartment(d), '部门介绍已更新');
        return;
    }
    if (b.name != null) {
        const name = str(b.name, 60);
        if (!name) {
            fail(res, 400, '部门名称不能为空');
            return;
        }
        if (s.departments.some((x) => x.id !== d.id && x.name.toLowerCase() === name.toLowerCase())) {
            fail(res, 409, '同名部门已存在');
            return;
        }
        const oldName = d.name;
        d.name = name;
        for (const j of s.jobs) {
            if (j.department_id === d.id)
                j.department = oldName === j.department ? name : j.department;
        }
    }
    if (b.summary != null)
        d.summary = str(b.summary, 300);
    if (b.description != null)
        d.description = str(b.description, 5000);
    if (b.color != null)
        d.color = str(b.color, 20);
    if (b.head_user_id != null) {
        const oldHeadId = d.head_user_id;
        const headId = num(b.head_user_id, 0, 999999, d.head_user_id);
        if (headId && !s.users.some((u) => u.id === headId)) {
            fail(res, 400, '指定负责人不存在');
            return;
        }
        d.head_user_id = headId;
        // 卸任负责人且不再负责任何部门 → 按退出机制释放圆桌席位
        if (oldHeadId && oldHeadId !== headId) {
            const oldHead = s.users.find((u) => u.id === oldHeadId);
            if (oldHead &&
                oldHead.developer_level === 'roundtable' &&
                headDepartmentsOf(oldHead.id).length === 0) {
                releaseRoundtableSeat(oldHead, {
                    reason: `卸任「${d.name}」负责人`,
                    by: adminName(req),
                });
            }
        }
        if (headId) {
            const ids = (d.admin_user_ids || '')
                .split(',')
                .map((x) => Number(x.trim()))
                .filter((n) => Number.isFinite(n) && n > 0);
            if (!ids.includes(headId))
                d.admin_user_ids = [...ids, headId].join(',');
            const head = s.users.find((u) => u.id === headId);
            if (head) {
                // 负责人必须至少是项目开发者
                if (head.developer_level === 'market') {
                    head.developer_level = 'project';
                    head.primary_department_id = d.id;
                    head.department_joined_at = head.department_joined_at || now();
                }
                if (head.primary_department_id === d.id) {
                    const active = s.memberships.find((m) => m.user_id === head.id && m.department_id === d.id && m.status === 'active');
                    if (active)
                        active.role = 'head';
                    else
                        s.memberships.push({
                            id: db.nextId('memberships'),
                            user_id: head.id,
                            department_id: d.id,
                            role: 'head',
                            status: 'active',
                            source_application_id: 0,
                            joined_at: now(),
                            left_at: '',
                            note: '被任命为部门负责人',
                            created_at: now(),
                            updated_at: now(),
                        });
                }
                await syncUnissoDeveloper(head);
            }
        }
    }
    if (b.admin_user_ids != null) {
        const raw = Array.isArray(b.admin_user_ids)
            ? b.admin_user_ids
            : String(b.admin_user_ids).split(',');
        const ids = raw
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0 && s.users.some((u) => u.id === n));
        d.admin_user_ids = Array.from(new Set(ids)).join(',');
    }
    if (d.head_user_id) {
        const ids = (d.admin_user_ids || '')
            .split(',')
            .map((x) => Number(x.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (!ids.includes(d.head_user_id))
            d.admin_user_ids = [...ids, d.head_user_id].join(',');
    }
    if (b.base_seats != null)
        d.base_seats = Math.max(1, num(b.base_seats, 1, 9999, d.base_seats));
    if (b.floating_seats != null)
        d.floating_seats = num(b.floating_seats, 0, 9999, d.floating_seats);
    for (const k of [
        'output_delivery',
        'output_usage',
        'output_talent',
        'output_activity',
    ]) {
        if (b[k] != null)
            d[k] = num(b[k], 0, 100, d[k]);
    }
    if (b.output_note != null)
        d.output_note = str(b.output_note, 3000);
    if (b.admin_emails != null) {
        const adminEmails = parseAdminEmails(b.admin_emails);
        if (adminEmails.error) {
            fail(res, 400, adminEmails.error);
            return;
        }
        d.admin_emails = adminEmails.value;
    }
    if (b.enabled != null)
        d.enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
    if (b.sort_order != null)
        d.sort_order = num(b.sort_order, -9999, 9999, d.sort_order);
    d.updated_at = now();
    // 统一刷新部门下职位的部门名快照
    for (const j of s.jobs) {
        if (j.department_id === d.id)
            j.department = d.name;
    }
    await db.persist();
    ok(res, mapDepartment(d), '部门已更新');
});
adminRouter.delete('/departments/:id', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const s = db.getStore();
    const id = Number(req.params.id);
    const idx = s.departments.findIndex((x) => x.id === id);
    if (idx < 0) {
        fail(res, 404, '部门不存在');
        return;
    }
    if (s.jobs.some((j) => j.department_id === id)) {
        fail(res, 400, '该部门下还有岗位，请先删除或转移岗位');
        return;
    }
    s.departments.splice(idx, 1);
    await db.persist();
    ok(res, { id }, '部门已删除');
});
// ===== 职位管理 =====
function mapJob(job) {
    return {
        ...job,
        tagsArray: (job.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
    };
}
adminRouter.get('/jobs', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const department = String(req.query.department || '').trim();
    const ctx = getAdminContext(req);
    let rows = [...db.getStore().jobs]
        .filter((j) => ctx.global || ctx.departmentIds.includes(j.department_id))
        .sort((a, b) => a.sort_order - b.sort_order || b.id - a.id);
    if (q) {
        rows = rows.filter((j) => j.title.toLowerCase().includes(q) ||
            j.department.toLowerCase().includes(q) ||
            j.tags.toLowerCase().includes(q));
    }
    if (department)
        rows = rows.filter((j) => String(j.department_id) === department);
    ok(res, rows.map(mapJob));
});
function applyJobFields(job, b, departmentName) {
    if (b.title != null)
        job.title = str(b.title, 100) || job.title;
    job.department_id = num(b.department_id, 0, 999999, job.department_id);
    job.department = departmentName;
    if (b.direction != null)
        job.direction = str(b.direction, 40);
    if (b.location != null)
        job.location = str(b.location, 60);
    if (b.type != null && ['fulltime', 'intern'].includes(String(b.type))) {
        job.type = String(b.type);
    }
    if (b.experience != null)
        job.experience = str(b.experience, 40);
    if (b.education != null)
        job.education = str(b.education, 40);
    if (b.salary != null)
        job.salary = str(b.salary, 60);
    if (b.contact_wechat != null)
        job.contact_wechat = str(b.contact_wechat, 60);
    if (b.tags != null)
        job.tags = str(b.tags, 300);
    if (b.summary != null)
        job.summary = str(b.summary, 300);
    if (b.responsibilities != null)
        job.responsibilities = str(b.responsibilities, 8000);
    if (b.requirements != null)
        job.requirements = str(b.requirements, 8000);
    if (b.bonus != null)
        job.bonus = str(b.bonus, 4000);
    if (b.description != null)
        job.description = str(b.description, 8000);
    if (b.headcount != null)
        job.headcount = num(b.headcount, 0, 9999, job.headcount);
    if (b.auto_approve != null) {
        job.auto_approve = b.auto_approve === true || b.auto_approve === 1 ? 1 : 0;
    }
    if (b.enabled != null)
        job.enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
    if (b.sort_order != null)
        job.sort_order = num(b.sort_order, -9999, 9999, job.sort_order);
}
adminRouter.post('/jobs', async (req, res) => {
    const s = db.getStore();
    const b = (req.body || {});
    const title = str(b.title, 100);
    if (!title) {
        fail(res, 400, '岗位名称必填');
        return;
    }
    const departmentId = num(b.department_id, 0, 999999);
    const dept = s.departments.find((d) => d.id === departmentId);
    if (!dept) {
        fail(res, 400, '请选择所属部门');
        return;
    }
    const ctx = getAdminContext(req);
    if (!ctx.global && !ctx.departmentIds.includes(dept.id)) {
        fail(res, 403, '无权在该部门下发布岗位');
        return;
    }
    const base = slugify(title, 'job');
    let slug = base;
    let seq = 1;
    while (s.jobs.some((j) => j.slug === slug))
        slug = `${base}-${++seq}`;
    const t = now();
    const row = {
        id: db.nextId('jobs'),
        slug,
        title,
        department_id: dept.id,
        department: dept.name,
        direction: '',
        location: '',
        type: 'fulltime',
        experience: '不限',
        education: '不限',
        salary: '',
        contact_wechat: '',
        tags: '',
        summary: '',
        responsibilities: '',
        requirements: '',
        bonus: '',
        description: '',
        headcount: 0,
        auto_approve: 0,
        enabled: 1,
        sort_order: s.jobs.length + 1,
        created_at: t,
        updated_at: t,
    };
    applyJobFields(row, b, dept.name);
    row.title = title;
    row.updated_at = t;
    s.jobs.push(row);
    await db.persist();
    ok(res, mapJob(row), '岗位已创建');
});
adminRouter.put('/jobs/:id', async (req, res) => {
    const s = db.getStore();
    const job = s.jobs.find((j) => j.id === Number(req.params.id));
    if (!job) {
        fail(res, 404, '岗位不存在');
        return;
    }
    if (!jobInScope(req, job)) {
        fail(res, 403, '无权管理该部门的岗位');
        return;
    }
    const b = (req.body || {});
    const departmentId = b.department_id != null ? num(b.department_id, 0, 999999, job.department_id) : job.department_id;
    const dept = s.departments.find((d) => d.id === departmentId);
    if (!dept) {
        fail(res, 400, '所属部门不存在');
        return;
    }
    const ctx = getAdminContext(req);
    if (!ctx.global && !ctx.departmentIds.includes(dept.id)) {
        fail(res, 403, '无权将岗位转移到该部门');
        return;
    }
    applyJobFields(job, b, dept.name);
    job.department_id = dept.id;
    job.updated_at = now();
    await db.persist();
    ok(res, mapJob(job), '岗位已更新');
});
adminRouter.delete('/jobs/:id', async (req, res) => {
    const s = db.getStore();
    const id = Number(req.params.id);
    const idx = s.jobs.findIndex((j) => j.id === id);
    if (idx < 0) {
        fail(res, 404, '岗位不存在');
        return;
    }
    if (!jobInScope(req, s.jobs[idx])) {
        fail(res, 403, '无权删除该部门的岗位');
        return;
    }
    if (s.applications.some((a) => a.job_id === id)) {
        fail(res, 400, '该岗位已有报名记录，请改为「关闭」而不是删除，以保留历史数据');
        return;
    }
    s.jobs.splice(idx, 1);
    await db.persist();
    ok(res, { id }, '岗位已删除');
});
// ===== 投递审核 =====
function mapApplication(a, detail = false) {
    const s = db.getStore();
    const job = s.jobs.find((j) => j.id === a.job_id);
    const user = s.users.find((u) => u.id === a.user_id);
    const resume = s.resumes.find((r) => r.id === a.resume_id);
    const snap = parseSnapshot(a.resume_snapshot);
    let timeline = [];
    try {
        const arr = JSON.parse(a.oa_timeline);
        if (Array.isArray(arr))
            timeline = arr;
    }
    catch {
        timeline = [];
    }
    return {
        ...a,
        stage: a.stage,
        interview_at: a.interview_at,
        interview_note: a.interview_note,
        confirmed_at: a.confirmed_at,
        joined_at: a.joined_at,
        jobTitle: job?.title || '',
        jobSlug: job?.slug || '',
        jobDepartment: job?.department || '',
        jobLocation: job?.location || '',
        userEmail: user?.email || '',
        userName: user?.name || '',
        resumeTitle: resume?.title || str(snap.title, 100),
        resumeFileName: resume?.file_name || str(snap.file_name, 200),
        resumeText: detail ? resume?.parsed_text || '' : undefined,
        snapshot: snap,
        oaTimeline: timeline,
    };
}
adminRouter.get('/applications', (req, res) => {
    const status = String(req.query.status || '').trim();
    const stage = String(req.query.stage || '').trim();
    const department = String(req.query.department || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();
    const s = db.getStore();
    const ctx = getAdminContext(req);
    const scopedJobIds = new Set(s.jobs
        .filter((j) => ctx.global || ctx.departmentIds.includes(j.department_id))
        .map((j) => j.id));
    let rows = s.applications
        .filter((a) => scopedJobIds.has(a.job_id))
        .sort((a, b) => b.id - a.id);
    if (status) {
        rows = rows.filter((a) => a.status === status || a.oa_status === status);
    }
    if (stage)
        rows = rows.filter((a) => a.stage === stage);
    if (department) {
        const jobIds = new Set(s.jobs.filter((j) => String(j.department_id) === department).map((j) => j.id));
        rows = rows.filter((a) => jobIds.has(a.job_id));
    }
    if (q) {
        rows = rows.filter((a) => [a.name, a.email, a.phone, a.contact, a.note].join(' ').toLowerCase().includes(q));
    }
    ok(res, rows.map((a) => mapApplication(a)));
});
adminRouter.get('/applications/:id', (req, res) => {
    const s = db.getStore();
    const a = s.applications.find((x) => x.id === Number(req.params.id));
    if (!a) {
        fail(res, 404, '报名记录不存在');
        return;
    }
    const job = s.jobs.find((j) => j.id === a.job_id);
    if (!job || !jobInScope(req, job)) {
        fail(res, 403, '无权查看该报名');
        return;
    }
    ok(res, mapApplication(a, true));
});
const APP_STAGES = ['submitted', 'interview', 'offered', 'joined', 'rejected', 'withdrawn'];
/** 更新报名双选阶段：约沟通 / 发 offer / 直接加入 / 驳回 */
adminRouter.post('/applications/:id/stage', async (req, res) => {
    const s = db.getStore();
    const app = s.applications.find((a) => a.id === Number(req.params.id));
    if (!app) {
        fail(res, 404, '报名记录不存在');
        return;
    }
    const job = s.jobs.find((j) => j.id === app.job_id);
    if (!job || !jobInScope(req, job)) {
        fail(res, 403, '无权审核该报名');
        return;
    }
    const b = (req.body || {});
    const stage = String(b.stage || '').trim();
    if (!APP_STAGES.includes(stage)) {
        fail(res, 400, '阶段不合法');
        return;
    }
    if (['joined', 'offered'].includes(stage) && job.department_id) {
        const dept = s.departments.find((d) => d.id === job.department_id);
        if (!dept) {
            fail(res, 400, '岗位所属部门不存在');
            return;
        }
        if (stage === 'joined') {
            const user = s.users.find((u) => u.id === app.user_id);
            if (!user) {
                fail(res, 400, '报名用户不存在');
                return;
            }
            if (user.developer_level === 'roundtable' && user.primary_department_id !== dept.id) {
                fail(res, 400, '圆桌开发者调整归属部门请使用「成员与权限」');
                return;
            }
            joinDepartment(user, dept, { sourceApplicationId: app.id, note: '管理员确认加入' });
            await syncUnissoDeveloper(user);
            app.confirmed_at = now();
            app.joined_at = now();
        }
    }
    const t = now();
    app.stage = stage;
    if (stage === 'interview') {
        app.interview_at = str(b.interview_at, 40);
        app.interview_note = str(b.interview_note, 2000);
        app.status = 'pending';
    }
    else if (stage === 'offered') {
        app.status = 'passed';
        app.interview_note = str(b.interview_note, 2000) || app.interview_note;
    }
    else if (stage === 'joined') {
        app.status = 'passed';
    }
    else if (stage === 'rejected') {
        app.status = 'rejected';
        app.review_note = str(b.note, 500) || app.review_note;
    }
    else if (stage === 'withdrawn') {
        app.status = 'rejected';
    }
    app.reviewer = adminName(req);
    app.updated_at = t;
    await db.persist();
    ok(res, mapApplication(app), stage === 'offered' ? '已发出双选确认，等待本人确认' : '报名阶段已更新');
});
/** 兼容旧接口：初审通过 = 发出双选确认（offered），需本人确认后进组 */
adminRouter.post('/applications/:id/pass', async (req, res) => {
    const s = db.getStore();
    const app = s.applications.find((a) => a.id === Number(req.params.id));
    if (!app) {
        fail(res, 404, '报名记录不存在');
        return;
    }
    const job = s.jobs.find((j) => j.id === app.job_id);
    if (!job || !jobInScope(req, job)) {
        fail(res, 403, '无权审核该报名');
        return;
    }
    if (app.stage === 'submitted' || app.stage === 'interview') {
        app.stage = 'offered';
        app.status = 'passed';
        app.reviewer = adminName(req);
        app.updated_at = now();
        await db.persist();
        ok(res, mapApplication(app), '已通过部门双选，等待本人确认');
        return;
    }
    ok(res, mapApplication(app), '该报名已处理');
});
/** 初审驳回 */
adminRouter.post('/applications/:id/reject', async (req, res) => {
    const s = db.getStore();
    const app = s.applications.find((a) => a.id === Number(req.params.id));
    if (!app) {
        fail(res, 404, '报名记录不存在');
        return;
    }
    const job = s.jobs.find((j) => j.id === app.job_id);
    if (!job || !jobInScope(req, job)) {
        fail(res, 403, '无权审核该报名');
        return;
    }
    const note = String((req.body || {}).note || '').trim().slice(0, 500);
    const t = now();
    app.status = 'rejected';
    app.stage = 'rejected';
    app.review_note = note || app.review_note;
    app.reviewer = adminName(req);
    app.updated_at = t;
    await db.persist();
    ok(res, mapApplication(app), '已驳回');
});
async function refreshOa(app) {
    if (!app.oa_oid)
        return mapApplication(app);
    const result = await queryOa(app.oa_oid);
    const t = now();
    if (result.data) {
        app.oa_status = result.data.status;
        app.oa_timeline = JSON.stringify(result.data.timeline || []);
        app.oa_checked_at = t;
        app.updated_at = t;
        await db.persist();
    }
    return mapApplication(app);
}
/** 批量轮询所有已推送且仍 pending 的申请 */
adminRouter.post('/applications/refresh-oa', async (req, res) => {
    const s = db.getStore();
    const ctx = getAdminContext(req);
    const scopedJobIds = new Set(s.jobs
        .filter((j) => ctx.global || ctx.departmentIds.includes(j.department_id))
        .map((j) => j.id));
    const targets = s.applications.filter((a) => scopedJobIds.has(a.job_id) && a.status === 'passed' && a.oa_oid && a.oa_status === 'pending');
    let updated = 0;
    for (const app of targets) {
        await refreshOa(app);
        updated += 1;
    }
    ok(res, { refreshed: updated, total: targets.length });
});
// ===== 成员与权限（人事系统） =====
function canSeeUser(req, u) {
    const ctx = getAdminContext(req);
    if (ctx.global)
        return true;
    if (ctx.departmentIds.includes(u.primary_department_id))
        return true;
    return ctx.departmentIds.some((id) => {
        const d = db.getStore().departments.find((x) => x.id === id);
        return Boolean(d && (d.head_user_id === u.id || isDepartmentAdminUser(u, d)));
    });
}
function mapAdminUser(u) {
    const s = db.getStore();
    const dept = s.departments.find((d) => d.id === u.primary_department_id) || null;
    return {
        ...userIdentityView(u),
        last_login_at: u.last_login_at,
        created_at: u.created_at,
        status: u.status,
        provider: u.provider,
        avatar: u.avatar,
        department: dept
            ? { id: dept.id, name: dept.name, slug: dept.slug, color: dept.color }
            : null,
    };
}
adminRouter.get('/users', (req, res) => {
    const ctx = getAdminContext(req);
    if (!ctx.global && !ctx.departmentIds.length) {
        fail(res, 403, '无成员管理权限');
        return;
    }
    const q = String(req.query.q || '').trim().toLowerCase();
    const role = String(req.query.role || '').trim();
    const level = String(req.query.level || '').trim();
    const status = String(req.query.status || '').trim();
    const department = String(req.query.department || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const s = db.getStore();
    let rows = s.users.filter((u) => canSeeUser(req, u));
    if (q) {
        rows = rows.filter((u) => {
            const dept = s.departments.find((d) => d.id === u.primary_department_id);
            return [u.name, u.email, u.developer_no, dept?.name, u.developer_skills]
                .join(' ')
                .toLowerCase()
                .includes(q);
        });
    }
    if (level)
        rows = rows.filter((u) => u.developer_level === level);
    if (status)
        rows = rows.filter((u) => u.status === status);
    if (department)
        rows = rows.filter((u) => String(u.primary_department_id) === department);
    if (role) {
        rows = rows.filter((u) => {
            if (role === 'super_admin')
                return isSuperAdminUser(u);
            if (role === 'resource')
                return u.reviewer_role === 'resource';
            if (role === 'dept_admin')
                return departmentAdminDepartmentsOf(u).length > 0;
            if (role === 'user') {
                return (!isSuperAdminUser(u) &&
                    u.reviewer_role !== 'resource' &&
                    departmentAdminDepartmentsOf(u).length === 0);
            }
            return true;
        });
    }
    rows = rows.sort((a, b) => {
        const ta = a.last_login_at || a.created_at || '';
        const tb = b.last_login_at || b.created_at || '';
        return tb.localeCompare(ta) || b.id - a.id;
    });
    const total = rows.length;
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map(mapAdminUser);
    ok(res, { items, total, page, pageSize });
});
adminRouter.get('/users/lookup', (req, res) => {
    if (!getAdminContext(req).global) {
        fail(res, 403, '仅超级管理员可查询用户');
        return;
    }
    const q = String(req.query.q || '').trim().toLowerCase();
    let rows = db.getStore().users;
    if (q) {
        rows = rows.filter((u) => [u.name, u.email, u.developer_no].join(' ').toLowerCase().includes(q));
    }
    ok(res, rows
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN') || a.id - b.id)
        .slice(0, 100)
        .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        developer_no: u.developer_no,
        developer_level: u.developer_level,
        avatar: u.avatar,
    })));
});
adminRouter.get('/users/:id', (req, res) => {
    const s = db.getStore();
    const u = s.users.find((x) => x.id === Number(req.params.id));
    if (!u) {
        fail(res, 404, '用户不存在');
        return;
    }
    if (!canSeeUser(req, u)) {
        fail(res, 403, '无权查看该用户');
        return;
    }
    const memberships = s.memberships
        .filter((m) => m.user_id === u.id)
        .sort((a, b) => b.id - a.id)
        .map((m) => ({
        ...m,
        department: s.departments.find((d) => d.id === m.department_id)?.name || '',
    }));
    const defenses = s.defenses
        .filter((d) => d.applicant_user_id === u.id)
        .sort((a, b) => b.id - a.id)
        .map((d) => defenseView(d));
    const reviews = s.defense_reviews
        .filter((r) => r.reviewer_user_id === u.id)
        .sort((a, b) => b.id - a.id)
        .slice(0, 50);
    const seatReviews = s.seat_reviews.filter((r) => r.user_id === u.id).sort((a, b) => b.id - a.id);
    ok(res, { ...mapAdminUser(u), memberships, defenses, reviews, seat_reviews: seatReviews });
});
/** 设置系统角色 / 部门管理员 / 部门负责人（人事权限的核心） */
adminRouter.patch('/users/:id/role', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const s = db.getStore();
    const u = s.users.find((x) => x.id === Number(req.params.id));
    if (!u) {
        fail(res, 404, '用户不存在');
        return;
    }
    const b = (req.body || {});
    const t = now();
    if (b.system_role != null) {
        const role = String(b.system_role);
        if (role !== 'user' && role !== 'super_admin') {
            fail(res, 400, '系统角色不合法');
            return;
        }
        if (role === 'user' && isSuperAdminUser(u)) {
            const supers = s.users.filter((x) => isSuperAdminUser(x) && x.id !== u.id);
            if (!supers.length) {
                fail(res, 400, '不能移除最后一位超级管理员');
                return;
            }
            // 同步把该用户的 UniSSO sub 从站点配置管理员名单移出，避免旧白名单继续授权
            const list = (s.site_config.adminSubs || '')
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean)
                .filter((x) => x !== (u.sso_sub || '').trim());
            s.site_config.adminSubs = list.join(',');
        }
        u.system_role = role;
        u.is_admin = role === 'super_admin' ? 1 : 0;
    }
    if (b.reviewer_role != null) {
        const rr = String(b.reviewer_role);
        if (rr !== '' && rr !== 'resource') {
            fail(res, 400, '评审角色不合法');
            return;
        }
        u.reviewer_role = rr;
    }
    const wantedAdminDepts = Array.isArray(b.department_admin_ids)
        ? new Set(b.department_admin_ids
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0))
        : null;
    const wantedHeadDepts = Array.isArray(b.head_department_ids)
        ? new Set(b.head_department_ids
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0))
        : null;
    if (wantedAdminDepts) {
        for (const d of s.departments) {
            const ids = (d.admin_user_ids || '')
                .split(',')
                .map((x) => Number(x.trim()))
                .filter((n) => Number.isFinite(n) && n > 0)
                .filter((n) => n !== u.id);
            if (wantedAdminDepts.has(d.id))
                ids.push(u.id);
            // 负责人保留管理员权限；但若本次同时取消其负责人身份，则一并移除
            const keepsHead = wantedHeadDepts ? wantedHeadDepts.has(d.id) : d.head_user_id === u.id;
            if (keepsHead && !ids.includes(u.id))
                ids.push(u.id);
            d.admin_user_ids = Array.from(new Set(ids)).join(',');
            d.updated_at = t;
        }
    }
    if (wantedHeadDepts) {
        const wanted = wantedHeadDepts;
        let removedHead = false;
        for (const d of s.departments) {
            if (wanted.has(d.id)) {
                d.head_user_id = u.id;
                const ids = (d.admin_user_ids || '')
                    .split(',')
                    .map((x) => Number(x.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0);
                if (!ids.includes(u.id))
                    ids.push(u.id);
                d.admin_user_ids = Array.from(new Set(ids)).join(',');
                if (u.developer_level === 'market')
                    u.developer_level = 'project';
                if (!u.primary_department_id) {
                    u.primary_department_id = d.id;
                    u.department_joined_at = u.department_joined_at || t;
                }
            }
            else if (d.head_user_id === u.id) {
                d.head_user_id = 0;
                removedHead = true;
            }
            d.updated_at = t;
        }
        // 卸任所有部门负责人后，圆桌成员自动退出并释放席位
        if (removedHead &&
            u.developer_level === 'roundtable' &&
            headDepartmentsOf(u.id).length === 0) {
            releaseRoundtableSeat(u, { reason: '卸任部门负责人', by: adminName(req) });
        }
        if (u.developer_level === 'project' || u.developer_level === 'roundtable') {
            await syncUnissoDeveloper(u);
        }
    }
    // 角色关系是唯一事实来源：把用户邮箱从不再勾选的部门 legacy 管理员名单中移除，
    // 否则旧邮箱白名单会让「取消部门管理员」失效。
    if (Array.isArray(b.department_admin_ids) || Array.isArray(b.head_department_ids)) {
        const wanted = new Set();
        if (Array.isArray(b.department_admin_ids)) {
            for (const x of b.department_admin_ids) {
                const n = Number(x);
                if (Number.isFinite(n) && n > 0)
                    wanted.add(n);
            }
        }
        if (Array.isArray(b.head_department_ids)) {
            for (const x of b.head_department_ids) {
                const n = Number(x);
                if (Number.isFinite(n) && n > 0)
                    wanted.add(n);
            }
        }
        const email = (u.email || '').trim().toLowerCase();
        if (email) {
            for (const d of s.departments) {
                if (wanted.has(d.id))
                    continue;
                const list = (d.admin_emails || '')
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .filter((x) => x.toLowerCase() !== email);
                d.admin_emails = list.join(',');
                d.updated_at = t;
            }
        }
    }
    await db.persist();
    ok(res, mapAdminUser(u), '用户权限已更新');
});
/** 人事调整：身份层级 / 归属部门 / 账号状态 */
adminRouter.patch('/users/:id/identity', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const s = db.getStore();
    const u = s.users.find((x) => x.id === Number(req.params.id));
    if (!u) {
        fail(res, 404, '用户不存在');
        return;
    }
    const b = (req.body || {});
    const t = now();
    if (b.developer_bio != null)
        u.developer_bio = str(b.developer_bio, 3000);
    if (b.developer_skills != null)
        u.developer_skills = str(b.developer_skills, 500);
    if (b.developer_links != null)
        u.developer_links = str(b.developer_links, 1000);
    if (b.status != null) {
        const status = String(b.status);
        if (status !== 'active' && status !== 'exited') {
            fail(res, 400, '账号状态不合法');
            return;
        }
        if (status === 'exited' && u.developer_level === 'roundtable') {
            releaseRoundtableSeat(u, { reason: '管理员将账号设为已退出', by: adminName(req) });
        }
        u.status = status;
        if (status === 'exited')
            leaveDepartment(u, '账号已退出开发者体系');
    }
    if (b.primary_department_id != null) {
        const deptId = Number(b.primary_department_id) || 0;
        const dept = s.departments.find((d) => d.id === deptId);
        if (deptId && !dept) {
            fail(res, 400, '部门不存在');
            return;
        }
        if (!deptId) {
            leaveDepartment(u, '管理员移出部门');
        }
        else if (dept) {
            if (u.developer_level === 'roundtable' && u.primary_department_id !== deptId) {
                const stats = departmentSeatStats(dept);
                if (stats.available <= 0) {
                    fail(res, 400, `目标部门席位已满（${stats.occupied}/${stats.total}），请先调整席位`);
                    return;
                }
            }
            joinDepartment(u, dept, { note: '管理员调整归属部门' });
        }
    }
    if (b.developer_level != null) {
        const level = String(b.developer_level);
        if (!['market', 'project', 'roundtable'].includes(level)) {
            fail(res, 400, '身份层级不合法');
            return;
        }
        if (level === 'roundtable' && u.developer_level !== 'roundtable') {
            if (!u.primary_department_id) {
                fail(res, 400, '进入圆桌必须归属一个部门');
                return;
            }
            const dept = s.departments.find((d) => d.id === u.primary_department_id);
            if (!dept) {
                fail(res, 400, '所属部门不存在');
                return;
            }
            const stats = departmentSeatStats(dept);
            if (stats.available <= 0) {
                fail(res, 400, `该部门席位已满（${stats.occupied}/${stats.total}），请先调整席位`);
                return;
            }
            u.developer_level = 'roundtable';
            u.roundtable_joined_at = t;
        }
        else if (level === 'roundtable') {
            u.developer_level = 'roundtable';
            if (!u.roundtable_joined_at)
                u.roundtable_joined_at = t;
        }
        else {
            if (u.developer_level === 'roundtable') {
                releaseRoundtableSeat(u, { reason: '管理员调整身份层级', by: adminName(req) });
            }
            u.developer_level = level;
            if (level === 'project' && !u.primary_department_id) {
                fail(res, 400, '项目开发者必须归属一个部门');
                return;
            }
            if (level === 'market') {
                leaveDepartment(u, '管理员调整为集市开发者');
            }
        }
        if (level === 'project' || level === 'roundtable') {
            await syncUnissoDeveloper(u);
        }
    }
    await db.persist();
    ok(res, mapAdminUser(u), '人员信息已更新');
});
// ===== 答辩管理 =====
function defenseListScope(req, d) {
    const ctx = getAdminContext(req);
    if (ctx.global)
        return true;
    if (ctx.resourceReviewer && d.status === 'level3')
        return true;
    if (ctx.departmentIds.includes(d.department_id))
        return true;
    return db
        .getStore()
        .defense_reviews.some((r) => r.defense_id === d.id && r.reviewer_user_id && r.reviewer_user_id === ctx.user?.id);
}
adminRouter.get('/defenses', (req, res) => {
    const s = db.getStore();
    const ctx = getAdminContext(req);
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();
    const mine = String(req.query.mine || '') === '1';
    let rows = s.defenses.filter((d) => defenseListScope(req, d));
    if (status)
        rows = rows.filter((d) => d.status === status);
    if (q) {
        rows = rows.filter((d) => {
            const u = s.users.find((x) => x.id === d.applicant_user_id);
            return [d.title, d.department_name, u?.name, u?.email, u?.developer_no]
                .join(' ')
                .toLowerCase()
                .includes(q);
        });
    }
    if (mine && ctx.user) {
        const ids = new Set(s.defense_reviews
            .filter((r) => r.reviewer_user_id === ctx.user.id && r.status === 'pending')
            .map((r) => r.defense_id));
        rows = rows.filter((d) => ids.has(d.id));
    }
    rows = rows.sort((a, b) => b.id - a.id);
    ok(res, rows.map((d) => {
        const view = defenseView(d);
        return {
            ...view,
            my_pending_reviews: ctx.user
                ? view.reviews.filter((r) => r.status === 'pending' &&
                    (r.reviewer_user_id === ctx.user.id ||
                        (r.reviewer_user_id === 0 && (ctx.global || ctx.resourceReviewer))))
                : [],
        };
    }));
});
adminRouter.get('/defenses/pending-reviews', (req, res) => {
    const ctx = getAdminContext(req);
    if (!ctx.user) {
        fail(res, 403, '未登录');
        return;
    }
    const s = db.getStore();
    const rows = s.defense_reviews
        .filter((r) => r.status === 'pending' &&
        (r.reviewer_user_id === ctx.user.id ||
            (r.reviewer_user_id === 0 && (ctx.global || ctx.resourceReviewer || ctx.departmentIds.length))))
        .map((r) => {
        const d = s.defenses.find((x) => x.id === r.defense_id);
        return d ? { ...r, defense: defenseView(d) } : null;
    })
        .filter(Boolean);
    ok(res, rows);
});
adminRouter.get('/defenses/:id', (req, res) => {
    const d = db.getStore().defenses.find((x) => x.id === Number(req.params.id));
    if (!d) {
        fail(res, 404, '答辩不存在');
        return;
    }
    const ctx = getAdminContext(req);
    if (!ctx.user || !canViewDefense(ctx.user, d)) {
        fail(res, 403, '无权查看该答辩');
        return;
    }
    ok(res, defenseView(d));
});
adminRouter.post('/defenses/:id/reviews/:reviewId', async (req, res) => {
    const ctx = getAdminContext(req);
    if (!ctx.user) {
        fail(res, 403, '未登录');
        return;
    }
    const review = db
        .getStore()
        .defense_reviews.find((r) => r.id === Number(req.params.reviewId) && r.defense_id === Number(req.params.id));
    if (!review) {
        fail(res, 404, '评审任务不存在');
        return;
    }
    const b = (req.body || {});
    const result = submitReview(ctx.user, review, {
        decision: String(b.decision || ''),
        score: b.score == null ? undefined : Number(b.score),
        opinion: String(b.opinion || ''),
    });
    if (result.error) {
        fail(res, 400, result.error);
        return;
    }
    await db.persist();
    ok(res, result.defense ? defenseView(result.defense) : null, '评审已提交');
});
adminRouter.post('/defenses/:id/decide', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const d = db.getStore().defenses.find((x) => x.id === Number(req.params.id));
    if (!d) {
        fail(res, 404, '答辩不存在');
        return;
    }
    const b = (req.body || {});
    const decision = String(b.decision || '');
    if (decision !== 'pass' && decision !== 'reject') {
        fail(res, 400, '裁决结果不合法');
        return;
    }
    const result = forceDecide(d, decision, str(b.note, 2000), adminName(req));
    if (result.error) {
        fail(res, 400, result.error);
        return;
    }
    await db.persist();
    ok(res, defenseView(d), decision === 'pass' ? '已裁决通过' : '已裁决未通过');
});
adminRouter.post('/defenses/:id/reassign', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const s = db.getStore();
    const d = s.defenses.find((x) => x.id === Number(req.params.id));
    if (!d) {
        fail(res, 404, '答辩不存在');
        return;
    }
    const b = (req.body || {});
    const review = s.defense_reviews.find((r) => r.id === Number(b.review_id) && r.defense_id === d.id && r.status === 'pending');
    if (!review) {
        fail(res, 404, '待评审任务不存在');
        return;
    }
    const reviewerId = Number(b.reviewer_user_id) || 0;
    const reviewer = reviewerId
        ? s.users.find((u) => u.id === reviewerId && u.status === 'active')
        : null;
    if (reviewerId && !reviewer) {
        fail(res, 400, '评审人不存在');
        return;
    }
    review.reviewer_user_id = reviewer ? reviewer.id : 0;
    review.reviewer_name = reviewer ? reviewer.name || reviewer.email : '待认领';
    ok(res, defenseView(d), '评审人已调整');
});
// ===== 圆桌 / 年度复审 / 席位 =====
adminRouter.get('/roundtable', (req, res) => {
    const ctx = getAdminContext(req);
    if (!ctx.global && !ctx.departmentIds.length) {
        fail(res, 403, '无圆桌管理权限');
        return;
    }
    const s = db.getStore();
    let depts = s.departments;
    if (!ctx.global)
        depts = depts.filter((d) => ctx.departmentIds.includes(d.id));
    const seats = depts.map((d) => ({
        department: { id: d.id, name: d.name, slug: d.slug, color: d.color },
        ...departmentSeatStats(d),
        base: d.base_seats,
        floating: d.floating_seats,
    }));
    const members = s.users
        .filter((u) => u.developer_level === 'roundtable' &&
        (ctx.global || ctx.departmentIds.includes(u.primary_department_id)))
        .sort((a, b) => a.primary_department_id - b.primary_department_id || a.id - b.id)
        .map((u) => {
        const dept = s.departments.find((d) => d.id === u.primary_department_id);
        const reviews = s.seat_reviews
            .filter((r) => r.user_id === u.id)
            .sort((a, b) => b.year - a.year || b.id - a.id);
        return {
            ...mapAdminUser(u),
            department: dept ? { id: dept.id, name: dept.name, slug: dept.slug, color: dept.color } : null,
            last_review: reviews[0] || null,
        };
    });
    const waitlist = s.defenses
        .filter((d) => d.status === 'waitlist' &&
        (ctx.global || ctx.departmentIds.includes(d.department_id)))
        .sort((a, b) => a.id - b.id)
        .map((d) => defenseView(d));
    ok(res, { seats, members, waitlist, seat_reviews: s.seat_reviews.slice(-100).reverse() });
});
adminRouter.post('/roundtable/:userId/review', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const s = db.getStore();
    const u = s.users.find((x) => x.id === Number(req.params.userId));
    if (!u) {
        fail(res, 404, '用户不存在');
        return;
    }
    if (u.developer_level !== 'roundtable') {
        fail(res, 400, '该用户不是圆桌开发者');
        return;
    }
    const b = (req.body || {});
    const year = Number(b.year) || new Date().getFullYear();
    const score = Number(b.output_score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
        fail(res, 400, '产出评分需为 0-100');
        return;
    }
    const passed = b.passed === true || b.passed === 1 || String(b.passed) === 'true';
    const row = recordSeatReview(u, { year, outputScore: score, passed, note: str(b.note, 2000) }, adminName(req));
    await db.persist();
    ok(res, row, passed ? '年度复审已记录（保留席位）' : '年度复审未达标，已退出圆桌并释放席位');
});
adminRouter.post('/roundtable/:userId/exit', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const s = db.getStore();
    const u = s.users.find((x) => x.id === Number(req.params.userId));
    if (!u) {
        fail(res, 404, '用户不存在');
        return;
    }
    if (u.developer_level !== 'roundtable') {
        fail(res, 400, '该用户不是圆桌开发者');
        return;
    }
    const b = (req.body || {});
    const row = releaseRoundtableSeat(u, {
        reason: str(b.reason, 2000) || '卸任负责人 / 主动退出圆桌',
        by: adminName(req),
        year: Number(b.year) || undefined,
        outputScore: b.output_score == null ? undefined : Number(b.output_score),
    });
    await db.persist();
    ok(res, row, '已退出圆桌，席位已释放并自动递补候补者');
});
adminRouter.post('/roundtable/promote', async (req, res) => {
    if (!ensureGlobal(req, res))
        return;
    const departmentId = Number((req.body || {}).department_id) || 0;
    if (!departmentId) {
        fail(res, 400, '请指定部门');
        return;
    }
    const count = promoteWaitlist(departmentId);
    await db.persist();
    ok(res, { promoted: count }, count ? `已递补 ${count} 人` : '当前没有可递补的候补者');
});
// ===== 技术部会议 / 席位与晋升公示（仅超级管理员） =====
adminRouter.use('/publicities', requireGlobalAdmin);
function parseSeats(v) {
    if (!Array.isArray(v))
        return currentSeatTable();
    return v
        .map((x) => {
        const r = (x || {});
        const base = Math.max(1, num(r.base, 1, 9999, 1));
        const floating = num(r.floating, 0, 9999, 0);
        return {
            department_id: num(r.department_id, 0, 999999, 0),
            department_name: str(r.department_name, 60),
            base,
            floating,
            total: base + floating,
            delivery: num(r.delivery, 0, 100, 0),
            usage: num(r.usage, 0, 100, 0),
            talent: num(r.talent, 0, 100, 0),
            activity: num(r.activity, 0, 100, 0),
        };
    })
        .filter((x) => x.department_name);
}
function parsePromotions(v) {
    if (!Array.isArray(v))
        return [];
    return v
        .map((x) => {
        const r = (x || {});
        return {
            user_id: num(r.user_id, 0, 999999, 0),
            name: str(r.name, 60),
            developer_no: str(r.developer_no, 40),
            department_name: str(r.department_name, 60),
            result: str(r.result, 40),
            note: str(r.note, 2000),
        };
    })
        .filter((x) => x.name);
}
adminRouter.get('/publicities', (_req, res) => {
    const rows = [...db.getStore().publicities]
        .sort((a, b) => (b.meeting_date || '').localeCompare(a.meeting_date || '') || b.id - a.id)
        .map(publicityView);
    ok(res, rows);
});
adminRouter.get('/publicities/draft', (req, res) => {
    const since = String(req.query.since || lastPublicityDate() || '');
    const meetingDate = new Date().toISOString().slice(0, 10);
    const seats = currentSeatTable();
    const promotions = recentPromotions(since);
    const title = `${new Date().getFullYear()} 技术部会议公示`;
    ok(res, {
        title,
        meeting_date: meetingDate,
        since,
        seats,
        promotions,
        content: buildPublicityContent({ title, meeting_date: meetingDate, summary: '', seats, promotions }),
    });
});
adminRouter.post('/publicities', async (req, res) => {
    const b = (req.body || {});
    const s = db.getStore();
    const title = str(b.title, 120) || `${new Date().getFullYear()} 技术部会议公示`;
    const meeting_date = str(b.meeting_date, 20) || new Date().toISOString().slice(0, 10);
    const summary = str(b.summary, 4000);
    const seats = parseSeats(b.seats);
    const promotions = Array.isArray(b.promotions) ? parsePromotions(b.promotions) : recentPromotions(lastPublicityDate());
    const t = now();
    const row = {
        id: db.nextId('publicities'),
        ...makePublicityRow({ title, meeting_date, summary, seats, promotions, published: b.published !== false }, adminName(req)),
        created_at: t,
        updated_at: t,
    };
    s.publicities.push(row);
    if (row.published === 1)
        applyPublicityToDepartments(seats);
    await db.persist();
    ok(res, publicityView(row), row.published === 1 ? '公示已发布' : '公示草稿已保存');
});
adminRouter.put('/publicities/:id', async (req, res) => {
    const s = db.getStore();
    const row = s.publicities.find((p) => p.id === Number(req.params.id));
    if (!row) {
        fail(res, 404, '公示不存在');
        return;
    }
    const b = (req.body || {});
    if (b.title != null)
        row.title = str(b.title, 120) || row.title;
    if (b.meeting_date != null)
        row.meeting_date = str(b.meeting_date, 20) || row.meeting_date;
    if (b.summary != null)
        row.summary = str(b.summary, 4000);
    const seats = Array.isArray(b.seats) ? parseSeats(b.seats) : JSON.parse(row.seats_json || '[]');
    const promotions = Array.isArray(b.promotions)
        ? parsePromotions(b.promotions)
        : JSON.parse(row.promotions_json || '[]');
    row.seats_json = JSON.stringify(seats);
    row.promotions_json = JSON.stringify(promotions);
    row.content = buildPublicityContent({
        title: row.title,
        meeting_date: row.meeting_date,
        summary: row.summary,
        seats,
        promotions,
    });
    if (b.published != null)
        row.published = b.published === false ? 0 : 1;
    touchPublicity(row);
    if (row.published === 1)
        applyPublicityToDepartments(seats);
    await db.persist();
    ok(res, publicityView(row), row.published === 1 ? '公示已发布' : '公示已更新');
});
adminRouter.delete('/publicities/:id', async (req, res) => {
    const s = db.getStore();
    const idx = s.publicities.findIndex((p) => p.id === Number(req.params.id));
    if (idx < 0) {
        fail(res, 404, '公示不存在');
        return;
    }
    s.publicities.splice(idx, 1);
    await db.persist();
    ok(res, { id: Number(req.params.id) }, '公示已删除');
});
// ===== 常见问题管理（仅超级管理员） =====
adminRouter.use('/faqs', requireGlobalAdmin);
function mapFaq(f) {
    return { ...f };
}
adminRouter.get('/faqs', (_req, res) => {
    const rows = [...db.getStore().faqs].sort((a, b) => a.category.localeCompare(b.category, 'zh-CN') ||
        a.sort_order - b.sort_order ||
        a.id - b.id);
    ok(res, rows.map(mapFaq));
});
adminRouter.post('/faqs', async (req, res) => {
    const b = (req.body || {});
    const question = str(b.question, 200);
    const answer = str(b.answer, 5000);
    if (!question || !answer) {
        fail(res, 400, '问题和答案必填');
        return;
    }
    const t = now();
    const row = {
        id: db.nextId('faqs'),
        category: str(b.category, 40) || '其他',
        question,
        answer,
        sort_order: num(b.sort_order, -9999, 9999, 0),
        enabled: b.enabled === false || b.enabled === 0 ? 0 : 1,
        created_at: t,
        updated_at: t,
    };
    db.getStore().faqs.push(row);
    await db.persist();
    ok(res, mapFaq(row), '问题已创建');
});
adminRouter.put('/faqs/:id', async (req, res) => {
    const f = db.getStore().faqs.find((x) => x.id === Number(req.params.id));
    if (!f) {
        fail(res, 404, '问题不存在');
        return;
    }
    const b = (req.body || {});
    if (b.category != null)
        f.category = str(b.category, 40) || '其他';
    if (b.question != null)
        f.question = str(b.question, 200) || f.question;
    if (b.answer != null)
        f.answer = str(b.answer, 5000);
    if (b.sort_order != null)
        f.sort_order = num(b.sort_order, -9999, 9999, f.sort_order);
    if (b.enabled != null)
        f.enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
    f.updated_at = now();
    await db.persist();
    ok(res, mapFaq(f), '问题已更新');
});
adminRouter.delete('/faqs/:id', async (req, res) => {
    const s = db.getStore();
    const id = Number(req.params.id);
    const idx = s.faqs.findIndex((f) => f.id === id);
    if (idx < 0) {
        fail(res, 404, '问题不存在');
        return;
    }
    s.faqs.splice(idx, 1);
    await db.persist();
    ok(res, { id }, '问题已删除');
});
// ===== 统计 =====
adminRouter.get('/stats', (req, res) => {
    const s = db.getStore();
    const ctx = getAdminContext(req);
    const jobs = s.jobs.filter((j) => ctx.global || ctx.departmentIds.includes(j.department_id));
    const jobIds = new Set(jobs.map((j) => j.id));
    const apps = s.applications.filter((a) => jobIds.has(a.job_id));
    const scopedUserIds = new Set(ctx.global
        ? s.users.map((u) => u.id)
        : s.users
            .filter((u) => ctx.departmentIds.includes(u.primary_department_id))
            .map((u) => u.id));
    const defenses = s.defenses.filter((d) => ctx.global || ctx.departmentIds.includes(d.department_id));
    ok(res, {
        jobs: jobs.length,
        openJobs: jobs.filter((j) => j.enabled === 1).length,
        departments: ctx.global ? s.departments.length : ctx.departments.length,
        applications: apps.length,
        pendingReview: apps.filter((a) => a.stage === 'submitted' || a.stage === 'interview').length,
        offered: apps.filter((a) => a.stage === 'offered').length,
        joined: apps.filter((a) => a.stage === 'joined').length,
        passed: apps.filter((a) => a.status === 'passed').length,
        rejected: apps.filter((a) => a.status === 'rejected').length,
        oaApproved: apps.filter((a) => a.oa_status === 'approved').length,
        users: scopedUserIds.size,
        developers: s.users.filter((u) => u.status === 'active' && u.developer_level !== 'market' && scopedUserIds.has(u.id)).length,
        roundtable: s.users.filter((u) => u.developer_level === 'roundtable' && scopedUserIds.has(u.id)).length,
        defenses: defenses.length,
        defensesOpen: defenses.filter((d) => ['submitted', 'level1', 'level2', 'level3', 'waitlist'].includes(d.status)).length,
        defensesPassed: defenses.filter((d) => d.status === 'passed').length,
        resumes: ctx.global
            ? s.resumes.length
            : new Set(apps.map((a) => a.resume_id).filter(Boolean)).size,
        faqs: ctx.global ? s.faqs.length : 0,
    });
});
// ===== 站点文案配置（仅超级管理员） =====
adminRouter.use('/site', requireGlobalAdmin);
adminRouter.get('/site', (_req, res) => {
    ok(res, db.getStore().site_config);
});
const SITE_FIELDS = [
    'brand',
    'heroTitle',
    'heroSubtitle',
    'announcement',
    'tagline',
    'contactEmail',
    'bgWords',
    'teamTitle',
    'teamIntro',
    'teamHighlights',
    'adminSubs',
];
adminRouter.put('/site', async (req, res) => {
    const b = (req.body || {});
    const s = db.getStore();
    const sc = s.site_config;
    for (const key of SITE_FIELDS) {
        if (b[key] == null)
            continue;
        const max = key === 'teamIntro'
            ? 4000
            : key === 'teamHighlights'
                ? 800
                : key === 'heroSubtitle' || key === 'bgWords'
                    ? 300
                    : key === 'adminSubs'
                        ? 2000
                        : 120;
        const val = String(b[key]).slice(0, max);
        if (key === 'contactEmail' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            fail(res, 400, '联系邮箱格式不正确');
            return;
        }
        if (key === 'adminSubs') {
            const list = val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            for (const sub of list) {
                if (!/^[A-Za-z0-9._:-]{8,128}$/.test(sub)) {
                    fail(res, 400, `管理员 sub 格式不正确：${sub}`);
                    return;
                }
            }
            sc[key] = list.join(',');
            continue;
        }
        sc[key] = val;
    }
    sc.updated_at = now();
    await db.persist();
    ok(res, sc, '站点配置已更新');
});
