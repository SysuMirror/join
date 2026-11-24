import { config } from '../config.js'

/**
 * 新版开发者平台（SysuMirror/developer）的 join 接入客户端。
 * 只调用对方对外的 /api/join/*，鉴权是共享密钥（Authorization: Bearer <JOIN_API_KEY>）。
 * 失败统一抛 DeveloperPlatformError，路由层再翻译成 join 前端的错误信息。
 */

const TIMEOUT_MS = 8_000

export class DeveloperPlatformError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'DeveloperPlatformError'
    this.status = status
    this.code = code
  }
}

export interface DeveloperProject {
  id: number
  title: string
}

export interface DeveloperProjectPage {
  items: DeveloperProject[]
  total: number
  page: number
  pageSize: number
}

export interface DeveloperApplyResult {
  id: number
  status: string
  userId: string
  projectId: number
  duplicate: boolean
  reopened?: boolean
}

type ErrorBody = { error?: { code?: string; message?: string } }

export function isDeveloperPlatformConfigured(): boolean {
  return Boolean(config.devPlatform.joinApiKey)
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = config.devPlatform.joinApiKey
  if (!key) {
    throw new DeveloperPlatformError(
      503,
      'DEVELOPER_NOT_CONFIGURED',
      '开发者平台接入尚未配置，请先在部署环境注入 JOIN_API_KEY',
    )
  }

  let res: Response
  try {
    res = await fetch(`${config.devPlatform.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new DeveloperPlatformError(502, 'DEVELOPER_UNREACHABLE', `无法连接开发者平台：${reason}`)
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const err = (body as ErrorBody | null)?.error
    throw new DeveloperPlatformError(
      res.status,
      err?.code || 'DEVELOPER_ERROR',
      err?.message || `开发者平台返回 ${res.status}`,
    )
  }
  return body as T
}

/** 项目列表：developer 只回 id 与 title，供用户选择后再提交申请 */
export function listProjects(input: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<DeveloperProjectPage> {
  const params = new URLSearchParams()
  if (input.q) params.set('q', input.q)
  params.set('page', String(input.page || 1))
  params.set('pageSize', String(input.pageSize || 20))
  return call<DeveloperProjectPage>(`/api/join/projects?${params.toString()}`)
}

/** 代用户提交 participant 申请；重复提交会返回 duplicate / reopened 标记 */
export function submitApplication(input: {
  ssoSub: string
  projectId: number
  resumeUrl: string
  note?: string
}): Promise<DeveloperApplyResult> {
  return call<DeveloperApplyResult>('/api/join/applies', {
    method: 'POST',
    body: JSON.stringify({
      ssoSub: input.ssoSub,
      projectId: input.projectId,
      resumeUrl: input.resumeUrl,
      ...(input.note ? { note: input.note } : {}),
    }),
  })
}