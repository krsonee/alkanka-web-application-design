'use server'

import { getMember } from '@/lib/member'
import { inboxStatus, listInbox, markRead, type InboxMessage } from '@/lib/inbox'

export type InboxStatus = { unread: number; latest: InboxMessage | null }

export async function getInboxStatus(): Promise<InboxStatus> {
  const member = await getMember()
  if (!member) return { unread: 0, latest: null }
  return inboxStatus(member.id).catch((error) => {
    console.error('[inbox] durum okunamadı', error)
    return { unread: 0, latest: null }
  })
}

export async function getMyInbox(): Promise<InboxMessage[]> {
  const member = await getMember()
  if (!member) return []
  return listInbox(member.id)
}

export async function markInboxRead(ids: number[] | 'all'): Promise<void> {
  const member = await getMember()
  if (!member) return
  await markRead(member.id, ids === 'all' ? 'all' : Array.isArray(ids) ? ids : [])
}
