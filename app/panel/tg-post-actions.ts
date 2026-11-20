'use server'

import { revalidatePath } from 'next/cache'
import { logged } from '@/lib/panel-log'
import { headers } from 'next/headers'
import { getPanelSession } from '@/lib/admin-auth'
import { telegramAccess, type TelegramArea } from '@/lib/panel-modules'
import { addTarget } from '@/lib/telegram-mirror'
import { registerHook } from '@/lib/tg-hub'
import { checkTargets, copyPost, deleteSend, editPost, forgetSend, morePosts, pinSend, sendPost, sendTest, type SendOutcome } from '@/lib/tg-posts'
import { deleteRule, saveRule } from '@/lib/tg-post-manual'
import { deletePlan, draftFromPost, planToDraft, reschedulePlan, savePlan, sendPlanNow } from '@/lib/tg-post-plans'
import { announceRaffle, drawRaffle, setRaffleClosed } from '@/lib/tg-post-press'
import { addEmojiPack, listEmojiPacks, removeEmojiPack } from '@/lib/tg-emoji'
import type { EmojiPack, PlanKind, PostRow, TargetCheck } from '@/lib/tg-posts-shared'

const EXPIRED: SendOutcome = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
const fail = (error: unknown): SendOutcome => ({ ok: false, message: String((error as Error)?.message ?? error) })

const botIdOf = (v: unknown) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new Error('Gönderecek botu seç.')
  return n
}
const idOf = (v: unknown) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new Error('Geçersiz kayıt.')
  return n
}
const chatList = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])

const DENIED: Record<TelegramArea, string> = {
  posts: 'Bu işlem için "Telegram postları" izni gerekli.',
  mod: 'Bu işlem için "Telegram moderasyon" izni gerekli.',
  setup: 'Bu işlem için "Telegram kurulum" izni gerekli.',
}

/** Null when the signed-in account may go on; otherwise the reason to show it. */
async function blocked(area: TelegramArea): Promise<SendOutcome | null> {
  const session = await getPanelSession()
  if (!session) return EXPIRED
  return telegramAccess(session)[area] ? null : { ok: false, message: DENIED[area] }
}

/** Runs one post operation behind the panel permission and refreshes the list when it changed something. */
async function guarded<T extends SendOutcome>(run: () => Promise<T>, area: TelegramArea = 'posts'): Promise<T | SendOutcome> {
  const no = await blocked(area)
  if (no) return no
  try {
    const result = await run()
    if (result.ok) revalidatePath('/panel')
    return logged(area === 'posts' ? 'tg_posts' : area === 'mod' ? 'tg_mod' : 'telegram', result)
  } catch (error) {
    console.error('[tg-post-action]', error)
    return fail(error)
  }
}

export async function checkPostTargets(botId: number, chatIds: string[], needPin: boolean): Promise<{ ok: boolean; message: string; checks: TargetCheck[] }> {
  const no = await blocked('posts')
  if (no) return { ...no, checks: [] }
  try {
    const checks = await checkTargets(botIdOf(botId), chatList(chatIds), Boolean(needPin))
    const bad = checks.filter((c) => !c.ok).length
    return { ok: bad === 0, message: bad ? `${bad} hedefte sorun var.` : 'Bot seçili hedeflerin hepsine gönderebilir.', checks }
  } catch (error) {
    return { ...fail(error), checks: [] }
  }
}

export async function sendPostAction(input: { content: unknown; botId: number; chatIds: string[] }) {
  return guarded(async () => {
    const session = await getPanelSession()
    return sendPost({ content: input.content, botId: botIdOf(input.botId), chatIds: chatList(input.chatIds), author: session?.displayName || session?.username || 'Panel' })
  })
}

export async function testPostAction(input: { content: unknown; botId: number; chat: string }) {
  return guarded(() => sendTest({ content: input.content, botId: botIdOf(input.botId), chat: String(input.chat ?? '') }))
}

export async function emojiPacksAction(): Promise<EmojiPack[]> {
  if (await blocked('posts')) return []
  return listEmojiPacks().catch((error) => {
    console.error('[tg-post-action]', error)
    return []
  })
}

export async function addEmojiPackAction(botId: number, link: string) {
  return guarded(() => addEmojiPack(botIdOf(botId), String(link ?? '')))
}

export async function removeEmojiPackAction(name: string) {
  return guarded(() => removeEmojiPack(String(name ?? '')))
}

export async function editPostAction(postId: number, content: unknown) {
  return guarded(() => editPost(idOf(postId), content))
}

export async function copyPostAction(postId: number, chatIds: string[]) {
  return guarded(() => copyPost(idOf(postId), chatList(chatIds)))
}

export async function deleteSendAction(sendId: number) {
  return guarded(() => deleteSend(idOf(sendId)))
}

export async function forgetSendAction(sendId: number) {
  return guarded(() => forgetSend(idOf(sendId)))
}

