export const BULK_LIMIT = 100
export const BULK_GIFT_MAX = 100_000
export const BULK_GIFT_TOTAL = 1_000_000
export const NOTE_MAX = 1000

export const SUSPEND_DURATIONS = [
  { id: '1', label: '1 gün' },
  { id: '7', label: '7 gün' },
  { id: '30', label: '30 gün' },
  { id: 'sure', label: 'Süresiz' },
] as const

export type BulkInput =
  | { kind: 'message'; title: string; body: string; url: string }
  | { kind: 'gift'; amount: number; message: string }
  | { kind: 'suspend'; duration: string; reason: string }

export type BulkSkipped = { name: string; why: string }
export type BulkResult = { done: number; skipped: BulkSkipped[] }

export type MemberNote = { id: number; author: string; body: string; createdAt: string; canDelete: boolean }

const tr = (n: number) => n.toLocaleString('tr-TR')

/** What stops this bulk action, in words the panel can show; null when it can run. Used by the form and by the server. */
export function bulkProblem(input: BulkInput, count: number): string | null {
  if (count < 1) return 'Önce listeden üye seç.'
  if (count > BULK_LIMIT) return `Tek seferde en fazla ${BULK_LIMIT} üye seçilebilir (seçtiğin ${count}).`

  if (input.kind === 'message') {
    const title = input.title.trim()
    const body = input.body.trim()
    const url = input.url.trim()
    if (!title) return 'Başlık yaz.'
    if (title.length > 80) return `Başlık en fazla 80 karakter olabilir (yazdığın ${title.length}).`
    if (!body) return 'Mesaj yaz.'
    if (body.length > 1000) return `Mesaj en fazla 1000 karakter olabilir (yazdığın ${body.length}).`
    if (url && (!url.startsWith('/') || url.startsWith('//'))) return 'Link / ile başlamalı (ör. /oyunlar/cark).'
    if (url.length > 200) return 'Link en fazla 200 karakter olabilir.'
    return null
  }

  if (input.kind === 'gift') {
    const n = input.amount
    if (!Number.isInteger(n) || n < 1 || n > BULK_GIFT_MAX) return `Hediye üye başına 1 ile ${tr(BULK_GIFT_MAX)} KC arasında bir tam sayı olmalı. Kanka Coin küsuratlı olmaz.`
    if (n * count > BULK_GIFT_TOTAL) return `Toplam ${tr(n * count)} KC ediyor. Toplu hediyede toplam en fazla ${tr(BULK_GIFT_TOTAL)} KC gönderilebilir.`
    if (input.message.trim().length > 300) return `Hediye mesajı en fazla 300 karakter olabilir (yazdığın ${input.message.trim().length}).`
    return null
  }

  const reason = input.reason.trim()
  if (!SUSPEND_DURATIONS.some((d) => d.id === input.duration)) return 'Geçersiz süre.'
  if (reason.length < 3) return 'Dondurma sebebi yaz.'
  if (reason.length > 500) return `Sebep en fazla 500 karakter olabilir (yazdığın ${reason.length}).`
  return null
}
