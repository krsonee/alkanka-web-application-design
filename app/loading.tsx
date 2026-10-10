import { JakoAvatar } from '@/components/alkanka/jako'

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground" aria-busy="true">
      <JakoAvatar pose="jako" size="lg" className="animate-pulse" alt="Yükleniyor" />
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Jako geliyor...</p>
    </main>
  )
}
