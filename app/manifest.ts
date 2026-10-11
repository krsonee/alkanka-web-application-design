import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
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
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Şans Çarkı', url: '/oyunlar/cark', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Oyunlar', url: '/oyunlar', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Puan marketi', url: '/market', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
