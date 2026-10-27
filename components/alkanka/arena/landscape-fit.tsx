'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Maximize2, Minimize2, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const PHONE_LANDSCAPE = '(pointer: coarse) and (orientation: landscape) and (max-height: 600px)'

/** Width the table is laid out at in fullscreen before being scaled to the screen; keeps text readable. */
const DESIGN_WIDTH = 640
const TOOLBAR_H = 36

const PHONE_PORTRAIT = '(pointer: coarse) and (orientation: portrait) and (max-width: 600px)'

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function usePhoneLandscape() {
  return useMedia(PHONE_LANDSCAPE)
}

/**
 * Landscape mode for game tables: when a phone is turned sideways the table opens as a fullscreen
 * layer above the site chrome, scaled to fit the screen. The element tree never changes between
 * modes, so rotating the phone does not remount (and reset) the game underneath.
 */
export function LandscapeFit({ children, label = 'Oyun masası' }: { children: ReactNode; label?: string }) {
  const landscape = usePhoneLandscape()
  const portraitPhone = useMedia(PHONE_PORTRAIT)
  const [hintClosed, setHintClosed] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const fullscreen = landscape && !minimized
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!landscape) setMinimized(false)
  }, [landscape])

  useEffect(() => {
    if (!fullscreen) return
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [fullscreen])

  useLayoutEffect(() => {
    if (!fullscreen) {
      setScale(1)
      setBox(null)
      return
    }
    const i = inner.current
    if (!i) return
    let frame = 0
    const measure = () => {
      const availW = window.innerWidth - 16
      const availH = window.innerHeight - TOOLBAR_H - 12
      // Games wrap their table at different depths, so the grid is applied to whichever element holds it.
      const main = i.querySelector<HTMLElement>('[data-ls-main]')
      const grid = main?.parentElement ?? null
      i.querySelectorAll('[data-ls-grid]').forEach((el) => {
        if (el !== grid) el.removeAttribute('data-ls-grid')
      })
      if (grid && !grid.hasAttribute('data-ls-grid')) grid.setAttribute('data-ls-grid', '')
      const split = !!main || !!i.querySelector('[data-ls-wide]')
      // Split layouts (table left, controls right) want the full width; stacked ones read best narrower.
      const candidates = split
        ? [availW, availW * 1.15, availW * 1.3, availW * 1.5]
        : [Math.min(availW, DESIGN_WIDTH), availW * 0.85, availW, availW * 1.2]
      const prevWidth = i.style.width
      let best = { w: candidates[0], h: 0, s: 0 }
      for (const w of candidates) {
        i.style.width = `${w}px`
        const h = i.scrollHeight
        if (!h) continue
        const s = Math.min(1, availH / h, availW / w)
        if (s > best.s + 0.01) best = { w, h, s }
      }
      i.style.width = prevWidth
      if (!best.h) return
      setScale(best.s)
      setBox((cur) =>
        cur && Math.abs(cur.w - best.w * best.s) < 1 && Math.abs(cur.h - best.h * best.s) < 1 ? cur : { w: best.w * best.s, h: best.h * best.s },
      )
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const ro = new ResizeObserver(schedule)
    ro.observe(i)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      i.querySelectorAll('[data-ls-grid]').forEach((el) => el.removeAttribute('data-ls-grid'))
    }
  }, [fullscreen])

  return (
    <div
      role={fullscreen ? 'dialog' : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? `${label} tam ekran` : undefined}
      className={cn(
        fullscreen &&
          'fixed inset-0 z-[100] flex h-dvh flex-col items-center gap-1 overflow-hidden bg-background pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-1',
      )}
    >
      {fullscreen ? (
        <div className="flex w-full shrink-0 items-center justify-between" style={{ height: TOOLBAR_H - 4 }}>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground"
          >
            <Minimize2 className="size-4" aria-hidden="true" />
            Küçült
          </button>
          <span className="truncate font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
      ) : landscape ? (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="mb-2 flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground"
        >
          <Maximize2 className="size-4" aria-hidden="true" />
          Tam ekran
        </button>
      ) : portraitPhone && !hintClosed ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-foreground">
          <Smartphone className="size-5 shrink-0 rotate-90 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-pretty">
            Telefonu yan çevir, masa tam ekran ve daha rahat açılır.
          </p>
          <button
            type="button"
            onClick={() => setHintClosed(true)}
            aria-label="Öneriyi kapat"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div
        className={cn(fullscreen && 'flex min-h-0 flex-1 items-center justify-center')}
        style={fullscreen && box ? { width: box.w } : undefined}
      >
        <div style={fullscreen && box ? { width: box.w, height: box.h } : undefined}>
          <div
            ref={inner}
            className={cn(fullscreen && 'ls-split origin-top-left')}
            style={fullscreen ? { width: box ? box.w / scale : DESIGN_WIDTH, transform: `scale(${scale})` } : undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
