'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Maximize2, Menu, Minimize2, RotateCw, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { goLandscape, restorePortrait } from './orientation'

const PHONE_LANDSCAPE = '(orientation: landscape) and (max-height: 600px)'

/** Width the table is laid out at in fullscreen before being scaled to the screen; keeps text readable. */
const DESIGN_WIDTH = 640
/** The fullscreen controls sit in a slim rail on the left: on a sideways phone height is the scarce axis. */
const RAIL_W = 38
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
export function LandscapeFit({
  children,
  label = 'Oyun masası',
  force = false,
  menu,
}: {
  children: ReactNode
  label?: string
  /** Table controls (resign, leave, sound) reachable while the fullscreen layer hides the page header. */
  menu?: ReactNode
  /** Sideways only: an upright phone gets a rotate prompt instead of the table, and the table drops the side rail. */
  force?: boolean
}) {
  const landscape = usePhoneLandscape()
  const portraitPhone = useMedia(PHONE_PORTRAIT)
  const blocked = force && portraitPhone
  const [hintClosed, setHintClosed] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const fullscreen = landscape && !minimized

  useEffect(() => {
    if (!fullscreen) setMenuOpen(false)
  }, [fullscreen])
  const inner = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!landscape) setMinimized(false)
  }, [landscape])

  useEffect(() => {
    if (!force) return
    return () => void restorePortrait()
  }, [force])

  // Fullscreen needs a user gesture, so the first tap on a sideways table hides the address bar (Android).
  useEffect(() => {
    if (!force || !fullscreen || !document.fullscreenEnabled) return
    const onTap = () => {
      if (!document.fullscreenElement) void goLandscape()
    }
    document.addEventListener('pointerdown', onTap, { once: true, capture: true })
    return () => document.removeEventListener('pointerdown', onTap, { capture: true })
  }, [force, fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    // iOS Safari ignores user-scalable=no; block its pinch gesture so the fitted table can't be zoomed apart.
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', block)
    document.addEventListener('gesturechange', block)
    return () => {
      html.style.overflow = prev
      document.removeEventListener('gesturestart', block)
      document.removeEventListener('gesturechange', block)
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
      // Layout-viewport sizes only: visualViewport shrinks while the page is pinch/double-tap zoomed,
      // which used to lock the table at a tiny wrong size after tapping the minimize/maximize button.
      // Mid-rotation some browsers still report portrait dimensions; measuring then collapses the table.
      if (window.innerWidth <= window.innerHeight) return
      // Only the fixed layer's own free area is trusted: it already excludes the rail, paddings and notch
      // insets, and follows Safari's toolbar collapsing. documentElement.clientHeight keeps the old
      // toolbar-visible height on iOS, which shrank the table when the address bar was hidden.
      const a = area.current
      if (!a) return
      const availW = a.clientWidth - 4
      const availH = a.clientHeight - 4
      if (availW < 200 || availH < 150 || availW <= availH) return
      // Tables that opt into var(--ls-ar) take the screen's own shape, so no dark bands are left beside them.
      if (force) i.style.setProperty('--ls-ar', `${availW} / ${availH}`)
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
      // A fine sweep of layout widths: coarse steps left big empty bands beside fixed-ratio boards.
      const candidates = split
        ? Array.from({ length: 21 }, (_, k) => availW * (0.6 + k * 0.05))
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
      i.style.removeProperty('--ls-ar')
    }
  }, [fullscreen, force])

  return (
    <div
      role={fullscreen ? 'dialog' : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? `${label} tam ekran` : undefined}
      className={cn(
        fullscreen &&
          'fixed inset-0 z-[100] flex touch-manipulation flex-row items-stretch gap-1.5 overflow-hidden bg-background py-1 pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]',
      )}
    >
      {fullscreen && menu && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="ls-table-menu"
            title="Masa menüsü"
            className={cn(
              'absolute z-[110] flex size-7 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-foreground/80 backdrop-blur-sm hover:bg-card hover:text-foreground',
              force ? 'left-[max(0.25rem,env(safe-area-inset-left))] top-9' : 'left-[max(0.5rem,env(safe-area-inset-left))] top-12',
              menuOpen && 'bg-card text-foreground',
            )}
          >
            {menuOpen ? <X className="size-3.5" aria-hidden="true" /> : <Menu className="size-3.5" aria-hidden="true" />}
            <span className="sr-only">{menuOpen ? 'Menüyü kapat' : 'Masa menüsü'}</span>
          </button>
          {menuOpen && (
            <div
              id="ls-table-menu"
              role="menu"
              className={cn(
                'absolute z-[115] flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150',
                force ? 'left-[calc(max(0.25rem,env(safe-area-inset-left))+2.25rem)] top-9' : 'left-14 top-12',
              )}
            >
              {menu}
            </div>
          )}
        </>
      )}
      {fullscreen && force ? (
        <button
          type="button"
          onClick={() => setMinimized(true)}
          title="Küçült"
          className="absolute left-[max(0.25rem,env(safe-area-inset-left))] top-1 z-[110] flex size-7 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-foreground/80 backdrop-blur-sm hover:bg-card hover:text-foreground"
        >
          <Minimize2 className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Küçült</span>
        </button>
      ) : blocked ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <Smartphone className="size-10 rotate-90 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-display text-lg font-bold text-foreground text-balance">Telefonu yan çevir kanka</p>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{label} yatay ekranda oynanıyor, masa tam ekran açılır.</p>
          </div>
          <button
            type="button"
            onClick={() => void goLandscape()}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            Yatay moda geç
          </button>
        </div>
      ) : fullscreen ? (
        <div className="flex shrink-0 flex-col items-center py-1" style={{ width: RAIL_W }}>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Küçült"
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-foreground"
          >
            <Minimize2 className="size-4" aria-hidden="true" />
            <span className="sr-only">Küçült</span>
          </button>
        </div>
      ) : landscape ? (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="mb-2 flex h-8 touch-manipulation items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground"
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
        aria-hidden={blocked || undefined}
        className={cn(fullscreen && 'flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden', blocked && 'sr-only')}
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
