import { after } from 'next/server'
import { runChatSync } from '@/lib/auto-tick'
import { getMemberForRead } from '@/lib/member'
import { getLink, isGroupMember } from '@/lib/telegram-chat'
import { readChatFeed } from '@/lib/chat-feed-read'
import { isChatModerator } from '@/lib/chat-mod'

export const dynamic = 'force-dynamic'

export async function GET() {
  after(() => runChatSync().catch((error) => console.error('[chat-feed] telegram eşitlemesi', error)))
  try {
    const [feed, member] = await Promise.all([readChatFeed(), getMemberForRead()])
    const link = member ? await getLink(member.id) : null
    const joined = member && link && feed.configured ? await isGroupMember(member.id) : false
    const mod = member && joined ? await isChatModerator(member.id).catch(() => false) : false
    const me = { loggedIn: Boolean(member), link, joined, mod }
    if (feed.configured && !joined) return Response.json({ ...feed, pinned: null, messages: [], locked: true, me })
    return Response.json({ ...feed, locked: false, me })
  } catch (error) {
    console.error('[chat-feed]', error)
    return Response.json(
      {
        configured: false,
        title: null,
        members: null,
        pinned: null,
        inviteUrl: null,
        messages: [],
        locked: false,
        me: { loggedIn: false, link: null, joined: false },
      },
      { status: 200 },
    )
  }
}
