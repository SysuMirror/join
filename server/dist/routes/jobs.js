import { Router } from 'express';
import { db, now } from '../db.js';
import { ok, fail, requireUser, getCurrentUser } from '../middleware.js';
import { config } from '../config.js';
import { ensureDeveloperProfile } from '../services/org.js';
export const jobsRouter = Router();
function tagsOf(job) {
    return (job.tags || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12);
}
function mapJobPublic(job) {
    const dept = db.getStore().departments.find((d) => d.id === job.department_id);
    return {
        id: job.id,
        slug: job.slug,
        title: job.title,
        department_id: job.department_id,
        department: dept?.name || job.department,
        department_slug: dept?.slug || '',
        direction: job.direction,
        location: job.location,
        type: job.type,
        experience: job.experience,
        education: job.education,
        salary: job.salary,
        contact_wechat: job.contact_wechat || '',
        tags: tagsOf(job),
        summary: job.summary,
        responsibilities: job.responsibilities || job.description,
        requirements: job.requirements,
        bonus: job.bonus,
        description: job.description,
        headcount: job.headcount,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
    };
}
function matchDepartment(job, key) {
    const s = db.getStore();
    const dept = s.departments.find((d) => d.slug === key || String(d.id) === key || d.name === key);
    if (dept)
        return job.department_id === dept.id;
    return (job.department || '') === key;
}
/** GET /api/jobs — 开放的职位列表（支持筛选/搜索） */
jobsRouter.get('/', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const direction = String(req.query.direction || '').trim();
    const department = String(req.query.department || '').trim();
    const type = String(req.query.type || '').trim();
    const location = String(req.query.location || '').trim();
    const sort = String(req.query.sort || '').trim();
    let rows = db.getStore().jobs.filter((j) => j.enabled === 1);
    if (q) {
        rows = rows.filter((j) => [j.title, j.department, j.summary, j.tags, j.description, j.responsibilities]
            .join(' ')
            .toLowerCase()
            .includes(q));
    }
    if (direction)
        rows = rows.filter((j) => j.direction === direction);
    if (department)
        rows = rows.filter((j) => matchDepartment(j, department));
    if (type)
        rows = rows.filter((j) => j.type === type);
    if (location)
        rows = rows.filter((j) => (j.location || '') === location);
    rows = [...rows].sort((a, b) => {
        if (sort === 'latest')
            return b.updated_at.localeCompare(a.updated_at) || b.id - a.id;
        return a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at) || a.id - b.id;
    });
    ok(res, rows.map(mapJobPublic));
});
/** GET /api/jobs/meta — 筛选项 */
jobsRouter.get('/meta', (_req, res) => {
    const s = db.getStore();
    const jobs = s.jobs.filter((j) => j.enabled === 1);
    const directions = Array.from(new Set(jobs.map((j) => j.direction).filter(Boolean))).sort();
    const locations = Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))).sort();
    const departments = s.departments
        .filter((d) => d.enabled === 1)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        summary: d.summary,
        color: d.color,
        openJobs: jobs.filter((j) => j.department_id === d.id).length,
    }));
    ok(res, { directions, locations, departments, types: ['fulltime', 'intern', 'parttime'] });
});
/** GET /api/jobs/:slug — 单个职位详情（含相关职位） */
jobsRouter.get('/:slug', (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const s = db.getStore();
    const job = s.jobs.find((j) => j.slug === slug && j.enabled === 1);
    if (!job) {
        fail(res, 404, '岗位不存在或已关闭');
        return;
    }
    const dept = s.departments.find((d) => d.id === job.department_id);
    const related = s.jobs
        .filter((j) => j.enabled === 1 &&
        j.id !== job.id &&
        (j.department_id === job.department_id || j.direction === job.direction))
        .slice(0, 4)
        .map(mapJobPublic);
    ok(res, {
        ...mapJobPublic(job),
        departmentInfo: dept
            ? {
                id: dept.id,
                name: dept.name,
                slug: dept.slug,
                summary: dept.summary,
                description: dept.description,
                color: dept.color,
            }
            : null,
        related,
    });
});
/**
 * POST /api/jobs/:slug/apply — 投递（需登录，使用本人简历）
 * 双选流程：submitted → 部门约沟通/通过（offered）→ 本人确认（joined）。
 */
