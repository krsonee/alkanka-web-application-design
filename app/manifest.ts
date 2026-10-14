import type { MetadataRoute } from 'next'
import { getBranding, iconHref } from '@/lib/branding'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getBranding().catch(() => ({}))
  const icon192 = iconHref(192, branding) ?? '/icon-192.png'
  const icon512 = iconHref(512, branding) ?? '/icon-512.png'
  return {
    id: '/',
    name: 'AL KANKA',
    short_name: 'AL KANKA',
    description: 'Çark, sandık, rulet, blackjack ve kafa topu. Kanka Coin topla, marketten harca.',
    start_url: '/?kaynak=uygulama',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0e17',
    theme_color: '#0b0e17',
    lang: 'tr',
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Şans Çarkı', url: '/oyunlar/cark', icons: [{ src: icon192, sizes: '192x192' }] },
      { name: 'Oyunlar', url: '/oyunlar', icons: [{ src: icon192, sizes: '192x192' }] },
      { name: 'Puan marketi', url: '/market', icons: [{ src: icon192, sizes: '192x192' }] },
    ],
  }
}
