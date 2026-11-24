import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, isUnissoConfigured } from '../config.js';
import { updateUnissoDeveloper } from '../unisso.js';
import { syncUnissoDeveloper } from '../services/developer-sync.js';
import { db, now } from '../db.js';
import { ok, fail, requireUser, getCurrentUser, departmentAdminDepartments, } from '../middleware.js';
import { extractPdfText, looksLikePdf } from '../services/pdf.js';
import { parseResumeText } from '../services/resume-parse.js';
import { parseResumeWithAi } from '../services/ai-resume.js';
import { resumeMissingFields } from '../services/resume-check.js';
import { departmentSeatStats, ensureDeveloperProfile, isStaffUser, isSuperAdminUser, joinDepartment, userIdentityView, } from '../services/org.js';
import { canViewDefense, createDefense, defenseView, submitReview, } from '../services/defense.js';
export const meRouter = Router();
function str(v, max) {
    return String(v ?? '')
        .trim()
        .slice(0, max);
}
function num(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n))
        return min;
    return Math.min(max, Math.max(min, Math.round(n)));
}
function parseSnapshot(json) {
    try {
        return json ? JSON.parse(json) : {};
    }
    catch {
        return {};
    }
}
function mapResume(r, withText = false) {
    const missing = resumeMissingFields(r);
    return {
        id: r.id,
        title: r.title,
        name: r.name,
        phone: r.phone,
        email: r.email,
        city: r.city,
        intention: r.intention,
        grade: r.grade,
        education: r.education,
        school: r.school,
        major: r.major,
        graduation_year: r.graduation_year,
        experience_years: r.experience_years,
        skills: r.skills,
        summary: r.summary,
        work_experience: r.work_experience,
        project_experience: r.project_experience,
        education_experience: r.education_experience,
        file_name: r.file_name,
        file_size: r.file_size,
        has_file: Boolean(r.file_path),
        parse_note: r.parse_note,
        parsed_text: withText ? r.parsed_text : undefined,
        complete: missing.length === 0,
        missing_fields: missing,
        is_default: r.is_default === 1,
        created_at: r.created_at,
        updated_at: r.updated_at,
    };
}
function mapApplication(a) {
    const s = db.getStore();
    const job = s.jobs.find((j) => j.id === a.job_id);
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
        id: a.id,
        job_id: a.job_id,
        jobTitle: job?.title || '',
        jobSlug: job?.slug || '',
        department: job?.department || '',
        location: job?.location || '',
        direction: job?.direction || '',
        name: a.name,
        contact: a.contact,
        email: a.email,
        phone: a.phone,
        wechat: a.wechat,
        note: a.note,
        status: a.status,
        stage: a.stage,
        interview_at: a.interview_at,
        interview_note: a.interview_note,
        confirmed_at: a.confirmed_at,
        joined_at: a.joined_at,
        review_note: a.review_note,
        oa_status: a.oa_status,
        oa_oid: a.oa_oid,
        oa_timeline: timeline,
        resume_id: a.resume_id,
        resume_title: resume?.title || str(snap.title, 100),
        resume_file_name: resume?.file_name || str(snap.file_name, 200),
        snapshot: snap,
        created_at: a.created_at,
        updated_at: a.updated_at,
    };
}
function ownResume(userId, id) {
    return db.getStore().resumes.find((r) => r.id === id && r.user_id === userId);
}
function setDefaultResume(userId, id) {
    for (const r of db.getStore().resumes) {
        if (r.user_id === userId)
            r.is_default = r.id === id ? 1 : 0;
    }
}
function resumeFilePath(filePath) {
    if (!filePath)
        return null;
    const root = path.resolve(config.dataDir);
    const abs = path.resolve(root, filePath);
    if (abs !== root && !abs.startsWith(root + path.sep))
        return null;
    return abs;
}
function removeResumeFile(filePath) {
    const abs = resumeFilePath(filePath);
    if (!abs)
        return;
    try {
        fs.unlinkSync(abs);
    }
    catch {
        /* ignore */
    }
}
/**
 * 部门管理员是否可以查看某份简历：
 * 仅当其投递过该管理员管辖部门下的职位时放行，避免跨部门查看候选人附件。
 */
