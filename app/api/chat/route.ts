import { getMember } from '@/lib/member'
import { getFeed, getLink } from '@/lib/telegram-chat'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [feed, member] = await Promise.all([getFeed(), getMember()])
    const link = member ? await getLink(member.id) : null
    return Response.json({ ...feed, me: { loggedIn: Boolean(member), link } })
  } catch (error) {
    console.error('[chat-feed]', error)
    return Response.json(
      { configured: false, title: null, members: null, pinned: null, inviteUrl: null, messages: [], me: { loggedIn: false, link: null } },
      { status: 200 },
    )
  }
}
