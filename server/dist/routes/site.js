import { Router } from 'express';
import { db } from '../db.js';
import { ok } from '../middleware.js';
export const siteRouter = Router();
/** GET /api/site — 站点公开配置（仅返回前端可展示的字段的子集，不含敏感信息） */
siteRouter.get('/', (_req, res) => {
    const c = db.getStore().site_config;
    ok(res, {
        brand: c.brand,
        heroTitle: c.heroTitle,
        heroSubtitle: c.heroSubtitle,
        announcement: c.announcement,
        tagline: c.tagline,
        contactEmail: c.contactEmail,
        bgWords: c.bgWords,
        updatedAt: c.updated_at,
    });
});
