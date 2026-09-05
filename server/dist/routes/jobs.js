import { Router } from 'express';
import { db, now } from '../db.js';
import { ok, fail } from '../middleware.js';
import { config } from '../config.js';
export const jobsRouter = Router();
function mapJobPublic(job) {
    return {
        id: job.id,
        slug: job.slug,
        title: job.title,
        department: job.department,
        location: job.location,
        type: job.type,
        summary: job.summary,
        description: job.description,
        headcount: job.headcount,
        createdAt: job.created_at,
    };
}
/** GET /api/jobs — 开放的职位列表（仅 enabled） */
jobsRouter.get('/', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    let rows = db
        .getStore()
        .jobs.filter((j) => j.enabled === 1)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    if (q) {
        rows = rows.filter((j) => j.title.toLowerCase().includes(q) ||
            j.department.toLowerCase().includes(q) ||
            j.summary.toLowerCase().includes(q));
    }
    ok(res, rows.map(mapJobPublic));
});
/** GET /api/jobs/:slug — 单个职位详情 */
jobsRouter.get('/:slug', (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const job = db.getStore().jobs.find((j) => j.slug === slug && j.enabled === 1);
    if (!job) {
        fail(res, 404, '职位不存在或已关闭');
        return;
    }
    ok(res, mapJobPublic(job));
});
/**
 * POST /api/jobs/:slug/apply — 投递
 * 初审状态为 pending；后续由管理端「通过」后自动推送到开发者平台 OA 审批。
 */
jobsRouter.post('/:slug/apply', async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const job = db.getStore().jobs.find((j) => j.slug === slug && j.enabled === 1);
    if (!job) {
        fail(res, 404, '职位不存在或已关闭');
        return;
    }
    const b = (req.body || {});
    const name = String(b.name || '').trim().slice(0, 50);
    const contact = String(b.contact || '').trim().slice(0, 200);
    const resumeUrl = String(b.resume_url || b.resumeUrl || '').trim().slice(0, 500);
    const note = String(b.note || '').trim().slice(0, 2000);
    if (!contact) {
        fail(res, 400, '联系方式必填');
        return;
    }
    // 简单校验邮箱或手机号（松散规则，不阻塞投递）
    if (!/@/.test(contact) && !/^1[3-9]\d{9}$/.test(contact)) {
        fail(res, 400, '联系方式格式不正确（请填邮箱或手机号）');
        return;
    }
    if (resumeUrl && !/^https?:\/\//i.test(resumeUrl)) {
        fail(res, 400, '简历链接必须是 http(s) 链接');
        return;
    }
    const t = now();
    const row = {
        id: db.nextId('applications'),
        job_id: job.id,
        name,
        contact,
        resume_url: resumeUrl,
        note,
        status: 'pending',
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
    ok(res, { id: row.id, status: row.status, message: '投递成功，请等待联系' });
});
/** 提交时引用（供 admin 路由复用 OA push 逻辑） */
export function buildOaBody(app, job) {
    return {
        oaid: `join-${app.id}`,
        title: `录用申请：${job.title}（${app.name || '匿名'}）`,
        content: [
            app.name ? `候选人：${app.name}` : '候选人：（未填写）',
            `联系方式：${app.contact}`,
            app.resume_url ? `简历：${app.resume_url}` : '',
            app.note ? `自述：${app.note}` : '',
        ]
            .filter(Boolean)
            .join('\n'),
        extra: {
            jobId: job.id,
            jobSlug: job.slug,
            jobTitle: job.title,
            applicationId: app.id,
            source: 'join-platform',
            publicUrl: `${config.publicBase}/jobs/${job.slug}`,
        },
    };
}
