'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_BONUS } from '@/lib/app-config'
import { JakoAvatar, type JakoPose } from '../jako'

export const TOUR_KEY = 'alk_tour_done'
export const TOUR_START_EVENT = 'alk:tour-start'
export const TOUR_DONE_EVENT = 'alk:tour-done'

type Step = { targets: string[]; title: string; body: string; pose: JakoPose; link?: { href: string; label: string } }

const STEPS: Step[] = [
  {
    targets: [],
    pose: 'merhaba',
    title: 'Hoş geldin kanka!',
    body: 'Ben Jako. Sana siteyi 30 saniyede gezdireyim, nerede ne var bir bak.',
  },
  {
    targets: ['[data-tour="coins"]'],
    pose: 'kazandi',
    title: 'Kanka Coin bakiyen',
    body: 'Oyunlardan, görevlerden ve tahminlerden kazandığın KC burada birikir. Hepsi gerçek bakiye, hesabına kaydedilir.',
  },
  {
    targets: ['[data-tour-nav="oyunlar"]', '[data-tour="menu-btn"]'],
    pose: 'zar',
    title: 'Oyunlar',
    body: 'Rulet, blackjack, kafa topu ve kafa basket. Tek başına oyna ya da masa açıp kankanla karşılaş.',
  },
  {
    targets: ['[data-tour-nav="cark"]', '[data-tour="mobile-cark"]'],
    pose: 'sandik',
    title: 'Ücretsiz çark ve sandık',
    body: 'Çarkı 6 saatte bir, sandığı günde bir kez bedava aç. Geri sayım kartın üstünde görünür.',
  },
  {
    targets: ['[data-tour-nav="market"]', '[data-tour="mobile-market"]'],
    pose: 'market',
    title: 'Puan marketi',
    body: 'Biriktirdiğin KC ile rozet, ekstra hak ve hediyeler al.',
  },
  {
    targets: ['[data-tour="account"]'],
    pose: 'duyuru',
    title: 'Hesabın',
    body: 'Kayıt olana Kanka Coin hoş geldin hediyesi. Giriş yaptıktan sonra oyun geçmişine buradan ulaşırsın.',
  },
  {
    targets: ['[data-tour-nav="uygulama"]'],
    pose: 'telegram',
    title: `Uygulamayı indir, +${APP_BONUS} KC`,
    body: 'Siteyi telefonuna uygulama olarak ekle, uygulamadan giriş yap, bonus anında yüklensin. Kampanya bildirimleri de ilk sana gelsin.',
    link: { href: '/uygulama', label: 'Nasıl indirilir?' },
  },
]

function findTarget(selectors: string[]) {
  for (const s of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(s)) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && isOnTop(el, r)) return el
    }
  }
  return null
}

function isOnTop(el: HTMLElement, r: DOMRect) {
  const x = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1)
  const y = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1)
  if (r.bottom < 0 || r.top > window.innerHeight) return true
  const hit = document.elementsFromPoint(x, y).find((n) => !n.closest('[data-tour-overlay]'))
  return !hit || el.contains(hit) || hit.contains(el)
}

type Box = { top: number; left: number; width: number; height: number }

export function SiteTour() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const start = useCallback(() => {
    setIndex(0)
    setOpen(true)
  }, [])

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_KEY, '1')
    setOpen(false)
    window.dispatchEvent(new Event(TOUR_DONE_EVENT))
  }, [])

  useEffect(() => {
    window.addEventListener(TOUR_START_EVENT, start)
    let timer: ReturnType<typeof setTimeout> | undefined
    if (!localStorage.getItem(TOUR_KEY)) timer = setTimeout(start, 1200)
    return () => {
      window.removeEventListener(TOUR_START_EVENT, start)
      clearTimeout(timer)
    }
  }, [start])

  const step = STEPS[index]

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight })
    const el = step ? findTarget(step.targets) : null
    if (!el) return setBox(null)
    const r = el.getBoundingClientRect()
    setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 })
  }, [step])

  useLayoutEffect(() => {
    if (!open) return
    const el = findTarget(step.targets)
    el?.scrollIntoView({ block: 'nearest' })
    measure()
    nextRef.current?.focus()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step, measure])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, STEPS.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, finish])

  if (!open || !step) return null

  const isLast = index === STEPS.length - 1
  const cardWidth = Math.min(340, viewport.w - 24)
  const mobile = viewport.w > 0 && viewport.w < 640
  let cardStyle: React.CSSProperties
  if (mobile) {
    const targetLow = box ? box.top + box.height / 2 > viewport.h / 2 : false
    cardStyle = targetLow
      ? { top: 'calc(env(safe-area-inset-top) + 12px)', left: 12, right: 12 }
      : { bottom: 'calc(env(safe-area-inset-bottom) + 84px)', left: 12, right: 12 }
  } else if (box) {
    const below = box.top + box.height + 12
    const fitsBelow = below + 230 < viewport.h
    const left = Math.min(Math.max(12, box.left + box.width / 2 - cardWidth / 2), viewport.w - cardWidth - 12)
    const sideLeft = box.left + box.width + 12
    const preferSide = box.height > viewport.h * 0.5 || (box.left < 280 && sideLeft + cardWidth < viewport.w && box.width < 280)
    cardStyle = preferSide
      ? { top: Math.min(Math.max(12, box.top), viewport.h - 250), left: sideLeft, width: cardWidth }
      : fitsBelow
        ? { top: below, left, width: cardWidth }
        : { top: Math.max(12, box.top - 12 - 230), left, width: cardWidth }
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardWidth, transform: 'translate(-50%, -50%)' }
  }

  return (
    <div data-tour-overlay="" className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300 ease-out"
          style={{ ...box, boxShadow: '0 0 0 9999px color-mix(in oklab, var(--background) 82%, transparent)' }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      )}
      <button type="button" aria-label="Turu kapat" tabIndex={-1} onClick={finish} className="absolute inset-0 cursor-default" style={{ background: 'transparent' }} />

      <div
        ref={cardRef}
        key={index}
        style={cardStyle}
        className="absolute flex animate-in fade-in zoom-in-95 flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl duration-200"
      >
        <div className="flex items-start gap-3">
          <JakoAvatar pose={step.pose} size="md" className="max-sm:size-20" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Siteyi keşfet · {index + 1}/{STEPS.length}
            </span>
            <h2 id="tour-title" className="text-balance font-display text-base font-bold text-foreground">
              {step.title}
            </h2>
          </div>
          <button type="button" onClick={finish} aria-label="Turu kapat" className="-m-1 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p id="tour-body" className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        <div className="flex items-center gap-1" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={cn('h-1 rounded-full transition-all', i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border')} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Geri
            </button>
          ) : (
            <button type="button" onClick={finish} className="h-9 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Turu atla
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step.link && (
              <Link href={step.link.href} onClick={finish} className="flex h-9 items-center rounded-lg border border-primary/50 px-3 text-xs font-bold text-primary hover:bg-primary/10">
                {step.link.label}
              </Link>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (isLast ? finish() : setIndex(index + 1))}
              className="flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground"
            >
              {isLast ? 'Bitir' : 'İleri'}
              {!isLast && <ArrowRight className="size-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TourButton({ className, onStart }: { className?: string; onStart?: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onStart?.()
        setTimeout(() => window.dispatchEvent(new Event(TOUR_START_EVENT)), onStart ? 320 : 0)
      }}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        className,
      )}
    >
      <Compass className="size-4 shrink-0" aria-hidden="true" />
      Siteyi keşfet
    </button>
  )
}
