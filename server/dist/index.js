import { loadEnvFile } from './load-env.js';
loadEnvFile();
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config, isDevPlatformConfigured, isMailLoginUsable } from './config.js';
import { initDb, db, now } from './db.js';
import { storeBackendLabel } from './storage.js';
import { jobsRouter } from './routes/jobs.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { siteRouter } from './routes/site.js';
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
app.use(express.json({ limit: '4mb' }));
app.get('/api/health', (_req, res) => {
    res.json({
        code: 0,
        message: 'ok',
        data: {
            service: 'join-platform',
            devPlatformConfigured: isDevPlatformConfigured(),
            mailLoginUsable: isMailLoginUsable(),
            time: new Date().toISOString(),
        },
    });
});
app.use('/api/jobs', jobsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/site', siteRouter);
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
// 启动校验：对接开发者平台的模块身份是硬依赖（用于 OA 自动审批）
const missingEnv = [];
if (!config.devPlatform.moduleSlug)
    missingEnv.push('JOIN_DEV_MODULE_SLUG');
if (!config.devPlatform.modulePrivateKey)
    missingEnv.push('JOIN_DEV_MODULE_PRIVATE_KEY');
if (config.mail.enabled && !config.sessionSecret)
    missingEnv.push('JOIN_SESSION_SECRET');
if (missingEnv.length) {
    console.error(`[join] FATAL: 缺少必填环境变量：${missingEnv.join(', ')}（由部署平台注入，不落包）`);
    process.exit(1);
}
seedJobs();
app.listen(config.port, '0.0.0.0', () => {
    console.log(`[join] listening on 0.0.0.0:${config.port}`);
    console.log(`[join] store=${storeBackendLabel()} local_backup=${config.dataDir}/join-store.json`);
    console.log(`[join] frontend=${dist} exists=${fs.existsSync(dist)}`);
    console.log(`[join] devPlatform=${config.devPlatform.baseUrl} slug=${config.devPlatform.moduleSlug}`);
});
/** 首次启动播种一个示例职位（空库时才写；避免每次启动重复） */
function seedJobs() {
    const s = db.getStore();
    if (s.jobs.length > 0)
        return;
    const t = now();
    const demo = {
        id: db.nextId('jobs'),
        slug: 'agent-developer',
        title: 'Agent 开发工程师',
        department: 'AI 应用组',
        location: '广州',
        type: 'fulltime',
        summary: '参与集市智能 Agent 的研发与落地。',
        description: '职位职责：\n- 设计与开发集市内的 AI Agent 应用\n- 与产品、算法同学协作推进智能落地\n\n任职要求：\n- 熟悉 TypeScript / Node.js\n- 了解大模型应用开发（RAG、Function Calling 等）\n- 有良好的工程化习惯',
        headcount: 2,
        enabled: 1,
        sort_order: 1,
        created_at: t,
        updated_at: t,
    };
    s.jobs.push(demo);
    void db.persist();
}
