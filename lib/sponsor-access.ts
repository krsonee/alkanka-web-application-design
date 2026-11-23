import 'server-only'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { rows, sql } from '@/lib/db'
import { getMember, type Member } from '@/lib/member'

export const AGE_COOKIE = 'ak_18'

export type SponsorState = 'guest' | 'age' | 'open'
export type SponsorAccess = { member: Member | null; state: SponsorState }

export const MEMBERS_ONLY_ROBOTS: Metadata['robots'] = { index: false, follow: false }

let adultsReady: Promise<unknown> | null = null
function ensureAdults() {
  adultsReady ??= rows(sql`CREATE TABLE IF NOT EXISTS member_adults (
    user_id text PRIMARY KEY, confirmed_at timestamptz NOT NULL DEFAULT now())`).catch((error) => {
    adultsReady = null
    throw error
  })
  return adultsReady
}

const REMEMBERED_MAX = 20_000
/** Members this server already knows to have confirmed, so a page asks the database about each of them once. */
const remembered = new Set<string>()

function remember(userId: string) {
  if (remembered.size >= REMEMBERED_MAX) remembered.clear()
  remembered.add(userId)
}

/** The confirmation belongs to the account: once given, it holds on every device and browser the member signs in from. */
export async function rememberAdult(userId: string) {
  await ensureAdults()
  await rows(sql`INSERT INTO member_adults (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`)
  remember(userId)
}

async function confirmedBefore(userId: string) {
  if (remembered.has(userId)) return true
  await ensureAdults()
  const found = await rows(sql`SELECT 1 FROM member_adults WHERE user_id = ${userId}`)
  if (found.length) remember(userId)
  return found.length > 0
}

export async function getSponsorAccess(known?: Member | null): Promise<SponsorAccess> {
  const member = known === undefined ? await getMember().catch(() => null) : known
  if (!member) return { member: null, state: 'guest' }
  const jar = await cookies()
  if (jar.get(AGE_COOKIE)?.value === member.id) {
    // A confirmation given before accounts kept it lives only in this browser's cookie; carry it over once.
    if (!remembered.has(member.id)) await rememberAdult(member.id).catch(() => null)
    return { member, state: 'open' }
  }
  const adult = await confirmedBefore(member.id).catch(() => false)
  return { member, state: adult ? 'open' : 'age' }
}
