import { SITE_URL } from '@/lib/seo'
import { trackClick } from '@/lib/tg-posts'

export const dynamic = 'force-dynamic'

/** Counts a press on a post's link button, then sends the visitor to the address stored for that button. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = await trackClick(id).catch((error) => {
    console.error('[tg-go]', error)
    return null
  })
  return new Response(null, {
    status: 302,
    headers: { Location: url ?? SITE_URL, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
