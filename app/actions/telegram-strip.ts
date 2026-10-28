'use server'

import { getMember } from '@/lib/member'
import { hasJoinedAnnouncements } from '@/lib/telegram-channels'

export async function getTelegramStripJoined(): Promise<boolean> {
  const member = await getMember()
  if (!member) return false
  return hasJoinedAnnouncements(member.id).catch(() => false)
}
