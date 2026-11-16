'use server'

import { revalidatePath } from 'next/cache'
import { getPanelSession } from '@/lib/admin-auth'
import { telegramAccess, type TelegramArea } from '@/lib/panel-modules'
import { syncGuardHook } from '@/lib/tg-hub'
import type { InviteRow, ResilienceData, TgStats } from '@/lib/tg-resilience-shared'

type Result = { ok: boolean; message: string }

const EXPIRED: Result = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
const DENIED: Record<TelegramArea, string> = {
  posts: 'Bu işlem için "Telegram postları" izni gerekli.',
  mod: 'Bu işlem için "Telegram moderasyon" izni gerekli.',
  setup: 'Bu işlem için "Telegram kurulum" izni gerekli.',
}
const fail = (error: unknown): Result => ({ ok: false, message: String((error as Error)?.message ?? error) })

async function blocked(area: TelegramArea): Promise<Result | null> {
  const session = await getPanelSession()
  if (!session) return EXPIRED
  return telegramAccess(session)[area] ? null : { ok: false, message: DENIED[area] }
}

async function actor() {
  const session = await getPanelSession()
  return session?.displayName || session?.username || 'Panel'
}

/** Opening or closing a link changes whether the guard bot must be told about joins. */
async function hookNote() {
  try {
    await syncGuardHook()
    return ''
  } catch (error) {
    return ` Ancak Bekçi botunun bağlantısı güncellenemedi (${String((error as Error).message)}); girişler sayılmayabilir. Kurulum sekmesinden Bekçi'yi tekrar "Bağla".`
  }
}

export async function loadResilienceAction(): Promise<ResilienceData | null> {
  if (await blocked('mod')) return null
  const { loadResilience } = await import('@/lib/tg-address')
  return loadResilience()
}

export async function switchChannelAction(address: string): Promise<Result & { notes?: string[] }> {
  const no = await blocked('setup')
  if (no) return no
  try {
    const { switchChannel } = await import('@/lib/tg-address')
    const done = await switchChannel(String(address ?? ''), await actor())
    revalidatePath('/', 'layout')
    return { ok: true, message: `Güncel kanal adresi artık ${done.url}`, notes: done.notes }
  } catch (error) {
    return fail(error)
  }
}

export async function createInviteAction(chatId: string, name: string, approval: boolean): Promise<Result & { invite?: InviteRow }> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { createInvite } = await import('@/lib/tg-invites')
    const invite = await createInvite({ chatId: String(chatId ?? ''), name: String(name ?? ''), approval: Boolean(approval), by: await actor() })
    return { ok: true, message: `"${invite.name}" linki açıldı.${await hookNote()}`, invite }
  } catch (error) {
    return fail(error)
  }
}

export async function revokeInviteAction(id: number): Promise<Result> {
  const no = await blocked('mod')
  if (no) return no
  try {
    const { revokeInvite } = await import('@/lib/tg-invites')
    const res = await revokeInvite(Number(id), await actor())
    return res.ok ? { ok: true, message: `${res.message}${await hookNote()}` } : res
  } catch (error) {
    return fail(error)
  }
}

/** Scans the message and join history of the period, so the panel asks for it instead of loading it with the page. */
export async function loadTgStatsAction(chatId: string, days: number): Promise<TgStats | null> {
  if (await blocked('mod')) return null
  const { loadTgStats } = await import('@/lib/tg-pulse')
  return loadTgStats(String(chatId ?? ''), Number(days))
}
