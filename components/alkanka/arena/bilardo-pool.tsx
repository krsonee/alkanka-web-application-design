'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { RotateCw, Smartphone } from 'lucide-react'
import type { GameApi } from './stake-gate'
import { useBrand } from '../brand-context'
import { useLogos } from '../logo-context'
import { LOGO_CONCEPTS } from '../logos'

const PORTRAIT_QUERY = '(max-width: 767px) and (orientation: portrait)'
const LANDSCAPE_QUERY = '(max-height: 540px) and (orientation: landscape)'

type Layout = 'desktop' | 'portrait' | 'landscape'

function usePhoneLayout(): Layout {
  return useSyncExternalStore(
    (cb) => {
      const ms = [PORTRAIT_QUERY, LANDSCAPE_QUERY].map((q) => window.matchMedia(q))
      ms.forEach((m) => m.addEventListener('change', cb))
      return () => ms.forEach((m) => m.removeEventListener('change', cb))
    },
    () => (window.matchMedia(PORTRAIT_QUERY).matches ? 'portrait' : window.matchMedia(LANDSCAPE_QUERY).matches ? 'landscape' : 'desktop'),
    () => 'desktop',
  )
}

/** Android allows locking orientation once fullscreen; iOS ignores it and relies on the prompt. */
async function goLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    await o.lock?.('landscape')
  } catch {}
}

/**
 * Leaving the table: lock portrait while still fullscreen (Android honours it),
 * then drop fullscreen and release the lock so the site returns upright.
 */
async function restorePortrait() {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void }
  try {
    if (document.fullscreenElement) await o.lock?.('portrait-primary')
  } catch {}
  await new Promise((r) => setTimeout(r, 250))
  try {
    if (document.fullscreenElement) await document.exitFullscreen?.()
  } catch {}
  try {
    o.unlock?.()
  } catch {}
}

type FinishMessage = { source: 'alkanka-bilardo'; type: 'finish'; result: 'win' | 'lose'; note?: string }

export function BilardoPool({ bet, win, finish }: { bet: number; win: number; finish: GameApi['finish'] }) {
  const layout = usePhoneLayout()
  const frame = useRef<HTMLIFrameElement>(null)
  const done = useRef(false)
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    function onMessage(e: MessageEvent<FinishMessage>) {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      const d = e.data
      if (d?.source !== 'alkanka-bilardo' || d.type !== 'finish' || done.current) return
      done.current = true
      void restorePortrait()
      finishRef.current(d.result === 'win' ? 'win' : 'lose', d.note)
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      void restorePortrait()
    }
  }, [])

  const { concept } = useBrand()
  const customLogo = useLogos().brand?.logoUrl
  const logo = customLogo || LOGO_CONCEPTS.find((l) => l.id === concept)?.image || '/images/logos/fist.png'
  const landscape = layout === 'landscape'
  const src = `/games/bilardo.html?v=${landscape ? 'lan' : 'web'}&bet=${bet}&win=${win}&logo=${encodeURIComponent(logo)}`

  return (
    <div className="relative">
      {layout === 'portrait' && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <Smartphone className="size-10 rotate-90 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-display text-lg font-bold text-foreground">Telefonu yan çevir kanka</p>
            <p className="text-sm leading-relaxed text-muted-foreground">Bilardo yatay ekranda oynanıyor, masa tam ekran açılır.</p>
          </div>
          <button
            type="button"
            onClick={goLandscape}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            Yatay moda geç
          </button>
        </div>
      )}
      <div
        className={
          landscape
            ? 'fixed inset-0 z-[100] bg-[#0a101b]'
            : layout === 'portrait'
              ? 'sr-only'
              : 'aspect-[1280/684] w-full overflow-hidden rounded-xl border border-border bg-[#0a101b]'
        }
        // The iframe can't read the notch insets itself, so the fullscreen wrapper keeps the table clear of them.
        style={landscape ? { paddingInline: 'max(env(safe-area-inset-left), env(safe-area-inset-right))', paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}
      >
        <iframe
          key={landscape ? 'lan' : 'web'}
          ref={frame}
          src={src}
          title="Bilardo masası"
          className="size-full border-0"
          allow="autoplay; fullscreen"
        />
      </div>
    </div>
  )
}