function departmentAdminCanViewResume(userEmail, resumeId) {
    const deptIds = new Set(departmentAdminDepartments(userEmail).map((d) => d.id));
    if (!deptIds.size)
        return false;
    const s = db.getStore();
    return s.applications.some((a) => {
        if (a.resume_id !== resumeId)
            return false;
        const job = s.jobs.find((j) => j.id === a.job_id);
        return Boolean(job && deptIds.has(job.department_id));
    });
}
// ===== 概览 =====
meRouter.get('/overview', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const s = db.getStore();
    const apps = s.applications.filter((a) => a.user_id === user.id);
    ok(res, {
        resumes: s.resumes.filter((r) => r.user_id === user.id).length,
        applications: apps.length,
        pending: apps.filter((a) => a.status === 'pending').length,
        passed: apps.filter((a) => a.status === 'passed').length,
        rejected: apps.filter((a) => a.status === 'rejected').length,
    });
});
// ===== 加入软工集市团队（通用开发者入口） =====
function teamResumeFor(userId, resumeId = 0) {
    const own = db.getStore().resumes.filter((r) => r.user_id === userId);
    if (resumeId)
        return own.find((r) => r.id === resumeId) || null;
    return own.find((r) => r.is_default === 1) || [...own].sort((a, b) => b.id - a.id)[0] || null;
}
meRouter.get('/join-team', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const resume = teamResumeFor(user.id);
    ok(res, {
        // 开发者权限在登录时自动开通；ready 保留给旧前端，表示当前是否可手动重试
        ready: user.status === 'active',
        resume_id: resume?.id || 0,
        missing_fields: [],
        sso_developer: user.sso_developer === 1,
        sso_developer_at: user.sso_developer_at || '',
        email: user.email || resume?.email || '',
    });
});
meRouter.post('/join-team', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    if (user.status !== 'active') {
        fail(res, 403, '账号已退出，请联系管理员后再加入');
        return;
    }
    const b = (req.body || {});
    // 登录时已自动开通；这里只作为手动重试入口，不再要求简历完整。
    const resume = teamResumeFor(user.id, Number(b.resume_id) || 0);
    const email = (user.email || resume?.email || '').trim().toLowerCase();
    if (!email) {
        fail(res, 400, '账号缺少邮箱，无法开通开发者权限，请联系管理员');
        return;
    }
    if (!isUnissoConfigured()) {
        fail(res, 503, '统一身份未配置，暂时无法开通开发者权限');
        return;
    }
    try {
        const result = await updateUnissoDeveloper(email, true);
        if (!result.ok || result.status >= 400 || result.developer === false) {
            fail(res, 502, result.message || result.error || `开通开发者权限失败（HTTP ${result.status}）`);
            return;
        }
    }
    catch (e) {
        fail(res, 502, e instanceof Error ? e.message : '开通开发者权限失败');
        return;
    }
    const t = now();
    ensureDeveloperProfile(user);
    user.sso_developer = 1;
    user.sso_developer_at = t;
    await db.persist();
    ok(res, {
        developer: true,
        identity: userIdentityView(user),
        resume_id: resume?.id || 0,
        sso_developer_at: t,
    }, '你已成为软工集市开发者');
});
// ===== 我的开发者身份 / 成长路径 =====
meRouter.get('/developer', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const s = db.getStore();
    const dept = s.departments.find((d) => d.id === user.primary_department_id) || null;
    const seat = dept ? departmentSeatStats(dept) : null;
    const defenses = s.defenses
        .filter((d) => d.applicant_user_id === user.id)
        .sort((a, b) => b.id - a.id)
        .map((d) => defenseView(d));
    const pendingReviews = s.defense_reviews
        .filter((r) => r.status === 'pending' &&
        (r.reviewer_user_id === user.id ||
            (r.reviewer_user_id === 0 &&
                (isStaffUser(user) || user.reviewer_role === 'resource'))))
        .map((r) => {
        const d = s.defenses.find((x) => x.id === r.defense_id);
        return d
            ? {
                review_id: r.id,
                level: r.level,
                role_label: r.role_label,
                defense_id: d.id,
                title: d.title,
                applicant_name: s.users.find((u) => u.id === d.applicant_user_id)?.name || '',
                department_name: d.department_name,
                status: d.status,
                created_at: r.created_at,
            }
            : null;
    })
        .filter(Boolean);
    const memberships = s.memberships
        .filter((m) => m.user_id === user.id)
        .sort((a, b) => b.id - a.id)
        .map((m) => ({
        ...m,
        department: s.departments.find((d) => d.id === m.department_id)?.name || '',
    }));
    ok(res, {
        ...userIdentityView(user),
        seat: seat
            ? {
                total: seat.total,
                occupied: seat.occupied,
                available: seat.available,
                waitlist: seat.waitlist,
            }
            : null,
        defenses,
        pending_reviews: pendingReviews,
        memberships,
    });
});
// ===== 双向确认：部门通过后，本人确认加入 =====
meRouter.post('/applications/:id/confirm', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const s = db.getStore();
    const app = s.applications.find((a) => a.id === Number(req.params.id) && a.user_id === user.id);
    if (!app) {
        fail(res, 404, '报名记录不存在');
        return;
    }
    if (app.stage !== 'offered') {
        fail(res, 400, '该报名尚未收到部门确认，或已完成确认');
        return;
    }
    const job = s.jobs.find((j) => j.id === app.job_id);
    const dept = job ? s.departments.find((d) => d.id === job.department_id) : undefined;
    if (!job || !dept) {
        fail(res, 400, '岗位或部门已不存在，请联系管理员');
        return;
    }
    const t = now();
    joinDepartment(user, dept, { sourceApplicationId: app.id, note: '部门双选确认' });
    await syncUnissoDeveloper(user);
    app.stage = 'joined';
    app.status = 'passed';
    app.confirmed_at = t;
    app.joined_at = t;
    app.updated_at = t;
    await db.persist();
    ok(res, { identity: userIdentityView(user), department: { id: dept.id, name: dept.name } }, `已确认加入「${dept.name}」，你现在是项目开发者`);
});
// ===== 我的答辩 =====
meRouter.get('/defenses', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const rows = db
        .getStore()
        .defenses.filter((d) => d.applicant_user_id === user.id)
        .sort((a, b) => b.id - a.id)
        .map((d) => defenseView(d));
    ok(res, rows);
});
meRouter.post('/defenses', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const b = (req.body || {});
    const result = createDefense(user, {
        title: str(b.title, 100),
        statement: str(b.statement, 8000),
        proposal: str(b.proposal, 8000),
        achievements: str(b.achievements, 8000),
    });
    if (!result.defense) {
        fail(res, 400, result.error || '发起答辩失败');
        return;
    }
    await db.persist();
    ok(res, defenseView(result.defense), '答辩已发起，进入一级事实陈述');
});
meRouter.get('/defenses/:id', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const d = db.getStore().defenses.find((x) => x.id === Number(req.params.id));
    if (!d) {
        fail(res, 404, '答辩不存在');
        return;
    }
    if (!canViewDefense(user, d)) {
        fail(res, 403, '无权查看该答辩');
        return;
    }
    ok(res, defenseView(d));
});
meRouter.post('/defenses/:id/withdraw', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const d = db.getStore().defenses.find((x) => x.id === Number(req.params.id) && x.applicant_user_id === user.id);
    if (!d) {
        fail(res, 404, '答辩不存在');
        return;
    }
    if (!['submitted', 'level1', 'level2', 'level3', 'waitlist'].includes(d.status)) {
        fail(res, 400, '该答辩已结束，无法撤回');
        return;
    }
    d.status = 'withdrawn';
    d.current_level = 0;
    d.final_result = 'rejected';
    d.final_note = '申请人撤回答辩';
    d.updated_at = now();
    await db.persist();
    ok(res, defenseView(d), '已撤回该答辩');
});
// ===== 我收到的评审任务 =====
meRouter.get('/reviews', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const s = db.getStore();
    const rows = s.defense_reviews
        .filter((r) => r.status === 'pending' &&
        (r.reviewer_user_id === user.id ||
            (r.reviewer_user_id === 0 && (isStaffUser(user) || user.reviewer_role === 'resource'))))
        .map((r) => {
        const d = s.defenses.find((x) => x.id === r.defense_id);
        return d
            ? {
                ...r,
                defense: defenseView(d),
            }
            : null;
    })
        .filter(Boolean);
    ok(res, rows);
});
meRouter.post('/reviews/:id', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const review = db.getStore().defense_reviews.find((r) => r.id === Number(req.params.id));
    if (!review) {
        fail(res, 404, '评审任务不存在');
        return;
    }
    const b = (req.body || {});
    const result = submitReview(user, review, {
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
// ===== 我的投递 =====
meRouter.get('/applications', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const rows = db
        .getStore()
        .applications.filter((a) => a.user_id === user.id)
        .sort((a, b) => b.id - a.id);
    ok(res, rows.map(mapApplication));
});
meRouter.get('/applications/:id', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const row = db
        .getStore()
        .applications.find((a) => a.id === Number(req.params.id) && a.user_id === user.id);
    if (!row) {
        fail(res, 404, '报名记录不存在');
        return;
    }
    ok(res, mapApplication(row));
});
// ===== 我的简历 =====
meRouter.get('/resumes', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const rows = db
        .getStore()
        .resumes.filter((r) => r.user_id === user.id)
        .sort((a, b) => b.is_default - a.is_default || b.id - a.id);
    ok(res, rows.map((r) => mapResume(r)));
});
meRouter.get('/resumes/:id', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const r = ownResume(user.id, Number(req.params.id));
    if (!r) {
        fail(res, 404, '简历不存在');
        return;
    }
    ok(res, mapResume(r, true));
});
/** 新建在线简历 */
meRouter.post('/resumes', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const s = db.getStore();
    const b = (req.body || {});
    const own = s.resumes.filter((r) => r.user_id === user.id);
    const name = str(b.name, 60) || user.name;
    const t = now();
    const isDefault = b.is_default === true || b.is_default === 1 || own.length === 0;
    const row = {
        id: db.nextId('resumes'),
        user_id: user.id,
        title: str(b.title, 100) || `${name || '我的'}的简历`,
        name,
        phone: str(b.phone, 40),
        email: str(b.email, 200) || user.email,
        city: str(b.city, 60),
        intention: str(b.intention, 100),
        grade: str(b.grade, 20),
        education: str(b.education, 40),
        school: str(b.school, 100),
        major: str(b.major, 100),
        graduation_year: str(b.graduation_year, 20),
        experience_years: num(b.experience_years, 0, 60),
        skills: str(b.skills, 500),
        summary: str(b.summary, 3000),
        work_experience: str(b.work_experience, 8000),
        project_experience: str(b.project_experience, 8000),
        education_experience: str(b.education_experience, 4000),
        file_path: '',
        file_name: '',
        file_size: 0,
        parsed_text: '',
        parse_note: '',
        is_default: isDefault ? 1 : 0,
        created_at: t,
        updated_at: t,
    };
    s.resumes.push(row);
    if (isDefault)
        setDefaultResume(user.id, row.id);
    await db.persist();
    ok(res, mapResume(row, true), '简历已创建');
});
/** 编辑简历（不影响已投递记录里的快照） */
meRouter.put('/resumes/:id', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const r = ownResume(user.id, Number(req.params.id));
    if (!r) {
        fail(res, 404, '简历不存在');
        return;
    }
    const b = (req.body || {});
    const mapping = [
        ['title', 100],
        ['name', 60],
        ['phone', 40],
        ['email', 200],
        ['city', 60],
        ['intention', 100],
        ['grade', 20],
        ['education', 40],
        ['school', 100],
        ['major', 100],
        ['graduation_year', 20],
        ['skills', 500],
        ['summary', 3000],
        ['work_experience', 8000],
        ['project_experience', 8000],
        ['education_experience', 4000],
    ];
    for (const [key, max] of mapping) {
        if (b[key] != null) {
            ;
            r[key] = str(b[key], max);
        }
    }
    if (b.experience_years != null)
        r.experience_years = num(b.experience_years, 0, 60);
    if (b.is_default === true || b.is_default === 1)
        setDefaultResume(user.id, r.id);
    r.updated_at = now();
    await db.persist();
    ok(res, mapResume(r, true), '简历已保存');
});
meRouter.post('/resumes/:id/default', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const r = ownResume(user.id, Number(req.params.id));
    if (!r) {
        fail(res, 404, '简历不存在');
        return;
    }
    setDefaultResume(user.id, r.id);
    await db.persist();
    ok(res, { id: r.id }, '已设为默认简历');
});
meRouter.delete('/resumes/:id', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const s = db.getStore();
    const idx = s.resumes.findIndex((r) => r.id === Number(req.params.id) && r.user_id === user.id);
    if (idx < 0) {
        fail(res, 404, '简历不存在');
        return;
    }
    const [removed] = s.resumes.splice(idx, 1);
    removeResumeFile(removed.file_path);
    const rest = s.resumes.filter((r) => r.user_id === user.id);
    if (removed.is_default === 1 && rest.length) {
        rest.sort((a, b) => b.id - a.id)[0].is_default = 1;
    }
    await db.persist();
    ok(res, { id: removed.id }, '简历已删除');
});
/** 上传 PDF 简历：保存文件 + 解析文本 + 自动建一份可编辑的简历 */
meRouter.post('/resumes/upload', requireUser, async (req, res) => {
    const user = getCurrentUser(req);
    const b = (req.body || {});
    const rawName = str(b.fileName, 200) || 'resume.pdf';
    const data = String(b.dataBase64 ?? '')
        .trim()
        .replace(/^data:application\/pdf;base64,/, '');
    if (!data) {
        fail(res, 400, '缺少文件内容');
        return;
    }
    // base64 长度预检，避免先解码一个超大字符串
    if (data.length > Math.ceil((config.uploads.maxResumeBytes * 4) / 3) + 128) {
        fail(res, 413, `文件超过 ${Math.round(config.uploads.maxResumeBytes / 1024 / 1024)}MB 限制`);
        return;
    }
    let buf;
    try {
        buf = Buffer.from(data, 'base64');
    }
    catch {
        fail(res, 400, '文件内容不是合法的 base64');
        return;
    }
    if (!buf.length) {
        fail(res, 400, '文件为空');
        return;
    }
    if (buf.length > config.uploads.maxResumeBytes) {
        fail(res, 413, `文件超过 ${Math.round(config.uploads.maxResumeBytes / 1024 / 1024)}MB 限制`);
        return;
    }
    if (!looksLikePdf(buf)) {
        fail(res, 400, '仅支持 PDF 文件');
        return;
    }
    const safeName = (path.basename(rawName).replace(/[^\w.\-一-龥]+/g, '_') || 'resume').slice(0, 120);
    const fileName = /\.pdf$/i.test(safeName) ? safeName : `${safeName}.pdf`;
    const relDir = path.posix.join('uploads', 'resumes', String(user.id));
    const relPath = path.posix.join(relDir, `${crypto.randomUUID()}.pdf`);
    const absPath = resumeFilePath(relPath);
    if (!absPath) {
        fail(res, 500, '存储路径异常');
        return;
    }
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buf);
    let parsed = null;
    let aiParsed = null;
    let note = '';
    let pages = 0;
    let extractedText = '';
    try {
        const result = await extractPdfText(buf);
        pages = result.pages;
        extractedText = result.text;
        if (result.text.replace(/\s/g, '').length < 20) {
            note = '未能从 PDF 中提取到文本（可能是扫描件/图片型 PDF），请手动填写简历信息。';
        }
        else {
            // 规则解析先兜底，再调用 AI 提取核心字段；AI 不可用时仍能创建简历
            parsed = parseResumeText(result.text, fileName);
            aiParsed = await parseResumeWithAi(result.text);
            note = aiParsed
                ? 'AI 已自动解析简历，请检查并补充不准确的内容。'
                : 'AI 解析暂不可用，已按规则预填，请检查并补充。';
        }
    }
    catch (e) {
        note = `PDF 解析失败：${e instanceof Error ? e.message : '未知错误'}。文件已保存，请手动填写。`;
        console.error('[resume] PDF 解析失败:', e instanceof Error ? e.message : e);
    }
    const s = db.getStore();
    const own = s.resumes.filter((r) => r.user_id === user.id);
    const t = now();
    const name = aiParsed?.name || parsed?.name || user.name;
    const merged = {
        name,
        grade: aiParsed?.grade || '',
        email: aiParsed?.email || parsed?.email || user.email,
        phone: aiParsed?.phone || parsed?.phone || '',
        summary: aiParsed?.summary || parsed?.summary || '',
        city: parsed?.city || '',
        intention: parsed?.intention || '',
        education: parsed?.education || '',
        school: parsed?.school || '',
        major: parsed?.major || '',
        graduation_year: parsed?.graduation_year || '',
        skills: parsed?.skills || '',
        work_experience: parsed?.work_experience || '',
        project_experience: parsed?.project_experience || '',
        education_experience: parsed?.education_experience || '',
    };
    const row = {
        id: db.nextId('resumes'),
        user_id: user.id,
        title: name ? `${name}的简历` : fileName.replace(/\.pdf$/i, ''),
        name,
        phone: merged.phone,
        email: merged.email,
        city: merged.city,
        intention: merged.intention,
        grade: merged.grade,
        education: merged.education,
        school: merged.school,
        major: merged.major,
        graduation_year: merged.graduation_year,
        experience_years: parsed?.experience_years || 0,
        skills: merged.skills,
        summary: merged.summary,
        work_experience: merged.work_experience,
        project_experience: merged.project_experience,
        education_experience: merged.education_experience,
        file_path: relPath,
        file_name: fileName,
        file_size: buf.length,
        parsed_text: extractedText,
        parse_note: note,
        is_default: own.length === 0 ? 1 : 0,
        created_at: t,
        updated_at: t,
    };
    s.resumes.push(row);
    if (row.is_default)
        setDefaultResume(user.id, row.id);
    await db.persist();
    ok(res, {
        resume: mapResume(row, true),
        parsed: merged,
        pages,
        warning: note,
    }, note || '简历已上传并解析');
});
/** 下载/预览 PDF 简历（本人或管理员） */
meRouter.get('/resumes/:id/file', requireUser, (req, res) => {
    const user = getCurrentUser(req);
    const r = db.getStore().resumes.find((x) => x.id === Number(req.params.id));
    if (!r) {
        fail(res, 404, '简历不存在');
        return;
    }
    if (r.user_id !== user.id &&
        !isSuperAdminUser(user) &&
        !departmentAdminCanViewResume(user.email, r.id)) {
        fail(res, 403, '无权访问该简历');
        return;
    }
    if (!r.file_path) {
        fail(res, 404, '该简历没有 PDF 附件');
        return;
    }
    const abs = resumeFilePath(r.file_path);
    if (!abs || !fs.existsSync(abs)) {
        fail(res, 404, '附件文件不存在');
        return;
    }
    const encoded = encodeURIComponent(r.file_name || 'resume.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="resume.pdf"; filename*=UTF-8''${encoded}`);
    res.sendFile(abs);
});
