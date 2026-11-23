'use server'

import { cookies } from 'next/headers'
import { requireMember } from '@/lib/member'
import { AGE_COOKIE, rememberAdult } from '@/lib/sponsor-access'

export async function confirmAdult(): Promise<{ ok: boolean }> {
  const member = await requireMember()
  await rememberAdult(member.id)
  // The cookie only spares this browser the database lookup; the account record is what counts.
  const jar = await cookies()
  jar.set(AGE_COOKIE, member.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return { ok: true }
}
