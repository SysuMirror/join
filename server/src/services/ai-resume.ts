import { config, isAiConfigured } from '../config.js'

export type AiResumeFields = {
  name?: string
  grade?: string
  email?: string
  phone?: string
  summary?: string
}

function clean(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max)
}

function pickFields(raw: Record<string, unknown>): AiResumeFields {
  return {
    name: clean(raw.name, 60),
    grade: clean(raw.grade, 20),
    email: clean(raw.email, 200),
    phone: clean(raw.phone, 40),
    summary: clean(raw.summary, 2000),
  }
}

function extractJson(content: string): Record<string, unknown> | null {
  const cleaned = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * 用 OpenAI 兼容的 chat/completions 接口从简历文本中提取
 * 姓名 / 年级 / 邮箱 / 手机 / 简介。失败返回 null，由调用方回退到规则解析。
 */
export async function parseResumeWithAi(text: string): Promise<AiResumeFields | null> {
  const content = String(text || '').trim()
  if (!content || !isAiConfigured()) return null

  const prompt = [
    '你是校园技术社团的简历信息提取助手。',
    '请从用户提供的简历文本中提取信息，只输出一个 JSON 对象，不要输出 Markdown、解释或多余文字。',
    'JSON 字段：',
    '{"name":"姓名","grade":"年级","email":"邮箱","phone":"手机号","summary":"简介"}',
    '规则：',
    '- grade：填写年级，如 大一 / 大二 / 大三 / 大四 / 研一 / 研二 / 研三 / 已毕业；无法判断就留空。',
    '- summary：用 2-4 句话概括此人的技术方向、项目/实践经历、兴趣和可投入时间；只基于原文，不要编造。',
    '- 所有字段都必须是字符串；原文没有的信息返回空字符串。',
    '- 不要输出任何 JSON 之外的内容。',
    '',
    '简历文本：',
    content.slice(0, 12000),
  ].join('\n')

  try {
    const res = await fetch(config.ai.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.ai.apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: '你只输出合法的 JSON，不要输出 Markdown 代码块。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      console.warn(`[ai-resume] HTTP ${res.status} ${detail}`)
      return null
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = extractJson(String(body.choices?.[0]?.message?.content || ''))
    if (!raw) {
      console.warn('[ai-resume] 模型未返回可解析的 JSON')
      return null
    }
    return pickFields(raw)
  } catch (e) {
    console.warn(`[ai-resume] 解析失败：${e instanceof Error ? e.message : e}`)
    return null
  }
}