jobsRouter.post('/:slug/apply', requireUser, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const s = db.getStore();
    const job = s.jobs.find((j) => j.slug === slug && j.enabled === 1);
    if (!job) {
        fail(res, 404, '岗位不存在或已关闭');
        return;
    }
    const user = getCurrentUser(req);
    if (!user) {
        fail(res, 401, '未登录');
        return;
    }
    // 底座身份：任何登录用户至少是「软工集市开发者」
    if (ensureDeveloperProfile(user))
        await db.persist();
    if (user.status !== 'active') {
        fail(res, 403, '账号已退出开发者体系');
        return;
    }
    if (user.developer_level === 'roundtable') {
        fail(res, 409, '你已是圆桌开发者，调整归属部门请联系管理员');
        return;
    }
    const dept = s.departments.find((d) => d.id === job.department_id);
    if (dept && user.primary_department_id === dept.id && user.developer_level !== 'market') {
        fail(res, 409, `你已归属「${dept.name}」，无需重复报名`);
        return;
    }
    const b = (req.body || {});
    const resumeId = Number(b.resume_id || b.resumeId || 0);
    const ownResumes = s.resumes.filter((r) => r.user_id === user.id);
    let resume;
    if (resumeId) {
        resume = ownResumes.find((r) => r.id === resumeId);
    }
    else {
        resume = ownResumes.find((r) => r.is_default === 1) || ownResumes.sort((a, b2) => b2.id - a.id)[0];
    }
    if (!resume) {
        fail(res, 400, '请先在「我的简历」中创建或上传一份简历');
        return;
    }
    const exists = s.applications.find((a) => a.job_id === job.id &&
        a.user_id === user.id &&
        !['rejected', 'withdrawn'].includes(a.stage));
    if (exists) {
        fail(res, 409, '你已报名过该岗位，请耐心等待处理；可在「我的报名」查看进度');
        return;
    }
    const note = String(b.note || '').trim().slice(0, 2000);
    const wechat = String(b.wechat || '').trim().slice(0, 60);
    const contact = resume.phone || resume.email || user.email || wechat;
    if (!contact) {
        fail(res, 400, '请至少填写手机号、邮箱或微信号，方便后续联系');
        return;
    }
    const snapshot = {
        title: resume.title,
        name: resume.name,
        phone: resume.phone,
        email: resume.email,
        city: resume.city,
        intention: resume.intention,
        education: resume.education,
        school: resume.school,
        major: resume.major,
        graduation_year: resume.graduation_year,
        experience_years: resume.experience_years,
        skills: resume.skills,
        summary: resume.summary,
        work_experience: resume.work_experience,
        project_experience: resume.project_experience,
        education_experience: resume.education_experience,
        file_name: resume.file_name,
    };
    const t = now();
    const row = {
        id: db.nextId('applications'),
        job_id: job.id,
        user_id: user.id,
        resume_id: resume.id,
        name: resume.name || user.name,
        contact,
        email: resume.email || user.email,
        phone: resume.phone,
        wechat,
        resume_url: '',
        resume_snapshot: JSON.stringify(snapshot),
        note,
        status: 'pending',
        stage: 'submitted',
        interview_at: '',
        interview_note: '',
        confirmed_at: '',
        joined_at: '',
        review_note: '',
        reviewer: '',
        oa_oid: '',
        oa_status: '',
        oa_checked_at: '',
        oa_timeline: '',
        created_at: t,
        updated_at: t,
    };
    await db.insert('applications', row);
    ok(res, { id: row.id, status: row.status, message: '报名成功，请等待联系' }, '报名成功');
});
/** 提交时引用（供 admin 路由复用 OA push 逻辑） */
export function buildOaBody(app, job) {
    let snap = {};
    try {
        snap = app.resume_snapshot ? JSON.parse(app.resume_snapshot) : {};
    }
    catch {
        snap = {};
    }
    const str = (k) => (typeof snap[k] === 'string' ? String(snap[k]) : '');
    const educationLine = [str('school'), str('education'), str('major'), str('graduation_year')]
        .filter(Boolean)
        .join(' · ');
    return {
        oaid: `join-${app.id}`,
        title: `成员申请：${job.title}（${app.name || '匿名'}）`,
        content: [
            app.name ? `报名同学：${app.name}` : '报名同学：（未填写）',
            app.email ? `邮箱：${app.email}` : '',
            app.phone ? `手机：${app.phone}` : '',
            app.wechat ? `微信：${app.wechat}` : '',
            app.contact ? `联系方式：${app.contact}` : '',
            `报名岗位：${job.title}（${job.department || ''}）`,
            educationLine ? `教育背景：${educationLine}` : '',
            str('skills') ? `技能：${str('skills')}` : '',
            str('file_name') ? `简历附件：${str('file_name')}` : '简历：在线简历',
            app.note ? `自述：${app.note}` : '',
        ]
            .filter(Boolean)
            .join('\n'),
        extra: {
            jobId: job.id,
            jobSlug: job.slug,
            jobTitle: job.title,
            department: job.department,
            applicationId: app.id,
            userId: app.user_id,
            resumeId: app.resume_id,
            source: 'join-platform',
            publicUrl: `${config.publicBase}/jobs/${job.slug}`,
        },
    };
}
