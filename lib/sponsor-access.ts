import 'server-only'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getMember, type Member } from '@/lib/member'

export const AGE_COOKIE = 'ak_18'

export type SponsorState = 'guest' | 'age' | 'open'
export type SponsorAccess = { member: Member | null; state: SponsorState }

export const MEMBERS_ONLY_ROBOTS: Metadata['robots'] = { index: false, follow: false }

export async function getSponsorAccess(known?: Member | null): Promise<SponsorAccess> {
  const member = known === undefined ? await getMember().catch(() => null) : known
  if (!member) return { member: null, state: 'guest' }
  const jar = await cookies()
  return { member, state: jar.get(AGE_COOKIE)?.value === member.id ? 'open' : 'age' }
}
