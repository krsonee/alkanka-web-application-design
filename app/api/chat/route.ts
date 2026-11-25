import { after } from 'next/server'
import { runChatSync } from '@/lib/auto-tick'
import { getMemberForRead } from '@/lib/member'
import { getLink, groupStanding } from '@/lib/telegram-chat'
import { readChatFeed } from '@/lib/chat-feed-read'
import { isChatModerator } from '@/lib/chat-mod'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  after(() => runChatSync().catch((error) => console.error('[chat-feed] telegram eşitlemesi', error)))
  // "Katıldım, kontrol et" asks with `taze=1`: the membership is looked up again instead of read from memory.
  const fresh = new URL(request.url).searchParams.get('taze') === '1'
  try {
    const [feed, member] = await Promise.all([readChatFeed(), getMemberForRead()])
    const link = member ? await getLink(member.id) : null
    const { joined, uncertain } = member && link && feed.configured ? await groupStanding(member.id, fresh) : { joined: false, uncertain: false }
    const mod = member && joined ? await isChatModerator(member.id).catch(() => false) : false
    const me = { loggedIn: Boolean(member), link, joined, uncertain, mod }
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
