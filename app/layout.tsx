import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { getVerification } from '@/lib/deals'
import { DEFAULT_OG, PAGE_SEO, SITE_NAME, SITE_URL } from '@/lib/seo'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-space-grotesk',
})

export async function generateMetadata(): Promise<Metadata> {
  const verify = await getVerification()
  const home = PAGE_SEO.anasayfa
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
      siteName: SITE_NAME,
      title: home.title,
      description: home.description,
      url: '/',
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: { card: 'summary_large_image', title: home.title, description: home.description, images: [DEFAULT_OG] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    verification: {
      google: verify.google || undefined,
      yandex: verify.yandex || undefined,
      other: verify.bing ? { 'msvalidate.01': verify.bing } : undefined,
    },
    ...BASE_META,
  }
}

const BASE_META: Metadata = {
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: { capable: true, title: 'AL KANKA', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0e17',
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
