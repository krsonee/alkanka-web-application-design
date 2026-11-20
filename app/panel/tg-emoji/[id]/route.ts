import { getPanelSession } from '@/lib/admin-auth'
import { telegramAccess } from '@/lib/panel-modules'
import { emojiImage } from '@/lib/tg-emoji'

export const dynamic = 'force-dynamic'

const none = (status: number) => new Response(null, { status, headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } })

/**
 * The picture of one premium emoji, for the post writing area and its preview. Being under /panel it is served
 * only on the panel's host, and only to a signed-in account that may write Telegram posts.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,20}$/.test(id)) return none(404)
  const session = await getPanelSession()
  if (!session) return none(401)
  if (!telegramAccess(session).posts) return none(403)

  const image = await emojiImage(id).catch((error) => {
    console.error('[tg-emoji]', error)
    return null
  })
  if (!image) return none(404)
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      'content-type': image.mime,
      // An emoji id always means the same picture.
      'cache-control': 'private, max-age=2592000, immutable',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
