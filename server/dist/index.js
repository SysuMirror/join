import { loadEnvFile } from './load-env.js';
loadEnvFile();
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config, isDevPlatformConfigured, isUnissoConfigured, } from './config.js';
import { initDb, ensureSeeds, db } from './db.js';
import { ensureDeveloperProfile, mergeDuplicateEmailAccounts } from './services/org.js';
import { storeBackendLabel, isMinioConfigured } from './storage.js';
import { jobsRouter } from './routes/jobs.js';
import { departmentsRouter } from './routes/departments.js';
import { faqsRouter } from './routes/faqs.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { siteRouter } from './routes/site.js';
import { meRouter } from './routes/me.js';
import { orgRouter } from './routes/org.js';
const app = express();
const corsOrigins = (process.env.JOIN_CORS_ORIGINS || 'http://localhost:5175,http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
app.use(cors({
    origin: (origin, cb) => {
        if (!origin)
            return cb(null, true);
        if (corsOrigins.includes('*') || corsOrigins.includes(origin))
            return cb(null, true);
        if (origin.endsWith('.ssemarket.cn') || origin.startsWith('http://localhost:')) {
            return cb(null, true);
        }
        cb(null, false);
    },
    credentials: true,
}));
// 简历 PDF 以 base64 JSON 上传：按最大文件体积动态放宽 body 限制（base64 约 4/3，另留 1MB 余量）
const jsonLimitBytes = Math.ceil((config.uploads.maxResumeBytes * 4) / 3) + 1024 * 1024;
app.use(express.json({ limit: jsonLimitBytes }));
app.get('/api/health', (_req, res) => {
    res.json({
        code: 0,
        message: 'ok',
        data: {
            service: 'join-platform',
            devPlatformConfigured: isDevPlatformConfigured(),
            ssoConfigured: isUnissoConfigured(),
            store: storeBackendLabel(),
            time: new Date().toISOString(),
        },
    });
});
app.use('/api/jobs', jobsRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/faqs', faqsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/site', siteRouter);
app.use('/api/me', meRouter);
app.use('/api/org', orgRouter);
// 未匹配的 /api 请求返回 JSON，而不是落进 SPA 的 index.html
app.use('/api', (_req, res) => {
    res.status(404).json({ code: 404, message: '接口不存在' });
});
const dist = config.frontendDist;
if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api'))
            return next();
        res.sendFile(path.join(dist, 'index.html'));
    });
}
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : '服务器错误' });
});
await initDb();
await ensureSeeds();
/**
 * 启动时同步：
 * 1) 老数据补齐开发者身份（全员开发者）
 * 2) 部署环境变量 / 站点配置里的超级管理员 UniSSO sub → 数据库超级管理员角色
 *    之后后台的用户角色管理才有统一事实来源；取消超管时也会同步移除站点白名单。
 */
async function syncIdentityAndAdmins() {
    const store = db.getStore();
    const subs = new Set(`${process.env.JOIN_ADMIN_SUBS || ''},${store.site_config.adminSubs || ''}`
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean));
    let changed = mergeDuplicateEmailAccounts() > 0;
    for (const u of store.users) {
        if (ensureDeveloperProfile(u))
            changed = true;
        if (u.sso_sub && subs.has(u.sso_sub) && u.system_role !== 'super_admin') {
            u.system_role = 'super_admin';
            u.is_admin = 1;
            changed = true;
        }
    }
    // 部门负责人至少是项目开发者，并自动具备该部门管理员权限
    for (const d of store.departments) {
        if (!d.head_user_id)
            continue;
        const head = store.users.find((u) => u.id === d.head_user_id);
        if (!head)
            continue;
        if (head.developer_level === 'market') {
            head.developer_level = 'project';
            changed = true;
        }
        if (!head.primary_department_id) {
            head.primary_department_id = d.id;
            head.department_joined_at = head.department_joined_at || new Date().toISOString();
            changed = true;
        }
        const ids = (d.admin_user_ids || '')
            .split(',')
            .map((x) => Number(x.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (!ids.includes(head.id)) {
            d.admin_user_ids = [...ids, head.id].join(',');
            changed = true;
        }
    }
    if (changed)
        await db.persist();
}
await syncIdentityAndAdmins();
// 启动校验：会话密钥是登录态硬依赖；开发者平台模块身份用于 OA 自动审批
const missingEnv = [];
if (!config.devPlatform.moduleSlug)
    missingEnv.push('JOIN_DEV_MODULE_SLUG');
if (!config.devPlatform.modulePrivateKey)
    missingEnv.push('JOIN_DEV_MODULE_PRIVATE_KEY');
if (!config.sessionSecret)
    missingEnv.push('JOIN_SESSION_SECRET');
if (missingEnv.length) {
    console.error(`[join] FATAL: 缺少必填环境变量：${missingEnv.join(', ')}（由部署平台注入，不落包）`);
    process.exit(1);
}
const frontendDistExists = fs.existsSync(dist);
app.listen(config.port, '0.0.0.0', () => {
    console.log(`[join] listening on 0.0.0.0:${config.port}`);
    console.log(`[join] store=${storeBackendLabel()} local_backup=${config.dataDir}/join-store.json`);
    console.log(`[join] frontend=${dist} exists=${frontendDistExists}`);
    console.log(`[join] devPlatform=${config.devPlatform.baseUrl} slug=${config.devPlatform.moduleSlug}`);
    console.log(`[join] unisso=${isUnissoConfigured() ? 'configured' : 'NOT configured'} issuer=${config.unisso.issuer} redirect=${config.unisso.redirectUri}`);
    if (!isMinioConfigured()) {
        console.log('[join] MinIO 未配置：简历附件保存在 DATA_DIR/uploads（持久化盘）');
    }
});
