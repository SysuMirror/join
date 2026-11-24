/** 邀请填写时固定使用软工集市；管理员之后可在后台调整 */
export const HALL_DEFAULT_DEPARTMENT = '软工集市';
/** 管理员可选的部门 */
export const HALL_DEPARTMENTS = ['软工集市', 'iwiki'];
export function isHallDepartment(value) {
    return HALL_DEPARTMENTS.includes(value);
}
/** 统一取展示名，避免各路由重复实现 */
export function userNameOf(user) {
    const name = String(user.name || '')
        .replace(/[​-‍﻿]/g, '')
        .trim();
    return (name ||
        (user.email || '').split('@')[0] ||
        `开发者 ${user.developer_no || user.id}`);
}
