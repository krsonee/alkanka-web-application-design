const GUIDE_PATH = '/downloads/alkanka-telegram-kilavuz.html'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const res = await fetch(new URL(GUIDE_PATH, url.origin), { cache: 'no-store' })
  if (!res.ok) return Response.redirect(new URL(GUIDE_PATH, url.origin), 302)
  const view = url.searchParams.has('ac')
  return new Response(await res.text(), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...(view ? {} : { 'content-disposition': 'attachment; filename="alkanka-telegram-kilavuz.html"' }),
    },
  })
}
