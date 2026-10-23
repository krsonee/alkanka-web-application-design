'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { canPanel } from '@/lib/admin-auth'
import { connectChat, disconnectChat } from '@/lib/telegram-chat'
import {
  addBot,
  addSource,
  addTarget,
  deleteBot,
  deleteSource,
  deleteTarget,
  getCronKey,
  normalizeChannel,
  runMirror,
  setSourceActive,
  setTargetActive,
  testTarget,
  updateSourceText,
} from '@/lib/telegram-mirror'
import { encodeFilter } from '@/lib/telegram-filters'
import { deleteShareRule, saveApprovalSettings, saveOddsSettings, saveShareRule, saveShareSettings, setOddsResult, testApproval } from '@/lib/telegram-bots'
import { saveChannels } from '@/lib/telegram-channels'
import { BROADCAST_CHANNELS, type BroadcastSlug } from '@/lib/telegram-channels-shared'
import type { ActionState } from './actions'

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }
const errorText = (error: unknown) => String((error as Error).message ?? error)

export async function addBotAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const me = await addBot(String(form.get('token') ?? '').trim())
    revalidatePath('/panel')
    return { ok: true, message: `@${me.username} bağlandı. Şimdi bu bot için hedef kanal ekle.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function deleteBotAction(form: FormData) {
  if (!(await canPanel('telegram'))) return
  await deleteBot(Number(form.get('id')))
  revalidatePath('/panel')
}

export async function addTargetAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const botId = Number(form.get('botId'))
  if (!botId) return { message: 'Önce bir bot seç.' }
  try {
    const title = await addTarget(botId, String(form.get('chat') ?? ''))
    revalidatePath('/panel')
    return { ok: true, message: `"${title}" hedef kanal olarak bağlandı.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function toggleTargetAction(form: FormData) {
  if (!(await canPanel('telegram'))) return
  await setTargetActive(Number(form.get('id')), form.get('active') === 'true')
  revalidatePath('/panel')
}

export async function deleteTargetAction(form: FormData) {
  if (!(await canPanel('telegram'))) return
  await deleteTarget(Number(form.get('id')))
  revalidatePath('/panel')
}

export async function testTargetAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const title = await testTarget(Number(form.get('id')))
    return { ok: true, message: `Test mesajı "${title}" kanalına gönderildi.` }
  } catch (error) {
    return { message: `Gönderilemedi: ${errorText(error)}` }
  }
}

export async function addSourceAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const channel = normalizeChannel(String(form.get('channel') ?? ''))
  const brand = String(form.get('brand') ?? '').trim().slice(0, 40)
  const link = String(form.get('link') ?? '').trim().slice(0, 500)
  const presets = form.getAll('presets').map(String)
  const keywords = encodeFilter(presets, String(form.get('keywords') ?? '')).slice(0, 300)
  const targetId = Number(form.get('targetId')) || null
  if (!channel) return { message: 'Kanal adı geçersiz. Örnek: @markaresmi ya da t.me/markaresmi' }
  if (!brand) return { message: 'Marka adı zorunlu.' }
  try {
    const url = new URL(link)
    if (url.protocol !== 'https:') throw new Error()
  } catch {
    return { message: 'Link https:// ile başlayan geçerli bir adres olmalı.' }
  }
  const replacements = String(form.get('replacements') ?? '').slice(0, 3000)
  const footer = String(form.get('footer') ?? '').trim().slice(0, 300)
  await addSource({ channel, brand, link, keywords, targetId, replacements, footer })
  revalidatePath('/panel')
  return { ok: true, message: `@${channel} eklendi. İlk kontrolde mevcut postlar atlanır, sadece yeni postlar paylaşılır.` }
}

export async function updateSourceTextAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const link = String(form.get('link') ?? '').trim().slice(0, 500)
  try {
    if (new URL(link).protocol !== 'https:') throw new Error()
  } catch {
    return { message: 'Link https:// ile başlayan geçerli bir adres olmalı.' }
  }
  await updateSourceText(Number(form.get('id')), {
    link,
    replacements: String(form.get('replacements') ?? '').slice(0, 3000),
    footer: String(form.get('footer') ?? '').trim().slice(0, 300),
  })
  revalidatePath('/panel')
  return { ok: true, message: 'Kaydedildi. Bundan sonraki postlarda geçerli.' }
}

export async function toggleSourceAction(form: FormData) {
  if (!(await canPanel('telegram'))) return
  await setSourceActive(Number(form.get('id')), form.get('active') === 'true')
  revalidatePath('/panel')
}

export async function deleteSourceAction(form: FormData) {
  if (!(await canPanel('telegram'))) return
  await deleteSource(Number(form.get('id')))
  revalidatePath('/panel')
}

export async function rotateCronKeyAction() {
  if (!(await canPanel('telegram'))) return
  await getCronKey(true)
  revalidatePath('/panel')
}

