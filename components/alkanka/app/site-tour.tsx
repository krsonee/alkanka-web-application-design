'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight, Coins, Compass, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JakoAvatar, type JakoPose } from '../jako'
import { usePoints } from '../points-context'
import { completeTourAction, getMyTourState, markTourSeenAction } from '@/app/actions/tour'
import { TOUR_STEP_IDS, type TourSettings, type TourStepId } from '@/lib/tour-config'

export const TOUR_KEY = 'alk_tour_done'
export const TOUR_START_EVENT = 'alk:tour-start'
export const TOUR_DONE_EVENT = 'alk:tour-done'

type StepMeta = { targets: string[]; pose: JakoPose; link?: { href: string; label: string } }

const META: Record<TourStepId, StepMeta> = {
  hosgeldin: { targets: [], pose: 'merhaba' },
  oyunlar: { targets: ['[data-tour-nav="oyunlar"]', '[data-tour="mobile-oyunlar"]'], pose: 'zar', link: { href: '/oyunlar', label: 'Oyunlara git' } },
  gorevler: {
    targets: ['[data-tour-nav="gorevler"]', '[data-tour="tile-cark"]', '[data-tour="tile-gorev"]'],
    pose: 'sandik',
    link: { href: '/gorevler', label: 'Görevlere bak' },
  },
  market: { targets: ['[data-tour-nav="market"]', '[data-tour="tile-market"]'], pose: 'duyuru', link: { href: '/market', label: 'Markete git' } },
  siralama: { targets: ['[data-tour-nav="siralama"]', '[data-tour-nav="rozetler"]'], pose: 'zar', link: { href: '/siralama', label: 'Sıralamayı gör' } },
  telegram: { targets: ['[data-tour="telegram"]'], pose: 'duyuru' },
  uygulama: { targets: ['[data-tour-nav="uygulama"]'], pose: 'merhaba', link: { href: '/uygulama', label: 'Nasıl yüklenir?' } },
  final: { targets: ['[data-tour="account"]'], pose: 'sandik' },
}

type Result = { tone: 'ok' | 'info' | 'error'; text: string }

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

