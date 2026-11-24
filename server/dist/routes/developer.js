import fs from 'node:fs';
import { Router } from 'express';
import { db, now } from '../db.js';
import { fail, getCurrentUser, ok, requireUser } from '../middleware.js';
import { DeveloperPlatformError, listProjects, submitApplication, } from '../services/developer-platform.js';
import { resumeAbsolutePath, resumePublicUrl, verifyResumeToken } from '../services/resume-link.js';
export const developerRouter = Router();
const MAX_NOTE = 500;
const MAX_TITLE = 200;
function parseIntParam(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, Math.trunc(n)));
}
function str(value, max) {
    return String(value ?? '').trim().slice(0, max);
}
/** 把开发者平台的错误翻译成 join 前端能看懂的提示 */
function translateError(e) {
    if (!(e instanceof DeveloperPlatformError)) {
        return { status: 500, message: e instanceof Error ? e.message : '开发者平台调用失败' };
    }
    switch (e.status) {
        case 401:
            return { status: 502, message: '开发者平台拒绝接入密钥，请联系管理员检查 JOIN_API_KEY' };
        case 409:
            return { status: 409, message: '你已经是该项目的成员' };
        case 404:
            if (e.code === 'USER_NOT_FOUND') {
                return { status: 404, message: '统一身份账号在开发者平台不存在，请先登录一次开发者平台' };
            }
            if (e.code === 'PROJECT_NOT_FOUND')
                return { status: 404, message: '项目不存在' };
            return {
                status: 404,
                message: '开发者平台尚未提供项目接入（/api/join），请确认已部署新版开发者平台',
            };
        case 503:
            return { status: 503, message: e.message };
        default:
            return e.status >= 500
                ? { status: 502, message: `开发者平台暂时不可用：${e.message}` }
                : { status: 400, message: e.message };
    }
}
function currentUser(req) {
    return getCurrentUser(req);
}
function mapApplication(row, resumeTitle) {
    return {
        id: row.id,
        project_id: row.project_id,
        project_title: row.project_title,
        apply_id: row.apply_id,
        status: row.status,
        duplicate: row.duplicate === 1,
        reopened: row.reopened === 1,
        note: row.note,
        resume_id: row.resume_id,
        resume_title: resumeTitle,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
/** 项目广场：公开可浏览，方便未登录用户先看看有哪些项目 */
developerRouter.get('/projects', async (req, res) => {
    const q = str(req.query.q, 100);
    const page = parseIntParam(req.query.page, 1, 1, 100000);
    const pageSize = parseIntParam(req.query.pageSize, 20, 1, 100);
    try {
        ok(res, await listProjects({ q, page, pageSize }));
    }
    catch (e) {
        const { status, message } = translateError(e);
        fail(res, status, message);
    }
});
/** 我提交过的项目申请（本地留档；开发者平台侧没有查询接口） */
developerRouter.get('/applications', requireUser, (req, res) => {
    const user = currentUser(req);
    const store = db.getStore();
    const rows = store.dev_applications
        .filter((row) => row.user_id === user.id)
        .sort((a, b) => b.id - a.id);
    ok(res, rows.map((row) => {
        const resume = store.resumes.find((r) => r.id === row.resume_id);
        return mapApplication(row, resume?.title || '');
    }));
});
/** 代用户向开发者平台提交 participant 申请 */
developerRouter.post('/applications', requireUser, async (req, res) => {
    const user = currentUser(req);
    const body = (req.body || {});
    const projectId = Number(body.project_id);
    const resumeId = Number(body.resume_id);
    const note = str(body.note, MAX_NOTE);
    const projectTitle = str(body.project_title, MAX_TITLE) || `项目 #${projectId}`;
    if (!Number.isInteger(projectId) || projectId <= 0) {
        fail(res, 400, 'project_id 必须是正整数');
        return;
    }
    if (!Number.isInteger(resumeId) || resumeId <= 0) {
        fail(res, 400, '请选择一份简历');
        return;
    }
    const ssoSub = (user.sso_sub || '').trim();
    if (!ssoSub) {
        fail(res, 400, '当前账号没有关联统一身份，请先用集市统一身份登录后再申请');
        return;
    }
    const store = db.getStore();
    const resume = store.resumes.find((r) => r.id === resumeId && r.user_id === user.id);
    if (!resume) {
        fail(res, 404, '简历不存在');
        return;
    }
    if (!resume.file_path) {
        fail(res, 400, '该简历没有 PDF 附件，请先上传 PDF 简历');
        return;
    }
    const resumeUrl = resumePublicUrl(resume.id);
    if (!resumeUrl) {
        fail(res, 503, '简历外链签名密钥未配置，暂时无法提交');
        return;
    }
    let result;
    try {
        result = await submitApplication({
            ssoSub,
            projectId,
            resumeUrl,
            ...(note ? { note } : {}),
        });
    }
    catch (e) {
        const { status, message } = translateError(e);
        fail(res, status, message);
        return;
    }
    const t = now();
    const existing = store.dev_applications.find((row) => row.user_id === user.id && row.project_id === projectId);
    let row;
    if (existing) {
        existing.sso_sub = ssoSub;
        existing.project_title = projectTitle;
        existing.apply_id = result.id;
        existing.status = result.status;
        existing.duplicate = result.duplicate ? 1 : 0;
        existing.reopened = result.reopened ? 1 : 0;
        existing.note = note;
        existing.resume_id = resume.id;
        existing.resume_url = resumeUrl;
        existing.updated_at = t;
        await db.persist();
        row = existing;
    }
    else {
        row = await db.insert('dev_applications', {
            user_id: user.id,
            sso_sub: ssoSub,
            project_id: projectId,
            project_title: projectTitle,
            apply_id: result.id,
            status: result.status,
            duplicate: result.duplicate ? 1 : 0,
            reopened: result.reopened ? 1 : 0,
            note,
            resume_id: resume.id,
            resume_url: resumeUrl,
            created_at: t,
            updated_at: t,
        });
    }
    const message = result.status === 'accepted'
        ? '你已经是该项目成员'
        : result.reopened
            ? '已重新提交申请，等待项目 leader 审批'
            : result.duplicate
                ? '申请已存在，等待项目 leader 审批'
                : '申请已提交，等待项目 leader 审批';
    ok(res, mapApplication(row, resume.title), message);
});
/**
 * 简历外链（公开，凭签名访问）。
 * 开发者平台的 leader 在另一个站点打开这个地址，不能要求 join 的登录态。
 */
developerRouter.get('/resumes/:token', (req, res) => {
    const resumeId = verifyResumeToken(String(req.params.token || ''));
    if (!resumeId) {
        fail(res, 403, '链接无效或已过期');
        return;
    }
    const resume = db.getStore().resumes.find((r) => r.id === resumeId);
    if (!resume) {
        fail(res, 404, '简历不存在');
        return;
    }
    const abs = resumeAbsolutePath(resume.file_path);
    if (!abs || !fs.existsSync(abs)) {
        fail(res, 404, '附件文件不存在');
        return;
    }
    const encoded = encodeURIComponent(resume.file_name || 'resume.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="resume.pdf"; filename*=UTF-8''${encoded}`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(abs);
});
