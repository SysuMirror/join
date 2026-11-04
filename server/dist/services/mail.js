import nodemailer from 'nodemailer';
function env(key) {
    return (process.env[key] ?? '').trim();
}
/** 兼容两种注入风格：经典 SMTP_HOST/PORT/USER/PASS 与平台风格 SMTP_ADDR=host:port / SMTP_EMAIL_* */
function smtpConfig() {
    const addr = env('SMTP_ADDR');
    const [addrHost = '', addrPort = ''] = addr.split(':');
    const host = env('SMTP_HOST') || addrHost.trim();
    const port = Number(env('SMTP_PORT') || addrPort.trim()) || 465;
    const user = env('SMTP_USER') || env('SMTP_EMAIL_USERNAME');
    const pass = env('SMTP_PASS') || env('SMTP_EMAIL_PASSWORD');
    const secure = env('SMTP_SECURE') ? env('SMTP_SECURE') === 'true' : port === 465;
    return { host, port, secure, user, pass };
}
export function isMailConfigured() {
    const c = smtpConfig();
    return Boolean(c.host && c.port);
}
let transporter = null;
function getTransporter() {
    if (transporter)
        return transporter;
    const c = smtpConfig();
    transporter = nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.secure,
        auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    });
    return transporter;
}
/** 发送纯文本邮件；未配置 SMTP 时抛错，由调用方决定降级行为 */
export async function sendMail(to, subject, text) {
    if (!isMailConfigured())
        throw new Error('SMTP 未配置');
    const c = smtpConfig();
    const from = env('SMTP_FROM') || c.user || 'noreply@ssemarket.cn';
    await getTransporter().sendMail({ from, to, subject, text });
}
/** 发送登录验证码邮件；返回是否配置了 SMTP（未配置时不真正发送） */
export async function sendVerifyCodeMail(to, code) {
    if (!isMailConfigured()) {
        // 本地联调：显式开启 JOIN_MAIL_DEBUG 时把验证码回显到日志，避免无邮件客户端
        if (env('JOIN_MAIL_DEBUG') === 'true') {
            console.log(`[mail][DEBUG] 未配置 SMTP，验证码回显（仅供本地联调）：${to} -> ${code}`);
        }
        return false;
    }
    const subject = '【软工集市】登录验证码';
    const text = [
        '你好，',
        '',
        `你的登录验证码是：${code}`,
        '验证码 5 分钟内有效。如非本人操作请忽略本邮件。',
        '',
        '—— 软工集市',
    ].join('\n');
    await sendMail(to, subject, text);
    return true;
}
