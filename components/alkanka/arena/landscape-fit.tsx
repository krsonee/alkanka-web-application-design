'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PHONE_LANDSCAPE = '(pointer: coarse) and (orientation: landscape) and (max-height: 600px)'

/** Width the table is laid out at in fullscreen before being scaled to the screen; keeps text readable. */
const DESIGN_WIDTH = 640
const TOOLBAR_H = 36

function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE_LANDSCAPE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function usePhoneLandscape() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_LANDSCAPE).matches,
    () => false,
  )
}

/**
 * Landscape mode for game tables: when a phone is turned sideways the table opens as a fullscreen
 * layer above the site chrome, scaled to fit the screen. The element tree never changes between
 * modes, so rotating the phone does not remount (and reset) the game underneath.
 */
export function LandscapeFit({ children, label = 'Oyun masası' }: { children: ReactNode; label?: string }) {
  const landscape = usePhoneLandscape()
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
    const measure = () => {
      const availW = window.innerWidth - 16
      const availH = window.innerHeight - TOOLBAR_H - 12
      const width = Math.min(availW, DESIGN_WIDTH)
      const naturalH = i.scrollHeight
      if (!naturalH) return
      const next = Math.min(1, availH / naturalH, availW / width)
      setScale(next)
      setBox({ w: width * next, h: naturalH * next })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(i)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
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
      ) : null}
      <div
        className={cn(fullscreen && 'flex min-h-0 flex-1 items-center justify-center')}
        style={fullscreen && box ? { width: box.w } : undefined}
      >
        <div style={fullscreen && box ? { width: box.w, height: box.h } : undefined}>
          <div
            ref={inner}
            className={cn(fullscreen && 'origin-top-left')}
            style={fullscreen ? { width: Math.min(DESIGN_WIDTH, (box?.w ?? DESIGN_WIDTH * scale) / scale), transform: `scale(${scale})` } : undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
