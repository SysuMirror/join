import { config } from './config.js';
import { modelAuthHeaders, extractResponseError } from './sm2-auth.js';
/** 统一读取 REST body（200 与 4xx/5xx 都返回 JSON） */
async function readBody(res) {
    let body;
    try {
        body = (await res.json());
    }
    catch {
        body = {};
    }
    return { httpStatus: res.status, body };
}
function okPayload(body) {
    const b = (body || {});
    if (b.code === 0)
        return b.data;
    return undefined;
}
/**
 * 提交 OA 审批单进度到开发者平台。
 * 重复提交同一 oaid（409 幂等）时返回 `{ duplicated: true, data }`。
 */
export async function submitOa(body) {
    const headers = modelAuthHeaders();
    try {
        const res = await fetch(`${config.devPlatform.baseUrl}/api/open/oa/submit`, {
            method: 'POST',
            headers: {
                ...headers,
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        const { httpStatus, body: parsed } = await readBody(res);
        const data = okPayload(parsed);
        if (httpStatus === 409 || parsed?.code === 409) {
            // 幂等：已提交过，返回当前状态
            return { duplicated: true, httpStatus, data: parsed?.data || data };
        }
        if (httpStatus >= 200 && httpStatus < 300 && data) {
            return { duplicated: false, httpStatus, data };
        }
        return {
            duplicated: false,
            httpStatus,
            error: extractResponseError(httpStatus, parsed),
        };
    }
    catch (e) {
        return {
            duplicated: false,
            httpStatus: 502,
            error: e instanceof Error ? e.message : '网络错误：无法连接开发者平台',
        };
    }
}
/** 查询某 oaid 的审批状态与流转轨迹 */
export async function queryOa(oaid) {
    const headers = modelAuthHeaders();
    const url = `${config.devPlatform.baseUrl}/api/open/oa/query?oaid=${encodeURIComponent(oaid)}`;
    try {
        const res = await fetch(url, { method: 'GET', headers });
        const { httpStatus, body: parsed } = await readBody(res);
        const data = okPayload(parsed);
        if (httpStatus >= 200 && httpStatus < 300 && data) {
            return { httpStatus, data };
        }
        return { httpStatus, error: extractResponseError(httpStatus, parsed) };
    }
    catch (e) {
        return { httpStatus: 502, error: e instanceof Error ? e.message : '网络错误：无法连接开发者平台' };
    }
}