export function SiteTour({ settings }: { settings: TourSettings }) {
  const { member, loading, setBalance, requireLogin } = usePoints()
  const onGamePage = (usePathname() ?? '').startsWith('/oyunlar/')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [claiming, setClaiming] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const steps = useMemo(
    () => TOUR_STEP_IDS.filter((id) => settings.steps[id].enabled).map((id) => ({ id, ...settings.steps[id], ...META[id] })),
    [settings],
  )

  const start = useCallback(() => {
    setIndex(0)
    setResult(null)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    localStorage.setItem(TOUR_KEY, '1')
    setOpen(false)
    window.dispatchEvent(new Event(TOUR_DONE_EVENT))
    if (member) void markTourSeenAction()
  }, [member])

  const claim = useCallback(async () => {
    if (!member) {
      close()
      requireLogin()
      return
    }
    if (settings.reward <= 0) return close()
    setClaiming(true)
    const res = await completeTourAction()
    setClaiming(false)
    localStorage.setItem(TOUR_KEY, '1')
    if (res.status === 'awarded') {
      setBalance(res.balance)
      setResult({ tone: 'ok', text: `${res.amount.toLocaleString('tr-TR')} KC hesabına yattı. İyi eğlenceler kanka!` })
    } else if (res.status === 'already') {
      setResult({ tone: 'info', text: 'Tur ödülünü daha önce almışsın, ödül hesap başına bir kez veriliyor.' })
    } else if (res.status === 'multi') {
      setResult({ tone: 'error', text: 'Bu cihaz veya ağdan tur ödülü daha önce alınmış. Ödül kişi başına bir kez verilir.' })
    } else if (res.status === 'off') {
      setResult({ tone: 'info', text: 'Tur ödülü şu an kapalı.' })
    } else if (res.status === 'guest') {
      close()
      requireLogin()
    } else {
      setResult({ tone: 'error', text: ('message' in res && res.message) || 'Bir şeyler ters gitti, tekrar dene.' })
    }
  }, [member, settings.reward, close, requireLogin, setBalance])

  useEffect(() => {
    if (!settings.enabled) return
    window.addEventListener(TOUR_START_EVENT, start)
    return () => window.removeEventListener(TOUR_START_EVENT, start)
  }, [start, settings.enabled])

  useEffect(() => {
    if (!settings.enabled || !settings.autoStart || loading || onGamePage) return
    if (localStorage.getItem(TOUR_KEY)) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (!cancelled) timer = setTimeout(start, settings.autoStartDelay * 1000)
    }
    if (member) {
      getMyTourState()
        .then((s) => {
          if (s?.done) localStorage.setItem(TOUR_KEY, '1')
          else schedule()
        })
        .catch(schedule)
    } else schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [settings.enabled, settings.autoStart, settings.autoStartDelay, loading, member, start, onGamePage])

  const step = steps[index]

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight })
    const el = step ? findTarget(step.targets) : null
    if (!el) return setBox(null)
    const r = el.getBoundingClientRect()
    setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 })
  }, [step])

  useLayoutEffect(() => {
    if (!open || !step) return
    findTarget(step.targets)?.scrollIntoView({ block: 'nearest' })
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
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, steps.length])

  if (!settings.enabled || !open || !step) return null

  const isLast = index === steps.length - 1
  const hasReward = settings.reward > 0
  const cardWidth = Math.min(360, viewport.w - 24)
  const mobile = viewport.w > 0 && viewport.w < 640
  let cardStyle: React.CSSProperties
  if (mobile) {
    const targetLow = box ? box.top + box.height / 2 > viewport.h / 2 : false
    cardStyle = box
      ? targetLow
        ? { top: 'calc(env(safe-area-inset-top) + 12px)', left: 12, right: 12 }
        : { bottom: 'calc(env(safe-area-inset-bottom) + 84px)', left: 12, right: 12 }
      : { bottom: 'calc(env(safe-area-inset-bottom) + 84px)', left: 12, right: 12 }
  } else if (box) {
    const below = box.top + box.height + 12
    const fitsBelow = below + 250 < viewport.h
    const left = Math.min(Math.max(12, box.left + box.width / 2 - cardWidth / 2), viewport.w - cardWidth - 12)
    const sideLeft = box.left + box.width + 12
    const preferSide = box.height > viewport.h * 0.5 || (box.left < 280 && sideLeft + cardWidth < viewport.w && box.width < 280)
    cardStyle = preferSide
      ? { top: Math.min(Math.max(12, box.top), viewport.h - 270), left: sideLeft, width: cardWidth }
      : fitsBelow
        ? { top: below, left, width: cardWidth }
        : { top: Math.max(12, box.top - 12 - 250), left, width: cardWidth }
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardWidth, transform: 'translate(-50%, -50%)' }
  }

  const finalLabel = !member ? 'Kayıt ol, hediyeni al' : hasReward ? `Bitir ve ${settings.reward.toLocaleString('tr-TR')} KC al` : 'Bitir'

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
      <button type="button" aria-label="Turu kapat" tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default" style={{ background: 'transparent' }} />

      <div
        key={index}
        style={cardStyle}
        className="absolute flex animate-in fade-in zoom-in-95 flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl duration-200"
      >
        <div className="flex items-start gap-3">
          <JakoAvatar pose={step.pose} size="md" className="max-sm:size-16" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Siteyi keşfet · {index + 1}/{steps.length}
            </span>
            <h2 id="tour-title" className="text-balance font-display text-base font-bold text-foreground">
              {step.title}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="Turu kapat" className="-m-1 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p id="tour-body" className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        {hasReward && !result && (index === 0 || isLast) && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            <Coins className="size-4 shrink-0" aria-hidden="true" />
            Turu bitirene {settings.reward.toLocaleString('tr-TR')} KC hediye · hesap başına 1 kez
          </div>
        )}

        {result && (
          <p
            role="status"
            className={cn(
              'rounded-xl px-3 py-2 text-sm font-medium leading-relaxed',
              result.tone === 'ok' && 'bg-primary/10 text-primary',
              result.tone === 'info' && 'bg-secondary text-foreground',
              result.tone === 'error' && 'bg-destructive/10 text-destructive',
            )}
          >
            {result.text}
          </p>
        )}

        <div className="flex items-center gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={cn('h-1 rounded-full transition-all', i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border')} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {result ? null : index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Geri
            </button>
          ) : (
            <button type="button" onClick={close} className="h-9 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Turu atla
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step.link && !result && (
              <Link href={step.link.href} onClick={close} className="flex h-9 items-center rounded-lg border border-primary/50 px-3 text-xs font-bold text-primary hover:bg-primary/10">
                {step.link.label}
              </Link>
            )}
            {result ? (
              <button ref={nextRef} type="button" onClick={close} className="flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground">
                Kapat
              </button>
            ) : (
              <button
                ref={nextRef}
                type="button"
                disabled={claiming}
                onClick={() => (isLast ? void claim() : setIndex(index + 1))}
                className="flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                {claiming && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {isLast ? finalLabel : 'İleri'}
                {!isLast && <ArrowRight className="size-3.5" aria-hidden="true" />}
              </button>
            )}
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
