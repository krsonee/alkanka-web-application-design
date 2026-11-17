'use server'

import { revalidatePath } from 'next/cache'
import { logPanel } from '@/lib/panel-log'
import { canPanel, canPanelAny, getPanelSession } from '@/lib/panel-auth'
import { memberLabel } from '@/lib/inbox'
import { cancelScheduled, outboxKind, scheduleSend } from '@/lib/outbox'
import { OUTBOX_MAX_WAITING, cleanMessage, cleanPush, cleanSendAt, type SendResult } from '@/lib/outbox-shared'

const NO_ACCESS: SendResult = { ok: false, error: 'Bu bölüm için yetkin yok.' }
const FULL: SendResult = { ok: false, error: `Aynı anda en fazla ${OUTBOX_MAX_WAITING} gönderim bekleyebilir. Önce bekleyenlerden birini iptal et.` }

const timeFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

export async function schedulePush(input: { title: string; body: string; url: string; at: string }): Promise<SendResult> {
  if (!(await canPanel('push'))) return NO_ACCESS
  const clean = cleanPush(input)
  if (!clean.ok) return clean
  const at = cleanSendAt(input.at)
  if (!at.ok) return at
  const session = await getPanelSession()
  const id = await scheduleSend({ kind: 'push', ...clean.value, targetLabel: 'Tüm cihazlar', sendAt: at.value, createdBy: session?.username ?? '' })
  if (!id) return FULL
  const when = timeFmt.format(new Date(at.value))
  revalidatePath('/panel')
  await logPanel('push', 'Bildirim zamanlandı', clean.value.title, when)
  return { ok: true, message: `${when} için zamanlandı.` }
}

export async function scheduleMessage(input: { userId: string | null; title: string; body: string; url: string; imageUrl?: string; at: string }): Promise<SendResult> {
  if (!(await canPanel('messages'))) return NO_ACCESS
  const clean = cleanMessage(input)
  if (!clean.ok) return clean
  const at = cleanSendAt(input.at)
  if (!at.ok) return at

  let targetLabel = 'Tüm üyeler'
  const userId = input.userId ? String(input.userId) : null
  if (userId) {
    const label = await memberLabel(userId)
    if (!label) return { ok: false, error: 'Üye bulunamadı.' }
    targetLabel = label
  }

  const session = await getPanelSession()
  const id = await scheduleSend({ kind: 'message', ...clean.value, userId, targetLabel, sendAt: at.value, createdBy: session?.username ?? '' })
  if (!id) return FULL
  const when = timeFmt.format(new Date(at.value))
  revalidatePath('/panel')
  await logPanel('messages', 'Mesaj zamanlandı', userId ? targetLabel : 'Tüm üyeler', `${clean.value.title} · ${when}`)
  return { ok: true, message: `${when} için zamanlandı.` }
}

export async function cancelOutbox(id: number): Promise<SendResult> {
  if (!(await canPanelAny(['push', 'messages']))) return NO_ACCESS
  const kind = await outboxKind(Number(id))
  const area = kind === 'push' ? 'push' : 'messages'
  if (!kind || !(await canPanel(area))) return NO_ACCESS
  const title = await cancelScheduled(Number(id))
  revalidatePath('/panel')
  if (!title) return { ok: false, error: 'İptal edilemedi: gönderim başlamış ya da zaten bitmiş.' }
  await logPanel(area, kind === 'push' ? 'Zamanlanmış bildirim iptal edildi' : 'Zamanlanmış mesaj iptal edildi', title)
  return { ok: true, message: 'Zamanlanmış gönderim iptal edildi.' }
}
