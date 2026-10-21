'use server'

import { canPanel } from '@/lib/admin-auth'
import { isSegment, mobileMembers, segmentUserIds, type MobileRow, type MobileSegment } from '@/lib/mobile'
import { sendToUsers } from '@/lib/push'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const cleanDate = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null)

export async function loadMobileMembers(segment: MobileSegment, from: string | null, to: string | null): Promise<MobileRow[] | null> {
  if (!(await canPanel('push')) || !isSegment(segment)) return null
  return mobileMembers(segment, cleanDate(from), cleanDate(to))
}

export async function sendSegmentPush(input: {
  segment: MobileSegment
  from: string | null
  to: string | null
  title: string
  body: string
  url: string
}): Promise<{ ok: boolean; message: string }> {
  if (!(await canPanel('push'))) return { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
  if (!isSegment(input.segment)) return { ok: false, message: 'Geçersiz segment.' }
  const title = String(input.title ?? '').trim().slice(0, 60)
  const body = String(input.body ?? '').trim().slice(0, 180)
  const url = String(input.url ?? '/').trim() || '/'
  if (!title || !body) return { ok: false, message: 'Başlık ve mesaj zorunlu.' }
  if (!url.startsWith('/') || url.startsWith('//')) return { ok: false, message: 'Link / ile başlamalı.' }
  try {
    const ids = await segmentUserIds(input.segment, cleanDate(input.from), cleanDate(input.to))
    if (!ids.length) return { ok: false, message: 'Bu segmentte üye yok.' }
    let sent = 0
    let failed = 0
    for (let i = 0; i < ids.length; i += 500) {
      const r = await sendToUsers(ids.slice(i, i + 500), { title, body, url: url.slice(0, 200) })
      sent += r.sent
      failed += r.failed
    }
    return { ok: true, message: `${ids.length} üyeden ${sent} cihaza gönderildi${failed ? `, ${failed} başarısız` : ''}.` }
  } catch (error) {
    console.error('[mobile] segment push failed', error)
    return { ok: false, message: 'Bildirim gönderilemedi.' }
  }
}
