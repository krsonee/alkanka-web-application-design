'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { canPanel, getPanelSession } from '@/lib/admin-auth'
import { addTarget } from '@/lib/telegram-mirror'
import { registerHook } from '@/lib/tg-hub'
import { checkTargets, copyPost, deleteSend, editPost, forgetSend, morePosts, pinSend, sendPost, sendTest, type SendOutcome } from '@/lib/tg-posts'
import type { PostRow, TargetCheck } from '@/lib/tg-posts-shared'

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

/** Runs one post operation behind the panel permission and refreshes the list when it changed something. */
async function guarded(run: () => Promise<SendOutcome>): Promise<SendOutcome> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const result = await run()
    if (result.ok) revalidatePath('/panel')
    return result
  } catch (error) {
    console.error('[tg-post-action]', error)
    return fail(error)
  }
}

export async function checkPostTargets(botId: number, chatIds: string[], needPin: boolean): Promise<{ ok: boolean; message: string; checks: TargetCheck[] }> {
  if (!(await canPanel('telegram'))) return { ...EXPIRED, checks: [] }
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

/** Points the bot's webhook at the site so presses on "Açılır yazı" buttons reach it. */
export async function listenPostBotAction(botId: number) {
  return guarded(async () => {
    const h = await headers()
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get('x-forwarded-host') ?? h.get('host') ?? ''
    if (!host || /localhost|127\.0\.0\.1/.test(host)) throw new Error('Bu işlem yayındaki siteden yapılmalı; önizlemede botun bildirim adresi ayarlanamaz.')
    await registerHook(botIdOf(botId), `https://${host}`)
    return { ok: true, message: 'Bot artık buton basışlarını dinliyor.' }
  })
}

export async function morePostsAction(beforeId: number): Promise<{ posts: PostRow[]; hasMore: boolean }> {
  if (!(await canPanel('telegram'))) return { posts: [], hasMore: false }
  return morePosts(idOf(beforeId)).catch(() => ({ posts: [], hasMore: false }))
}
