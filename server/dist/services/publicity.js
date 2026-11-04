import { db, now, } from '../db.js';
export function currentSeatTable() {
    return db
        .getStore()
        .departments.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((d) => ({
        department_id: d.id,
        department_name: d.name,
        base: Math.max(1, Number(d.base_seats) || 1),
        floating: Math.max(0, Number(d.floating_seats) || 0),
        total: Math.max(1, Number(d.base_seats) || 1) + Math.max(0, Number(d.floating_seats) || 0),
        delivery: Math.max(0, Math.min(100, Number(d.output_delivery) || 0)),
        usage: Math.max(0, Math.min(100, Number(d.output_usage) || 0)),
        talent: Math.max(0, Math.min(100, Number(d.output_talent) || 0)),
        activity: Math.max(0, Math.min(100, Number(d.output_activity) || 0)),
    }));
}
const RESULT_LABEL = {
    passed: '进入圆桌',
    waitlist: '候补席位',
    rejected: '未通过',
};
export function recentPromotions(since = '') {
    const s = db.getStore();
    const sinceTime = since ? Date.parse(since) : 0;
    return s.defenses
        .filter((d) => ['passed', 'waitlist', 'rejected'].includes(d.status))
        .filter((d) => {
        const at = Date.parse(d.decided_at || d.updated_at || d.created_at);
        return Number.isFinite(at) && at >= sinceTime;
    })
        .sort((a, b) => (a.decided_at || a.updated_at).localeCompare(b.decided_at || b.updated_at) || a.id - b.id)
        .map((d) => {
        const u = s.users.find((x) => x.id === d.applicant_user_id);
        return {
            user_id: d.applicant_user_id,
            name: u?.name || '—',
            developer_no: u?.developer_no || '',
            department_name: d.department_name,
            result: RESULT_LABEL[d.status] || d.status,
            note: d.final_note || '',
        };
    });
}
export function lastPublicityDate() {
    const rows = db
        .getStore()
        .publicities.filter((p) => p.published === 1 && p.meeting_date)
        .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
    return rows[0]?.meeting_date || '';
}
export function buildPublicityContent(input) {
    const lines = [];
    lines.push(input.title || '技术部会议公示');
    lines.push(`会议时间：${input.meeting_date || '—'}`);
    lines.push('');
    lines.push('一、晋升与席位变动');
    if (!input.promotions.length) {
        lines.push('本次会议无晋升或席位变动。');
    }
    else {
        lines.push('姓名 | 开发者编号 | 部门 | 结果 | 说明');
        for (const p of input.promotions) {
            lines.push([p.name, p.developer_no, p.department_name, p.result, p.note]
                .map((x) => String(x || '—').replace(/\s+/g, ' '))
                .join(' | '));
        }
    }
    lines.push('');
    lines.push('二、技术部席位分配');
    lines.push('部门 | 保底 | 浮动 | 合计');
    for (const s of input.seats) {
        lines.push(`${s.department_name} | ${s.base} | ${s.floating} | ${s.total}`);
    }
    lines.push('');
    lines.push('三、部门指标');
    lines.push('部门 | 交付量 | 使用量 | 出人贡献 | 社区活跃');
    for (const s of input.seats) {
        lines.push(`${s.department_name} | ${s.delivery || 0} | ${s.usage || 0} | ${s.talent || 0} | ${s.activity || 0}`);
    }
    lines.push('');
    if (input.summary) {
        lines.push('四、说明');
        lines.push(input.summary);
    }
    return lines.join('\n');
}
export function publicityView(row) {
    let seats = [];
    let promotions = [];
    try {
        const parsed = JSON.parse(row.seats_json);
        if (Array.isArray(parsed))
            seats = parsed;
    }
    catch {
        seats = [];
    }
    try {
        const parsed = JSON.parse(row.promotions_json);
        if (Array.isArray(parsed))
            promotions = parsed;
    }
    catch {
        promotions = [];
    }
    return {
        id: row.id,
        title: row.title,
        meeting_date: row.meeting_date,
        summary: row.summary,
        content: row.content,
        published: row.published === 1,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        seats,
        promotions,
    };
}
export function makePublicityRow(input, by) {
    const seats = input.seats && input.seats.length ? input.seats : currentSeatTable();
    const promotions = input.promotions || [];
    const content = buildPublicityContent({
        title: input.title,
        meeting_date: input.meeting_date,
        summary: input.summary,
        seats,
        promotions,
    });
    return {
        title: input.title,
        meeting_date: input.meeting_date,
        summary: input.summary,
        seats_json: JSON.stringify(seats),
        promotions_json: JSON.stringify(promotions),
        content,
        published: input.published === false ? 0 : 1,
        created_by: by,
    };
}
export function touchPublicity(row) {
    row.updated_at = now();
}
/** 已发布公示是席位与指标的审计基准：写回部门当前值。 */
export function applyPublicityToDepartments(seats) {
    const s = db.getStore();
    const t = now();
    for (const seat of seats) {
        const d = s.departments.find((x) => x.id === seat.department_id);
        if (!d)
            continue;
        d.base_seats = Math.max(1, Number(seat.base) || 1);
        d.floating_seats = Math.max(0, Number(seat.floating) || 0);
        d.output_delivery = Math.max(0, Math.min(100, Number(seat.delivery) || 0));
        d.output_usage = Math.max(0, Math.min(100, Number(seat.usage) || 0));
        d.output_talent = Math.max(0, Math.min(100, Number(seat.talent) || 0));
        d.output_activity = Math.max(0, Math.min(100, Number(seat.activity) || 0));
        d.updated_at = t;
    }
}
