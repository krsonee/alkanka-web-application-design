import type { Metadata } from 'next'
import { EngagePreview } from '@/components/alkanka/kankatv/engage-preview'

export const metadata: Metadata = {
  title: 'KankaTV önizleme',
  robots: { index: false, follow: false },
}

export default function KankaTvPreviewPage() {
  return <EngagePreview />
}
