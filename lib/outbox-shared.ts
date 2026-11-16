import { localToIso } from '@/lib/tg-posts-shared'

export type OutboxKind = 'push' | 'message'
export type OutboxStatus = 'waiting' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'missed'

export type OutboxItem = {
  id: number
  kind: OutboxKind
  title: string
  body: string
  target: string
  sendAt: string
  status: OutboxStatus
  /** Claimed for sending long ago and never finished: nobody knows whether it went out. */
  stuck: boolean
  createdBy: string
  result: string
}

export type MessageTemplate = { id: number; title: string; body: string; url: string }

export type SendResult = { ok: true; message: string } | { ok: false; error: string }

/** A scheduled send that comes up later than this is dropped instead of going out stale. */
export const OUTBOX_GRACE_MIN = 180
export const OUTBOX_MAX_WAITING = 30
export const OUTBOX_MAX_DAYS = 60
export const MAX_TEMPLATES = 30

type Clean<T> = { ok: true; value: T } | { ok: false; error: string }

const isSiteLink = (url: string) => url.startsWith('/') && !url.startsWith('//')
const LINK_ERROR = 'Link / ile başlamalı (ör. /oyunlar/cark).'

export function cleanPush(input: { title?: unknown; body?: unknown; url?: unknown }): Clean<{ title: string; body: string; url: string }> {
  const title = String(input.title ?? '').trim().slice(0, 60)
  const body = String(input.body ?? '').trim().slice(0, 180)
  const url = String(input.url ?? '').trim() || '/'
  if (!title || !body) return { ok: false, error: 'Başlık ve mesaj zorunlu.' }
  if (!isSiteLink(url)) return { ok: false, error: LINK_ERROR }
  return { ok: true, value: { title, body, url: url.slice(0, 200) } }
}

export function cleanMessage(input: {
  title?: unknown
  body?: unknown
  url?: unknown
  imageUrl?: unknown
}): Clean<{ title: string; body: string; url: string | null; imageUrl: string | null }> {
  const title = String(input.title ?? '').trim().slice(0, 80)
  const body = String(input.body ?? '').trim().slice(0, 1000)
  const url = String(input.url ?? '').trim()
  const imageUrl = String(input.imageUrl ?? '').trim()
  if (imageUrl && !/^\/api\/logo\/[a-z0-9._-]+$/i.test(imageUrl)) return { ok: false, error: 'Görsel geçersiz, tekrar yükle.' }
  if (!title || (!body && !imageUrl)) return { ok: false, error: 'Başlık ve mesaj (ya da görsel) zorunlu.' }
  if (url && !isSiteLink(url)) return { ok: false, error: LINK_ERROR }
  return { ok: true, value: { title, body, url: url ? url.slice(0, 200) : null, imageUrl: imageUrl || null } }
}

/** `YYYY-MM-DDTHH:mm` typed in Turkey time → ISO instant, if it is a usable send time. */
export function cleanSendAt(local: unknown, now = Date.now()): Clean<string> {
  const iso = localToIso(String(local ?? ''))
  if (!iso) return { ok: false, error: 'Gönderim zamanını seç.' }
  const at = new Date(iso).getTime()
  if (at < now + 60_000) return { ok: false, error: 'Gönderim zamanı en az 1 dakika sonrası olmalı.' }
  if (at > now + OUTBOX_MAX_DAYS * 86_400_000) return { ok: false, error: `En fazla ${OUTBOX_MAX_DAYS} gün sonrasına zamanlanabilir.` }
  return { ok: true, value: iso }
}
