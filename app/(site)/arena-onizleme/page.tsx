import type { Metadata } from 'next'
import { KaraDelikPreview } from '@/components/alkanka/karadelik/karadelik-preview'

export const metadata: Metadata = {
  title: 'Kara Delik Arenası · Ön izleme',
  robots: { index: false, follow: false },
}

export default function ArenaPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <KaraDelikPreview />
    </main>
  )
}