export async function connectInviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const botId = Number(form.get('botId'))
  const chat = String(form.get('chat') ?? '').trim()
  if (!botId) return { message: 'Önce bir bot seç.' }
  if (!chat) return { message: 'Kanal kullanıcı adını ya da ID’sini yaz.' }
  try {
    const { connectInviteChannel } = await import('@/lib/table-invite')
    const title = await connectInviteChannel(botId, chat)
    revalidatePath('/panel')
    return { ok: true, message: `"${title}" bağlandı. Masa davetleri bu kanala düşecek.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function saveChannelsAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const input = Object.fromEntries(BROADCAST_CHANNELS.map((c) => [c.slug, String(form.get(c.slug) ?? '')])) as Record<BroadcastSlug, string>
    const saved = await saveChannels(input)
    revalidatePath('/panel')
    return { ok: true, message: saved.length ? `Kaydedildi: ${saved.join(', ')}.` : 'Kanal bağlantıları temizlendi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function disconnectInviteAction() {
  if (!(await canPanel('telegram'))) return
  const { disconnectInviteChannel } = await import('@/lib/table-invite')
  await disconnectInviteChannel()
  revalidatePath('/panel')
}

export async function connectChatAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const botId = Number(form.get('botId'))
  const chat = String(form.get('chat') ?? '').trim()
  if (!botId) return { message: 'Önce bir bot seç.' }
  if (!chat) return { message: 'Grup kullanıcı adını ya da ID’sini yaz.' }
  const h = await headers()
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const host = production ?? h.get('x-forwarded-host') ?? h.get('host') ?? ''
  if (!host || /localhost|127\.0\.0\.1/.test(host)) {
    return { message: 'Webhook için sitenin yayında olması gerekiyor. Önce Publish ile yayınla, sonra panelden tekrar bağla.' }
  }
  try {
    const title = await connectChat(botId, chat, `https://${host}`)
    revalidatePath('/panel')
    return { ok: true, message: `"${title}" bağlandı. Gruba yazılan yeni mesajlar sitede görünecek.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function disconnectChatAction() {
  if (!(await canPanel('telegram'))) return
  await disconnectChat()
  revalidatePath('/panel')
}

async function siteOrigin() {
  const h = await headers()
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get('x-forwarded-host') ?? h.get('host') ?? ''
  return host && !/localhost|127\.0\.0\.1/.test(host) ? `https://${host}` : ''
}

const formIds = (form: FormData, name: string) =>
  form
    .getAll(name)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)

export async function saveShareAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const enabled = form.get('enabled') === 'on'
    await saveShareSettings({ enabled, botId: Number(form.get('botId')) || null, siteOrigin: await siteOrigin() })
    revalidatePath('/panel')
    return { ok: true, message: enabled ? 'Paylaşım botu açık. Aşağıdan sponsorları ekle.' : 'Paylaşım botu kapatıldı.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function saveShareRuleAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const id = String(form.get('id') ?? '')
    const rule = await saveShareRule({
      id,
      name: String(form.get('name') ?? ''),
      enabled: form.get('ruleEnabled') === 'on',
      sourceChat: String(form.get('sourceChat') ?? ''),
      trigger: String(form.get('trigger') ?? ''),
      appendText: String(form.get('appendText') ?? ''),
      replyText: String(form.get('replyText') ?? ''),
      targetIds: formIds(form, 'targetIds'),
    })
    revalidatePath('/panel')
    return { ok: true, message: `${id ? 'Kaydedildi' : 'Eklendi'}: "${rule.name}" (${rule.sourceTitle}) grubu dinleniyor.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function deleteShareRuleAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    await deleteShareRule(String(form.get('id') ?? ''))
    revalidatePath('/panel')
    return { ok: true, message: 'Sponsor silindi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function saveOddsAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    await saveOddsSettings({
      note: String(form.get('note') ?? ''),
      winText: String(form.get('winText') ?? ''),
      targetIds: formIds(form, 'targetIds'),
    })
    revalidatePath('/panel')
    return { ok: true, message: 'Özel oran ayarları kaydedildi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function setOddsResultAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const dealId = Number(form.get('dealId'))
  const raw = String(form.get('result') ?? '')
  const result = raw === 'won' || raw === 'lost' ? raw : null
  if (!dealId) return { message: 'Özel oran seçilmedi.' }
  try {
    const { posted } = await setOddsResult(dealId, result)
    revalidatePath('/panel')
    revalidatePath('/ozel-oranlar')
    if (result === 'won') return { ok: true, message: posted ? `Kazandı olarak işaretlendi, ${posted} kanala duyuruldu.` : 'Kazandı olarak işaretlendi.' }
    return { ok: true, message: result === 'lost' ? 'Kaybetti olarak işaretlendi.' : 'Sonuç temizlendi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function saveApprovalsAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const enabled = form.get('enabled') === 'on'
    const title = await saveApprovalSettings({
      enabled,
      botId: Number(form.get('botId')) || null,
      chatId: String(form.get('chatId') ?? ''),
      templates: {
        market: String(form.get('tpl_market') ?? ''),
        task: String(form.get('tpl_task') ?? ''),
        complaint: String(form.get('tpl_complaint') ?? ''),
      },
      siteOrigin: await siteOrigin(),
    })
    revalidatePath('/panel')
    return { ok: true, message: enabled ? `Onay bildirimleri "${title}" grubuna gidecek.` : 'Onay bildirimleri kapatıldı.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function testApprovalAction(): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    await testApproval()
    return { ok: true, message: 'Test bildirimi gönderildi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function runMirrorAction(): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const r = await runMirror()
    revalidatePath('/panel')
    const parts = [`${r.checked} kaynak kontrol edildi`, `${r.sent} post paylaşıldı`]
    if (r.skipped) parts.push(`${r.skipped} atlandı`)
    if (r.failed) parts.push(`${r.failed} başarısız`)
    if (r.primed) parts.push(`${r.primed} yeni kaynak için başlangıç noktası kaydedildi`)
    return { ok: r.errors.length === 0, message: parts.join(', ') + '.' + (r.errors.length ? ` Hatalar: ${r.errors.join(' | ')}` : '') }
  } catch (error) {
    return { message: errorText(error) }
  }
}
