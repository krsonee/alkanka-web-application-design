import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { getVerification } from '@/lib/deals'
import { getShare } from '@/lib/share'
import { DEFAULT_OG, PAGE_SEO, SITE_NAME, SITE_URL } from '@/lib/seo'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-space-grotesk',
})

export async function generateMetadata(): Promise<Metadata> {
  const [verify, share] = await Promise.all([getVerification(), getShare()])
  const home = PAGE_SEO.anasayfa
  const ogTitle = share.title || home.title
  const ogDescription = share.description || home.description
  const ogImage = share.image || DEFAULT_OG
  const ogSite = share.siteName || SITE_NAME
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: home.title, template: `%s | ${SITE_NAME}` },
    description: home.description,
    keywords: home.keywords,
    applicationName: SITE_NAME,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'tr_TR',
      siteName: ogSite,
      title: ogTitle,
      description: ogDescription,
      url: '/',
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogSite }],
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDescription, images: [ogImage] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    verification: {
      google: verify.google || undefined,
      yandex: verify.yandex || undefined,
      other: {
        ...(verify.bing ? { 'msvalidate.01': verify.bing } : {}),
        ...(verify.meta ? { 'facebook-domain-verification': verify.meta } : {}),
      },
    },
    ...BASE_META,
  }
}

const BASE_META: Metadata = {
  icons: {
    icon: [
      { url: '/icon-dark-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/app-icon/180',
  },
  appleWebApp: { capable: true, title: 'AL KANKA', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0e17',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className={`${inter.variable} ${spaceGrotesk.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
