'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { drawBadgeRaffle, rafflePoolSize, recentRaffles } from '@/lib/badge-value'
import { ALL_BADGES, type RaffleRow } from '@/lib/badge-raffle-shared'

type Picked = string[] | typeof ALL_BADGES

/** Anything that is not a list of ids or the "all badges" mark is refused, so a malformed call can never widen the draw. */
function picked(input: unknown): Picked | null {
  if (input === ALL_BADGES) return ALL_BADGES
  if (Array.isArray(input) && input.length > 0 && input.every((id) => typeof id === 'string' && id)) return input as string[]
  return null
}

export async function rafflePoolAction(input: unknown): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  if (!(await canPanel('badges'))) return { ok: false, error: 'Yetkin yok.' }
  const badges = picked(input)
  if (!badges) return { ok: true, size: 0 }
  try {
    return { ok: true, size: await rafflePoolSize(badges) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function drawRaffleAction(
  input: unknown,
  prize: number,
  note: string,
  winners = 1,
): Promise<{ ok: true; winners: string[]; recent: RaffleRow[] } | { ok: false; error: string }> {
  if (!(await canPanel('badges'))) return { ok: false, error: 'Yetkin yok.' }
  const badges = picked(input)
  if (!badges) return { ok: false, error: 'En az bir rozet seç.' }
  try {
    const names = await drawBadgeRaffle(badges, prize, String(note ?? ''), winners)
    revalidatePath('/rozetler')
    revalidatePath('/panel')
    const what = badges === ALL_BADGES ? 'tüm rozetler' : badges.join(', ').slice(0, 200)
    await logPanel('badges', 'Rozet çekilişi yapıldı', what, `${names.length} kazanan · kişi başı ${prize} KP`)
    return { ok: true, winners: names, recent: await recentRaffles(Math.max(10, names.length)).catch(() => []) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
