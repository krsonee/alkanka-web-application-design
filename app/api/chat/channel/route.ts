import { getChannelFeed } from '@/lib/telegram-channels'
import { BROADCAST_CHANNELS, isBroadcastSlug } from '@/lib/telegram-channels-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? ''
  if (!isBroadcastSlug(slug)) return Response.json({ error: 'Bilinmeyen kanal' }, { status: 400 })
  try {
    return Response.json(await getChannelFeed(slug))
  } catch (error) {
    console.error('[channel-route]', error)
    const meta = BROADCAST_CHANNELS.find((c) => c.slug === slug)!
    return Response.json({ configured: false, title: meta.title, username: null, inviteUrl: null, posts: [] })
  }
}
