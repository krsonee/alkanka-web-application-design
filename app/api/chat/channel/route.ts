import { getMember } from '@/lib/member'
import { getChannelFeed } from '@/lib/telegram-channels'
import { BROADCAST_CHANNELS, isBroadcastSlug, type ChannelFeed } from '@/lib/telegram-channels-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const slug = query.get('slug') ?? ''
  if (!isBroadcastSlug(slug)) return Response.json({ error: 'Bilinmeyen kanal' }, { status: 400 })
  // "Katıldım, kontrol et" asks with `taze=1`: the membership is looked up again instead of read from memory.
  const fresh = query.get('taze') === '1'
  try {
    const member = await getMember()
    return Response.json(await getChannelFeed(slug, member?.id ?? null, fresh))
  } catch (error) {
    console.error('[channel-route]', error)
    const meta = BROADCAST_CHANNELS.find((c) => c.slug === slug)!
    const fallback: ChannelFeed = {
      configured: false,
      locked: false,
      title: meta.title,
      username: null,
      inviteUrl: null,
      posts: [],
      me: { loggedIn: false, link: null, joined: false },
    }
    return Response.json(fallback)
  }
}
