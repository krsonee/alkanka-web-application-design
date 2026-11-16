import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPanelSession } from '@/lib/admin-auth'
import { telegramAccess } from '@/lib/panel-modules'

export const dynamic = 'force-dynamic'

const GUIDE_FILE = path.join(process.cwd(), 'assets', 'panel-guides', 'alkanka-telegram-kilavuz.html')
const PRIVATE = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' }
const text = (message: string, status: number) => new Response(message, { status, headers: { ...PRIVATE, 'content-type': 'text/plain; charset=utf-8' } })

/**
 * The guide explains how the protections work, so it is never a public file: it lives outside `public/` and is
 * served only to a signed-in panel account that can open the Telegram section. Being under /panel, the main
 * site's host does not serve this path at all (see proxy.ts).
 */
export async function GET(request: Request) {
  const download = new URL(request.url).searchParams.has('indir')
  const session = await getPanelSession()
  if (!session) {
    // A download must fail rather than save the login page under the guide's name.
    if (download) return text('Panel oturumu gerekli. Panele giriş yapıp tekrar dene.', 401)
    return new Response(null, { status: 303, headers: { ...PRIVATE, location: '/panel' } })
  }
  const access = telegramAccess(session)
  if (!access.posts && !access.mod && !access.setup) return text('Bu hesabın Telegram bölümüne yetkisi yok.', 403)

  const html = await readFile(GUIDE_FILE, 'utf8')
  return new Response(html, {
    headers: {
      ...PRIVATE,
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...(download ? { 'content-disposition': 'attachment; filename="alkanka-telegram-kilavuz.html"' } : {}),
    },
  })
}
