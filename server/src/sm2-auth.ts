import { createRequire } from 'node:module'
import type { Response } from 'express'
import { config } from './config.js'

const require = createRequire(import.meta.url)
// sm-crypto 无类型定义、且为 CJS 包，用 require 加载；签名算法为 SM2withSM3
const smCrypto = require('sm-crypto') as {
  sm2: {
    doSignature: (
      msg: string,
      privateKey: string,
      opts?: { hash?: boolean; der?: boolean },
    ) => string
  }
}
const sm2 = smCrypto.sm2

/** SM2 签名默认 userId（ZA 杂凑参与方标识），与开发者平台约定一致 */
const SM2_USER_ID = '12345678123456781234567812345678'

/**
 * 签名串：`{slug}\n{ts}\n{nonce}\n{queryTime}`
 * queryTime 为本次调用的毫秒时间戳，与签名绑定后 token 仅对「这一次调用」有效。
 */
export function signPayload(slug: string, ts: string, nonce: string, queryTime: string): string {
  return `${slug}\n${ts}\n${nonce}\n${queryTime}`
}

function b64u(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url')
}

/**
 * 组装 x-model-Authorization token：base64url(slug).base64url(ts).base64url(nonce).base64url(sign)
 * sign 为 SM2 私钥签名结果（hex 文本，hash=true，非 DER），再按 UTF-8 文本 base64url。
 * 与开发者平台内部 API 指南的 Node 示例完全一致。
 */
export function buildModelAuthorization(slug: string, privateKeyHex: string): {
  Authorization: string
  'x-model-query-time': string
  ts: string
  nonce: string
} {
  const ts = String(Date.now())
  const nonce = Math.random().toString(36).slice(2, 12)
  const queryTime = String(Date.now())
  const payload = signPayload(slug, ts, nonce, queryTime)
  const sign = sm2.doSignature(payload, privateKeyHex, { hash: true, der: false })
  const auth = [b64u(slug), b64u(ts), b64u(nonce), b64u(sign)].join('.')
  return {
    Authorization: auth,
    'x-model-query-time': queryTime,
    ts,
    nonce,
  }
}

/** 供路由层构造 headers 使用（Express 请求头小写不敏感，但显式小写更稳妥） */
export function modelAuthHeaders(): Record<string, string> {
  const { Authorization, 'x-model-query-time': queryTime } = buildModelAuthorization(
    config.devPlatform.moduleSlug,
    config.devPlatform.modulePrivateKey,
  )
  return {
    'x-model-authorization': Authorization,
    'x-model-query-time': queryTime,
  }
}

export function isDevConfigured(): boolean {
  return Boolean(config.devPlatform.moduleSlug && config.devPlatform.modulePrivateKey)
}

/**
 * 安全地把 JSON body 写入响应（避免 undici/fetch 默认不再处理非 2xx 时抛错）。
 * 返回 res 上的 { status, data }；由调用方决定如何落库/回填。
 */
export function extractResponseError(status: number, body: unknown): string {
  const b = (body || {}) as Record<string, unknown>
  const message = typeof b.message === 'string' ? b.message : '开发者平台调用失败'
  return `[${status}] ${message}`
}

export { sm2 }
