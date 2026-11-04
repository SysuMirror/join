import { Router } from 'express';
import { db } from '../db.js';
import { ok, fail } from '../middleware.js';
import { departmentPublicView, departmentSeatStats } from '../services/org.js';
import { publicityView } from '../services/publicity.js';
export const orgRouter = Router();
const LEVELS = [
    {
        key: 'market',
        name: '集市开发者',
        short: '底座',
        description: '进入集市即获得身份，无需审批。享有集市公开资源与开发者工坊（共学/分享）资格。',
    },
    {
        key: 'project',
        name: '项目开发者',
        short: '进组',
        description: '通过部门双选（15 分钟轻沟通，重动机与时间投入）后归属部门/产品线，在实战中成长。',
    },
    {
        key: 'roundtable',
        name: '圆桌开发者',
        short: '技术部',
        description: '通过多级答辩进入技术部（圆桌），参与学院资源分配与产品/运营决策。',
    },
];
const PROCESS = [
    {
        step: 1,
        title: '注册即成为集市开发者',
        detail: '任何同学通过统一身份登录，自动获得「软工集市开发者」身份，无需任何审批。',
    },
    {
        step: 2,
        title: '部门双选：投递意向部门',
        detail: '在部门岗位浏览各部门岗位并投递。部门负责人进行 15 分钟轻沟通，重点看动机与时间投入，不卡技术门槛。',
    },
    {
        step: 3,
        title: '双向确认成为项目开发者',
        detail: '部门发出确认后，本人确认加入，身份转为「项目开发者」，归属该部门/产品线；未匹配成功仍保留集市开发者身份。',
    },
    {
        step: 4,
        title: '发起技术部答辩',
        detail: '项目开发者在本平台发起答辩，陈述个人产出，并回答核心问题：进入技术部后，主张如何帮助学院更好分配资源。',
    },
    {
        step: 5,
        title: '多级评审（本组回避 / 交叉评审 / 资源方收听）',
        detail: '一级：本部门负责人陈述事实、回避打分；二级：其他 2-3 个部门负责人交叉评审，防小圈子；三级：学院/外院资源方代表评估资源分配主张。',
    },
    {
        step: 6,
        title: '按席位进入圆桌',
        detail: '通过者成为「圆桌开发者（技术部成员）」。技术部席位按部门「基础保底 + 浮动产出」分配，席位已满时自动进入候补队列。',
    },
    {
        step: 7,
        title: '年度复审与退出机制',
        detail: '圆桌成员卸任产品负责人或年度复审未达产出要求，自动退出圆桌并释放席位，由候补者按顺序递补；部门产出对全体开发者公开。',
    },
];
/** GET /api/org/overview — 管理体系公开数据 */
orgRouter.get('/overview', (_req, res) => {
    const s = db.getStore();
    const active = s.users.filter((u) => u.status === 'active');
    const departments = s.departments
        .filter((d) => d.enabled === 1)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map(departmentPublicView);
    const roundtable = s.users
        .filter((u) => u.developer_level === 'roundtable' && u.status === 'active')
        .sort((a, b) => (a.roundtable_joined_at || '').localeCompare(b.roundtable_joined_at || '') || a.id - b.id)
        .map((u) => {
        const dept = s.departments.find((d) => d.id === u.primary_department_id);
        return {
            id: u.id,
            name: u.name,
            avatar: u.avatar,
            developer_no: u.developer_no,
            department: dept ? { id: dept.id, name: dept.name, color: dept.color } : null,
            joined_at: u.roundtable_joined_at,
        };
    });
    const seatTotals = s.departments
        .filter((d) => d.enabled === 1)
        .reduce((acc, d) => {
        const st = departmentSeatStats(d);
        acc.total += st.total;
        acc.occupied += st.occupied;
        return acc;
    }, { total: 0, occupied: 0 });
    ok(res, {
        levels: LEVELS,
        process: PROCESS,
        stats: {
            developers: active.length,
            market: active.filter((u) => u.developer_level === 'market').length,
            project: active.filter((u) => u.developer_level === 'project').length,
            roundtable: active.filter((u) => u.developer_level === 'roundtable').length,
            departments: departments.length,
            seats: seatTotals.total,
            seatsOccupied: seatTotals.occupied,
            activeDefenses: s.defenses.filter((d) => ['submitted', 'level1', 'level2', 'level3', 'waitlist'].includes(d.status)).length,
            passedDefenses: s.defenses.filter((d) => d.status === 'passed').length,
        },
        departments,
        roundtable,
    });
});
/** GET /api/org/departments/:slug — 部门公开详情（含成员与产出） */
orgRouter.get('/departments/:slug', (req, res) => {
    const key = String(req.params.slug || '').trim();
    const s = db.getStore();
    const d = s.departments.find((x) => x.slug === key || String(x.id) === key || x.name === key);
    if (!d || d.enabled !== 1) {
        fail(res, 404, '部门不存在');
        return;
    }
    const members = s.users
        .filter((u) => u.primary_department_id === d.id && u.status === 'active')
        .sort((a, b) => {
        const rank = (u) => u.developer_level === 'roundtable' ? 0 : u.developer_level === 'project' ? 1 : 2;
        return rank(a) - rank(b) || a.id - b.id;
    })
        .map((u) => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        developer_no: u.developer_no,
        developer_level: u.developer_level,
        level_label: u.developer_level === 'roundtable'
            ? '圆桌开发者'
            : u.developer_level === 'project'
                ? '项目开发者'
                : '集市开发者',
        developer_bio: u.developer_bio,
        developer_skills: (u.developer_skills || '').split(',').map((x) => x.trim()).filter(Boolean),
    }));
    ok(res, { ...departmentPublicView(d), member_list: members });
});
/** GET /api/org/publicities — 已发布的会议/席位公示 */
orgRouter.get('/publicities', (_req, res) => {
    const rows = db
        .getStore()
        .publicities.filter((p) => p.published === 1)
        .sort((a, b) => (b.meeting_date || '').localeCompare(a.meeting_date || '') || b.id - a.id)
        .map((p) => {
        const v = publicityView(p);
        return {
            id: v.id,
            title: v.title,
            meeting_date: v.meeting_date,
            summary: v.summary,
            created_at: v.created_at,
            seats: v.seats.length,
            promotions: v.promotions.length,
        };
    });
    ok(res, rows);
});
/** GET /api/org/publicities/:id — 公示详情（含席位与晋升表） */
orgRouter.get('/publicities/:id', (req, res) => {
    const row = db
        .getStore()
        .publicities.find((p) => p.id === Number(req.params.id) && p.published === 1);
    if (!row) {
        fail(res, 404, '公示不存在或未发布');
        return;
    }
    ok(res, publicityView(row));
});
/** GET /api/org/defenses/recent — 近期答辩结果（公开监督） */
orgRouter.get('/defenses/recent', (_req, res) => {
    const s = db.getStore();
    const rows = s.defenses
        .filter((d) => d.status === 'passed' || d.status === 'rejected')
        .sort((a, b) => (b.decided_at || b.updated_at).localeCompare(a.decided_at || a.updated_at))
        .slice(0, 12)
        .map((d) => {
        const u = s.users.find((x) => x.id === d.applicant_user_id);
        return {
            id: d.id,
            title: d.title,
            department_name: d.department_name,
            applicant_name: u?.name || '',
            applicant_no: u?.developer_no || '',
            status: d.status,
            final_note: d.final_note,
            decided_at: d.decided_at || d.updated_at,
        };
    });
    ok(res, rows);
});
