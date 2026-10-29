import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { KaraDelikPreview } from '@/components/alkanka/karadelik/karadelik-preview'
import { isAdmin } from '@/lib/admin-auth'

export const metadata: Metadata = {
  title: 'Kara Delik Arenası · Ön izleme',
  robots: { index: false, follow: false },
}

export default async function ArenaPreviewPage() {
  if (!(await isAdmin())) notFound()
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <KaraDelikPreview />
    </main>
  )
}
