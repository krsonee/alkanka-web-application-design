import type { Metadata } from 'next'
import { SurvivalPreview } from '@/components/alkanka/survival/survival-preview'

export const metadata: Metadata = {
  title: 'Survival Arena · Ön izleme',
  robots: { index: false, follow: false },
}

export default function SurvivalPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <SurvivalPreview />
    </main>
  )
}
