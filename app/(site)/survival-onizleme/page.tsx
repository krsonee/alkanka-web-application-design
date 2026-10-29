import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SurvivalPreview } from '@/components/alkanka/survival/survival-preview'
import { isAdmin } from '@/lib/admin-auth'

export const metadata: Metadata = {
  title: 'Survival Arena · Ön izleme',
  robots: { index: false, follow: false },
}

export default async function SurvivalPreviewPage() {
  if (!(await isAdmin())) notFound()
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <SurvivalPreview />
    </main>
  )
}