export async function pinSendAction(sendId: number, pin: boolean) {
  return guarded(() => pinSend(idOf(sendId), Boolean(pin)))
}

export async function addPostTargetAction(botId: number, chat: string) {
  return guarded(async () => {
    const title = await addTarget(botIdOf(botId), String(chat ?? ''))
    return { ok: true, message: `"${title}" hedeflere eklendi.` }
  })
}

/**
 * Points the bot's webhook at the site so presses on "Açılır yazı" buttons reach it.
 * It changes where a bot's updates are delivered, so it needs the setup permission rather than posting.
 */
export async function listenPostBotAction(botId: number) {
  return guarded(async () => {
    const h = await headers()
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get('x-forwarded-host') ?? h.get('host') ?? ''
    if (!host || /localhost|127\.0\.0\.1/.test(host)) throw new Error('Bu işlem yayındaki siteden yapılmalı; önizlemede botun bildirim adresi ayarlanamaz.')
    const id = botIdOf(botId)
    // The odds bot reads its channel by polling when it has no webhook of its own; a webhook here would cut that off.
    const { getOddsBotConfig } = await import('@/lib/special-odds')
    const odds = await getOddsBotConfig().catch(() => null)
    if (odds?.botId === id) throw new Error('Bu bot Özel Oran botu; kendi bağlantısını kullanıyor. Açılır yazı butonu için başka bir bot seç.')
    await registerHook(id, `https://${host}`)
    return { ok: true, message: 'Bot artık buton basışlarını dinliyor.' }
  }, 'setup')
}

const authorName = async () => {
  const session = await getPanelSession()
  return session?.displayName || session?.username || 'Panel'
}

// --- Drafts, templates, scheduled posts -------------------------------------------

export async function savePlanAction(input: {
  id?: number | null
  kind: PlanKind
  name: string
  botId: number
  chatIds: string[]
  content: unknown
  sendAt?: string | null
  repeat?: string
  graceMin?: number
}) {
  return guarded(async () => {
    const kind: PlanKind = input.kind === 'template' || input.kind === 'scheduled' ? input.kind : 'draft'
    const botId = Number(input.botId)
    return savePlan({
      id: input.id ? idOf(input.id) : null,
      kind,
      name: String(input.name ?? ''),
      botId: Number.isInteger(botId) && botId > 0 ? botId : null,
      chatIds: chatList(input.chatIds),
      content: input.content,
      author: await authorName(),
      sendAt: input.sendAt ? String(input.sendAt) : null,
      repeat: String(input.repeat ?? 'none'),
      graceMin: Number(input.graceMin),
    })
  })
}

export async function deletePlanAction(id: number) {
  return guarded(() => deletePlan(idOf(id)))
}

export async function reschedulePlanAction(id: number, input: { sendAt: string; repeat: string; graceMin: number }) {
  return guarded(() => reschedulePlan(idOf(id), { sendAt: String(input.sendAt ?? ''), repeat: String(input.repeat ?? 'none'), graceMin: Number(input.graceMin) }))
}

export async function planToDraftAction(id: number) {
  return guarded(() => planToDraft(idOf(id)))
}

export async function sendPlanNowAction(id: number) {
  return guarded(() => sendPlanNow(idOf(id)))
}

export async function draftFromPostAction(postId: number) {
  return guarded(async () => draftFromPost(idOf(postId), await authorName()))
}

// --- Raffle ----------------------------------------------------------------------

export async function closeRaffleAction(postId: number, closed: boolean) {
  return guarded(() => setRaffleClosed(idOf(postId), Boolean(closed)))
}

export async function drawRaffleAction(postId: number, count: number) {
  return guarded(() => drawRaffle(idOf(postId), Number(count)))
}

export async function announceRaffleAction(postId: number) {
  return guarded(() => announceRaffle(idOf(postId)))
}

// --- Channel rules ---------------------------------------------------------------

export async function saveRuleAction(input: { botId: number; chatId: string; enabled: boolean; signature: string; sponsorId: string; buttons: unknown }) {
  return guarded(() =>
    saveRule({
      botId: botIdOf(input.botId),
      chatId: String(input.chatId ?? ''),
      enabled: Boolean(input.enabled),
      signature: String(input.signature ?? ''),
      sponsorId: String(input.sponsorId ?? ''),
      buttons: input.buttons,
    }),
  )
}

export async function deleteRuleAction(botId: number, chatId: string) {
  return guarded(() => deleteRule(botIdOf(botId), String(chatId ?? '')))
}

export async function morePostsAction(beforeId: number): Promise<{ posts: PostRow[]; hasMore: boolean }> {
  if (await blocked('posts')) return { posts: [], hasMore: false }
  return morePosts(idOf(beforeId)).catch(() => ({ posts: [], hasMore: false }))
}
