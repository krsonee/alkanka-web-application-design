'use client'

import { Component, type ReactNode } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'

const AUTO_RETRIES = 2
const RELOAD_FLAG = 'alkanka:chunk-reload'

export function isChunkError(error: unknown) {
  const e = error as { name?: string; message?: string } | null
  const text = `${e?.name ?? ''} ${e?.message ?? ''}`
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch|Importing a module script failed/i.test(text)
}

/** A new deployment invalidates old chunks; one hard reload picks up the fresh build. Guarded so it never loops. */
export function reloadOnceForChunkError(error: unknown) {
  if (typeof window === 'undefined' || !isChunkError(error)) return false
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

type State = { failures: number; failed: boolean; key: number }

/**
 * First-mount glitches (layout measuring before the table has a size, a stale chunk after a deploy) used to bubble up
 * to the full-page error screen even though a plain retry worked. This keeps the session in StakeGate / the table
 * intact and silently remounts just the game a couple of times before asking the player.
 */
export class GameErrorBoundary extends Component<{ children: ReactNode; label?: string }, State> {
  state: State = { failures: 0, failed: false, key: 0 }
  private timer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[alkanka] oyun yüklenirken hata', error)
    if (reloadOnceForChunkError(error)) return
    if (this.state.failures < AUTO_RETRIES) {
      this.timer = setTimeout(() => this.retry(), 250 * (this.state.failures + 1))
    }
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer)
  }

  retry = () => {
    this.setState((s) => ({ failures: s.failures + 1, failed: false, key: s.key + 1 }))
  }

  render() {
    if (!this.state.failed) return <div key={this.state.key} className="contents">{this.props.children}</div>
    if (this.state.failures < AUTO_RETRIES) {
      return (
        <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Masa hazırlanıyor...
        </div>
      )
    }
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <p className="font-display text-lg font-bold text-foreground">{this.props.label ?? 'Masa'} yüklenemedi kanka</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Bahsin ve masan korunuyor. Tekrar dene, kaldığın yerden açılır.</p>
        <button
          type="button"
          onClick={() => this.setState((s) => ({ failures: 0, failed: false, key: s.key + 1 }))}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Tekrar dene
        </button>
      </div>
    )
  }
}
