import type { Metadata } from 'next'
import { BrandProvider } from '@/components/alkanka/brand-context'
import { LogoGallery } from '@/components/alkanka/logo-gallery'

export const metadata: Metadata = {
  title: 'Logo Seçenekleri | Alkanka',
}

export default function LogolarPage() {
  return (
    <BrandProvider>
      <LogoGallery />
    </BrandProvider>
  )
}
