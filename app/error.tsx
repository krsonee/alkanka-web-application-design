'use client'

import { JakoAvatar } from '@/components/alkanka/jako'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
      <JakoAvatar pose="uzgun" size="lg" className="size-40 rounded-3xl" alt="Üzgün Jako" />
      <h1 className="font-display text-3xl font-bold text-balance">Bir şeyler ters gitti kanka</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        Jako tüylerini toparlıyor. Birazdan tekrar dene.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
      >
        Tekrar dene
      </button>
    </main>
  )
}
