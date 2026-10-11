'use server'

import { getMember } from '@/lib/member'
import { createLinkCode, sendFromSite, unlink } from '@/lib/telegram-chat'
import { sendChannelComment } from '@/lib/telegram-channels'
import { isBroadcastSlug } from '@/lib/telegram-channels-shared'

type Result = { ok: boolean; message?: string; url?: string }

const errorText = (error: unknown) => String((error as Error).message ?? error)

export async function sendChatMessage(text: string): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false, message: 'Yazmak için giriş yap.' }
  try {
    await sendFromSite(member.id, text)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: errorText(error) }
  }
}

export async function sendChannelCommentAction(slug: string, postId: number, text: string): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false, message: 'Yorum yapmak için giriş yap.' }
  if (!isBroadcastSlug(slug)) return { ok: false, message: 'Bilinmeyen kanal.' }
  try {
    await sendChannelComment(member.id, slug, Number(postId), String(text ?? ''))
    return { ok: true }
  } catch (error) {
    return { ok: false, message: errorText(error) }
  }
}

export async function startTelegramLink(): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false, message: 'Önce giriş yap.' }
  try {
    return { ok: true, url: await createLinkCode(member.id) }
  } catch (error) {
    return { ok: false, message: errorText(error) }
  }
}

export async function unlinkTelegram(): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false }
  await unlink(member.id)
  return { ok: true }
}
