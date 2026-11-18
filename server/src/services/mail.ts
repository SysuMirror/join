import nodemailer from 'nodemailer'

type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

function smtpConfig(): SmtpConfig | null {
  let host = (process.env.SMTP_HOST || '').trim()
  let port = Number(process.env.SMTP_PORT || 0)
  const addr = (process.env.SMTP_ADDR || '').trim()
  if (!host && addr) {
    const [h, p] = addr.split(':')
    host = (h || '').trim()
    if (!port) port = Number(p || 0)
  }
  const user = (
    process.env.SMTP_USER ||
    process.env.SMTP_EMAIL_USERNAME ||
    ''
  ).trim()
  const pass = (
    process.env.SMTP_PASS ||
    process.env.SMTP_EMAIL_PASSWORD ||
    ''
  ).trim()
  if (!host || !user || !pass) return null
  const finalPort = port || 465
  const secure =
    process.env.SMTP_SECURE != null
      ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
      : finalPort === 465
  return {
    host,
    port: finalPort,
    secure,
    user,
    pass,
    from: (process.env.SMTP_FROM || user || 'ssemarket@163.com').trim(),
  }
}

export function isMailConfigured(): boolean {
  return smtpConfig() !== null
}

export async function sendMail(input: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<boolean> {
  const cfg = smtpConfig()
  if (!cfg) {
    console.warn('[mail] SMTP 未配置，跳过发送')
    return false
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    })
    await transporter.sendMail({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    return true
  } catch (err) {
    console.error('[mail] 发送失败:', err)
    return false
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[ch] || ch
  })
}

export async function sendHallInviteMail(input: {
  to: string
  name: string
  link: string
  department: string
  expiresAt: string
}): Promise<boolean> {
  const name = input.name || '同学'
  const department = input.department ? `（${input.department}）` : ''
  const subject = '【软工集市】邀请你填写年鉴 · 名人堂资料'
  const text = [
    `${name} 你好：`,
    '',
    `软工集市年鉴名人堂邀请你填写自己的资料${department}。`,
    '请通过下面的专属链接填写，链接在有效期内可以反复更新：',
    input.link,
    '',
    `链接有效期至：${input.expiresAt}`,
    '',
    '如果这不是你预期的邮件，可以忽略。',
    '软工集市',
  ].join('\n')
  const html = `
  <div style="background:#fafafa;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#171717">
    <div style="max-width:560px;margin:0 auto;background:#fff;padding:36px 32px;border:1px solid #eee">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;color:#3370ff">SSE MARKET · YEARBOOK</p>
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3">邀请你填写年鉴 · 名人堂资料</h1>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.8;color:#5f6368">${escapeHtml(name)} 你好：</p>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.8;color:#5f6368">
        软工集市年鉴名人堂邀请你填写自己的资料${escapeHtml(department)}。请通过下面的专属链接填写，链接在有效期内可以反复更新。
      </p>
      <p style="margin:0 0 26px">
        <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600">填写我的资料 →</a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#9aa0a6;word-break:break-all">若按钮无法点击，请复制链接：${escapeHtml(input.link)}</p>
      <p style="margin:0;font-size:12px;color:#9aa0a6">链接有效期至 ${escapeHtml(input.expiresAt)}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:26px 0" />
      <p style="margin:0;font-size:12px;color:#9aa0a6">如果这不是你预期的邮件，可以忽略。— 软工集市</p>
    </div>
  </div>`
  return sendMail({ to: input.to, subject, text, html })
}