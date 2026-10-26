import { SITE_URL } from '@/lib/seo'
import { listPosts } from '@/lib/blog'

export const revalidate = 3600

export async function GET() {
  const posts = await listPosts({ includeDrafts: false }).catch(() => [])
  const guides = posts
    .filter((p) => p.published)
    .map((p) => `- [${p.title}](${SITE_URL}/rehber/${p.slug}): ${p.excerpt}`)
    .join('\n')

  const body = `# Alkanka

> Alkanka; tavla, okey, 101 okey, pişti ve bilardo gibi klasik oyunların online oynandığı, turnuvaların ve topluluk etkinliklerinin düzenlendiği bir oyun platformudur.

## Oyunlar
- [Tavla](${SITE_URL}/oyna/tavla)
- [Okey](${SITE_URL}/oyna/okey)
- [Bilardo](${SITE_URL}/oyna/bilardo)
- [Tüm oyunlar](${SITE_URL}/oyunlar)

## Topluluk
- [Turnuvalar](${SITE_URL}/turnuvalar)
- [Şampiyonlar](${SITE_URL}/sampiyonlar)
- [Sıralama](${SITE_URL}/siralama)
- [Sık sorulan sorular](${SITE_URL}/sss)

## Rehber
${guides || `- [Rehber](${SITE_URL}/rehber)`}

## Yasal
- [Kullanım koşulları](${SITE_URL}/yasal/kullanim-kosullari)
- [Gizlilik](${SITE_URL}/yasal/gizlilik)
- [Sorumlu oyun](${SITE_URL}/yasal/sorumlu-oyun)
`

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
