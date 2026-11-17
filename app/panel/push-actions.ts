'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel, getPanelSession } from '@/lib/panel-auth'
import { sendToAll, sendToEndpoint } from '@/lib/push'
import { cleanPush, type SendResult } from '@/lib/outbox-shared'

type PushInput = { title: string; body: string; url: string }

const NO_ACCESS: SendResult = { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }

export async function sendPushNow(input: PushInput): Promise<SendResult> {
  if (!(await canPanel('push'))) return NO_ACCESS
  const clean = cleanPush(input)
  if (!clean.ok) return clean
  try {
    const session = await getPanelSession()
    const r = await sendToAll(clean.value, session?.username ?? '')
    revalidatePath('/panel')
    await logPanel('push', 'Tüm cihazlara bildirim gönderildi', clean.value.title, `${r.sent} cihaz${r.failed ? ` · ${r.failed} başarısız` : ''}`)
    return { ok: true, message: `${r.sent} cihaza gönderildi${r.failed ? `, ${r.failed} başarısız` : ''}${r.removed ? ` (${r.removed} eski abonelik silindi)` : ''}.` }
  } catch (error) {
    console.error('[push] gönderilemedi', error)
    return { ok: false, error: 'Bildirim gönderilemedi.' }
  }
}

/** Sends the notification only to the device the panel is open on, so it can be checked before everyone gets it. */
export async function testPush(input: PushInput & { endpoint: string }): Promise<SendResult> {
  if (!(await canPanel('push'))) return NO_ACCESS
  const clean = cleanPush(input)
  if (!clean.ok) return clean
  const endpoint = String(input.endpoint ?? '').slice(0, 1000)
  if (!endpoint.startsWith('https://')) return { ok: false, error: 'Bu cihazın bildirim kaydı okunamadı.' }
  try {
    const outcome = await sendToEndpoint(endpoint, clean.value)
    if (outcome === 'missing') {
      return { ok: false, error: 'Bu cihaz bildirim listesinde kayıtlı değil. Siteyi bu tarayıcıda açıp bildirimleri yeniden aç, sonra tekrar dene.' }
    }
    if (outcome === 'failed') return { ok: false, error: 'Deneme bildirimi bu cihaza teslim edilemedi.' }
    await logPanel('push', 'Deneme bildirimi gönderildi', clean.value.title, 'Sadece gönderenin cihazına')
    return { ok: true, message: 'Sadece bu cihaza gönderildi. Birkaç saniye içinde bildirim olarak düşmeli; düşmezse cihazın bildirim ayarına bak.' }
  } catch (error) {
    console.error('[push] deneme gönderilemedi', error)
    return { ok: false, error: 'Deneme bildirimi gönderilemedi.' }
  }
}
