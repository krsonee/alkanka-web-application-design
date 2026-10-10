import type { Metadata } from 'next'
import { MascotGallery } from '@/components/alkanka/mascot-gallery'

export const metadata: Metadata = {
  title: 'Maskot Seçenekleri | Alkanka',
}

export default function MaskotPage() {
  return <MascotGallery />
}
