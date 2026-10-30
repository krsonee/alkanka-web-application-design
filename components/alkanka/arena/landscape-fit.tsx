'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Maximize2, Minimize2, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const PHONE_LANDSCAPE = '(orientation: landscape) and (max-height: 600px)'

/** Width the table is laid out at in fullscreen before being scaled to the screen; keeps text readable. */
const DESIGN_WIDTH = 640
/** The fullscreen controls sit in a slim rail on the left: on a sideways phone height is the scarce axis. */
const RAIL_W = 44
/** Small tables may grow past their natural size so cards and text stay legible. */
const MAX_SCALE = 1.4

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

export function usePhonePortrait() {
  return useMedia(PHONE_PORTRAIT)
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
  const area = useRef<HTMLDivElement>(null)
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
      const vw = Math.round(window.visualViewport?.width ?? window.innerWidth)
      const vh = Math.round(window.visualViewport?.height ?? window.innerHeight)
      // Mid-rotation some browsers still report portrait dimensions; measuring then collapses the table.
      if (vw <= vh) return
      // Measure the real free area: it already excludes the rail, paddings and notch/safe-area insets,
      // which differ per device and made the side panel overflow off-screen on iPhones.
      const a = area.current
      const availW = Math.min(vw - RAIL_W - 20, (a?.clientWidth || vw) - 4)
      const availH = Math.min(vh - 8, (a?.clientHeight || vh) - 4)
      if (availW < 200 || availH < 150) return
      // Games wrap their table at different depths, so the grid is applied to whichever element holds it.
      // Wrappers marked data-ls-flat are dissolved so their siblings (e.g. a control bar) join the side column.
      const main = i.querySelector<HTMLElement>('[data-ls-main]')
      let grid = main?.parentElement ?? null
      while (grid && grid !== i && grid.hasAttribute('data-ls-flat')) grid = grid.parentElement
      i.querySelectorAll('[data-ls-grid]').forEach((el) => {
        if (el !== grid) el.removeAttribute('data-ls-grid')
      })
      if (grid && !grid.hasAttribute('data-ls-grid')) grid.setAttribute('data-ls-grid', '')
      const split = !!main || !!i.querySelector('[data-ls-wide]')
      const candidates = split
        ? [availW * 0.75, availW * 0.85, availW, availW * 1.15, availW * 1.3]
        : [availW * 0.5, availW * 0.65, Math.min(availW, DESIGN_WIDTH), availW * 0.85, availW]
      const prevWidth = i.style.width
      const prevTransform = i.style.transform
      i.style.transform = 'none'
      // Pick the layout width that covers the most screen once fitted, not merely the largest scale.
      let best = { w: candidates[0], h: 0, s: 0, area: 0 }
      for (const w of candidates) {
        i.style.width = `${w}px`
        const h = i.scrollHeight
        if (!h) continue
        const s = Math.min(MAX_SCALE, availH / h, availW / w)
        const area = w * h * s * s
        if (area > best.area * 1.03) best = { w, h, s, area }
      }
      i.style.transform = prevTransform
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
    // Viewport size settles late after rotation on iOS/Samsung browsers, so re-measure a few times.
    const timers: ReturnType<typeof setTimeout>[] = []
    const settle = () => {
      schedule()
      timers.forEach(clearTimeout)
      timers.length = 0
      for (const ms of [120, 350, 800]) timers.push(setTimeout(schedule, ms))
    }
    measure()
    settle()
    const ro = new ResizeObserver(schedule)
    ro.observe(i)
    if (area.current) ro.observe(area.current)
    window.addEventListener('resize', settle)
    window.addEventListener('orientationchange', settle)
    window.visualViewport?.addEventListener('resize', settle)
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      ro.disconnect()
      window.removeEventListener('resize', settle)
      window.removeEventListener('orientationchange', settle)
      window.visualViewport?.removeEventListener('resize', settle)
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
          'fixed inset-0 z-[100] flex h-dvh flex-row items-stretch gap-2 overflow-hidden bg-background py-1 pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]',
      )}
    >
      {fullscreen ? (
        <div className="flex shrink-0 flex-col items-center justify-between gap-2 py-1" style={{ width: RAIL_W }}>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Küçült"
            className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground"
          >
            <Minimize2 className="size-5" aria-hidden="true" />
            <span className="sr-only">Küçült</span>
          </button>
          <span className="min-h-0 truncate font-display text-xs font-bold uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl] rotate-180">
            {label}
          </span>
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
        ref={area}
        className={cn(fullscreen && 'flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden')}
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
