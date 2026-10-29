import { getVerification } from '@/lib/deals'

export const revalidate = 300

/** Bing's file method uses the same code as the msvalidate.01 meta tag saved in the panel. */
export async function GET() {
  const { bing } = await getVerification().catch(() => ({ bing: '' }))
  const code = bing.replace(/[^A-Za-z0-9]/g, '')
  if (!code) return new Response('Not found', { status: 404 })
  return new Response(`<?xml version="1.0"?>\n<users>\n\t<user>${code}</user>\n</users>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
