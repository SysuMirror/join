import { Router } from 'express';
import { db } from '../db.js';
import { ok } from '../middleware.js';
import { isUnissoConfigured } from '../config.js';
export const siteRouter = Router();
/** GET /api/site — 站点公开配置与开发者平台概览 */
siteRouter.get('/', (_req, res) => {
    const s = db.getStore();
    const c = s.site_config;
    const openJobs = s.jobs.filter((j) => j.enabled === 1).length;
    const departments = s.departments.filter((d) => d.enabled === 1).length;
    const locations = new Set(s.jobs.filter((j) => j.enabled === 1).map((j) => j.location).filter(Boolean));
    ok(res, {
        brand: c.brand,
        heroTitle: c.heroTitle,
        heroSubtitle: c.heroSubtitle,
        announcement: c.announcement,
        tagline: c.tagline,
        contactEmail: c.contactEmail,
        bgWords: c.bgWords,
        updatedAt: c.updated_at,
        stats: {
            openJobs,
            departments,
            locations: locations.size,
            faqs: s.faqs.filter((f) => f.enabled === 1).length,
        },
        ssoEnabled: isUnissoConfigured(),
    });
});
