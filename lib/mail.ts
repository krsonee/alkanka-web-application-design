import 'server-only'
import nodemailer from 'nodemailer'

// Works with any SMTP provider. Alibaba Cloud DirectMail: SMTP_HOST=smtpdm.aliyun.com, SMTP_PORT=465.
export const mailEnabled = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

const transporter = mailEnabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function layout(title: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#0b0f17;font-family:Arial,sans-serif;color:#e6e9ef">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#121826;border:1px solid #2a3142;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;color:#f2b632;letter-spacing:1px">AL KANKA</td></tr>
<tr><td style="padding-top:20px;font-size:18px;font-weight:bold">${escapeHtml(title)}</td></tr>
<tr><td style="padding-top:12px;font-size:14px;line-height:1.6;color:#aab2c2">${body}</td></tr>
<tr><td style="padding-top:24px"><a href="${cta.url}" style="display:inline-block;background:#f2b632;color:#0b0f17;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${escapeHtml(cta.label)}</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#6b7385">Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.</td></tr>
</table></td></tr></table></body></html>`
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    console.warn('[mail] SMTP ayarlı değil, e-posta gönderilmedi:', subject)
    return
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? `AL KANKA <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })
}

export const sendVerifyMail = (to: string, name: string, url: string) =>
  sendMail(
    to,
    'AL KANKA hesabını onayla',
    layout(`Hoş geldin ${name}`, 'Hesabını aktif etmek için aşağıdaki butona tıkla. Bağlantı 1 saat geçerlidir.', {
      label: 'Hesabımı onayla',
      url,
    }),
  )

export const sendResetMail = (to: string, url: string) =>
  sendMail(
    to,
    'AL KANKA şifre sıfırlama',
    layout('Şifreni sıfırla', 'Yeni şifre belirlemek için aşağıdaki butona tıkla. Bağlantı 1 saat geçerlidir.', {
      label: 'Yeni şifre belirle',
      url,
    }),
  )
