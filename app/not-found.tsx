import type { Metadata } from 'next'
import Link from 'next/link'
import { JakoAvatar } from '@/components/alkanka/jako'

export const metadata: Metadata = {
  title: 'Sayfa bulunamadı',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
      <JakoAvatar pose="uzgun" size="lg" className="size-40 rounded-3xl" alt="Üzgün Jako" />
      <h1 className="font-display text-3xl font-bold text-balance">Bu sayfa uçup gitmiş kanka</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        Aradığın sayfayı Jako bile bulamadı. Ana sayfaya dön, bonuslar seni bekliyor.
      </p>
      <Link href="/" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
        Ana sayfaya dön
      </Link>
    </main>
  )
}
