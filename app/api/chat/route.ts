import { getMember } from '@/lib/member'
import { getFeed, getLink, isGroupMember } from '@/lib/telegram-chat'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [feed, member] = await Promise.all([getFeed(), getMember()])
    const link = member ? await getLink(member.id) : null
    const joined = member && link && feed.configured ? await isGroupMember(member.id) : false
    const me = { loggedIn: Boolean(member), link, joined }
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
