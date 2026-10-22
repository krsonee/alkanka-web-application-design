import { canPanel } from '@/lib/admin-auth'

const GUIDE_URL = 'https://dvfychuqh3u6t59k.private.blob.vercel-storage.com/kilavuz/alkanka-telegram-kilavuz-lNjhxqVOUQGqBgvg1n3Me1uS6OncmO.html'

export async function GET(request: Request) {
  if (!(await canPanel('telegram'))) return new Response('Önce panele giriş yap.', { status: 401 })
  const res = await fetch(GUIDE_URL, { headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }, cache: 'no-store' })
  if (!res.ok) return new Response('Kılavuz şu an alınamadı.', { status: 502 })
  const view = new URL(request.url).searchParams.has('ac')
  return new Response(await res.text(), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      ...(view ? {} : { 'content-disposition': 'attachment; filename="alkanka-telegram-kilavuz.html"' }),
    },
  })
}
