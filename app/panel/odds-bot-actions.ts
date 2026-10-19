'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { canPanel } from '@/lib/admin-auth'
import {
  addOddsSource,
  connectOddsWebhook,
  deleteOdds,
  deleteOddsSource,
  disconnectOddsWebhook,
  ingestManual,
  previewOddsPost,
  saveOddsBotConfig,
  setOddsSourceActive,
  setOddsStatus,
} from '@/lib/special-odds'
import type { OddsPreview } from '@/lib/special-odds-shared'
import type { ActionState } from './actions'

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }
const errorText = (error: unknown) => String((error as Error).message ?? error)
const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function refresh() {
  revalidatePath('/panel')
  revalidatePath('/ozel-oranlar')
}

async function siteOrigin() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  const h = await headers()
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`
}

export async function saveOddsBotAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const botId = Number(form.get('botId')) || null
    const config = await saveOddsBotConfig({
      enabled: form.get('enabled') === 'on',
      botId,
      channel: text(form, 'channel'),
      footer: text(form, 'footer'),
      filledWords: text(form, 'filledWords'),
      wonWords: text(form, 'wonWords'),
      lostWords: text(form, 'lostWords'),
      voidWords: text(form, 'voidWords'),
      expireMinutes: Number(form.get('expireMinutes')),
      filledText: text(form, 'filledText'),
      wonText: text(form, 'wonText'),
      lostText: text(form, 'lostText'),
      postResults: form.get('postResults') === 'on',
    })
    refresh()
    return { ok: true, message: config.enabled ? `Kaydedildi. Bot "${config.channelTitle}" kanalına paylaşacak.` : 'Kaydedildi. Bot şu an kapalı.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function connectOddsWebhookAction(_: ActionState): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    await connectOddsWebhook(await siteOrigin())
    refresh()
    return { ok: true, message: 'Anlık bağlantı (webhook) açıldı. Kaynak kanallara gelen postlar saniyeler içinde işlenecek.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function disconnectOddsWebhookAction(_: ActionState): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    await disconnectOddsWebhook()
    refresh()
    return { ok: true, message: 'Webhook kapatıldı. Bot artık cron ile birkaç dakikada bir kontrol edilecek.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function addOddsSourceAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const title = await addOddsSource({ chat: text(form, 'chat'), siteName: text(form, 'siteName'), siteLink: text(form, 'siteLink'), siteLogo: text(form, 'siteLogo') })
    refresh()
    return { ok: true, message: `"${title}" kaynak olarak eklendi.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function toggleOddsSourceAction(form: FormData) {
  if (!(await canPanel('telegram'))) return
  await setOddsSourceActive(Number(form.get('id')), form.get('active') === '1')
  refresh()
}

export async function deleteOddsSourceAction(form: FormData) {
  if (!(await canPanel('telegram'))) return
  await deleteOddsSource(Number(form.get('id')))
  refresh()
}

export async function previewOddsAction(textInput: string, sourceId: number | null): Promise<OddsPreview | { error: string }> {
  if (!(await canPanel('telegram'))) return { error: EXPIRED.message }
  try {
    return await previewOddsPost(textInput.slice(0, 4000), sourceId)
  } catch (error) {
    return { error: errorText(error) }
  }
}

export async function ingestManualAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const res = await ingestManual(Number(form.get('sourceId')), text(form, 'text').slice(0, 4000))
    refresh()
    const labels = { odds: 'yeni özel oran', filled: 'oran “doldu” yapıldı', won: 'oran kazandı', lost: 'oran kaybetti', void: 'oran iade', ignore: 'işlem yok' } as const
    if (!res.count) return { message: res.kind === 'ignore' ? 'Bu post özel oran, doldu ya da sonuç postu olarak tanınmadı.' : 'Eşleşen açık oran bulunamadı.' }
    return { ok: true, message: `${res.count} ${labels[res.kind]}.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

const ACTIONS = ['filled', 'open', 'won', 'lost', 'void', 'clear', 'delete'] as const

export async function bulkOddsAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const action = String(form.get('action')) as (typeof ACTIONS)[number]
  const ids = form.getAll('ids').map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (!ACTIONS.includes(action)) return { message: 'Geçersiz işlem' }
  if (!ids.length) return { message: 'Önce listeden oran seç.' }
  try {
    if (action === 'delete') await deleteOdds(ids)
    else await setOddsStatus(ids, action)
    refresh()
    return { ok: true, message: `${ids.length} oran güncellendi.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}
