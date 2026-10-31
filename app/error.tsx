'use client'

import { useEffect, useRef, useState } from 'react'
import { JakoAvatar } from '@/components/alkanka/jako'
import { reloadOnceForChunkError } from '@/components/alkanka/arena/game-error-boundary'

const AUTO_RESET_KEY = 'alkanka:auto-reset'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(true)
  const tried = useRef(false)

  useEffect(() => {
    if (tried.current) return
    tried.current = true
    console.error('[alkanka] sayfa hatası', error)
    if (reloadOnceForChunkError(error)) return
    // A plain retry fixes transient first-load errors, so try it once silently before showing the error screen.
    let last = 0
    try {
      last = Number(sessionStorage.getItem(AUTO_RESET_KEY) ?? 0)
      sessionStorage.setItem(AUTO_RESET_KEY, String(Date.now()))
    } catch {}
    if (Date.now() - last > 10_000) {
      const t = setTimeout(reset, 150)
      return () => clearTimeout(t)
    }
    setRecovering(false)
  }, [error, reset])

  if (recovering) {
    return <main className="min-h-dvh bg-background" aria-busy="true" />
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
      <JakoAvatar pose="uzgun" size="lg" className="size-40 rounded-3xl" alt="Üzgün Jako" />
      <h1 className="font-display text-3xl font-bold text-balance">Bir şeyler ters gitti kanka</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        Jako tüylerini kabarttı ama sorun çözülmedi. Tekrar denersen büyük ihtimalle düzelir.
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
