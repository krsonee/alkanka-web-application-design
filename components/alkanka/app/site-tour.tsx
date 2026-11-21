'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Coins, Compass, Eye, Loader2, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JakoAvatar } from '../jako'
import { usePoints } from '../points-context'
import { completeTourAction, getMyTourState, getTourPreviewAction, markTourSeenAction } from '@/app/actions/tour'
import {
  tourScreen,
  tourSteps,
  TOUR_MENU_BUTTON,
  TOUR_PREVIEW_PARAM,
  TOUR_PREVIEW_TOKEN_PARAM,
  TOUR_PREVIEW_VALUES,
  type TourAudience,
  type TourScreen,
  type TourSettings,
  type TourStep,
} from '@/lib/tour-config'

/** Holds the tour version this browser last saw ("1" from before versions existed counts as version 1). */
export const TOUR_KEY = 'alk_tour_done'
export const TOUR_START_EVENT = 'alk:tour-start'
export const TOUR_DONE_EVENT = 'alk:tour-done'
/** Set when a guest finishes the tour, so the promised gift is paid right after they sign up. */
const TOUR_CLAIM_KEY = 'alk_tour_claim'
const TRACK_URL = '/api/tour/track'
const GAP = 12

let tourOpen = false
const tourWatchers = new Set<() => void>()

function setTourOpen(open: boolean) {
  if (tourOpen === open) return
  tourOpen = open
  tourWatchers.forEach((notify) => notify())
}

function watchTour(notify: () => void) {
  tourWatchers.add(notify)
  return () => {
    tourWatchers.delete(notify)
  }
}

/** True while the tour is on screen, so other prompts wait their turn instead of stacking up behind it. */
export function useTourOpen() {
  return useSyncExternalStore(
    watchTour,
    () => tourOpen,
    () => false,
  )
}

type Result = { tone: 'ok' | 'info' | 'error'; text: string }
type RunStep = TourStep & { at: TourScreen }
type Run = { audience: TourAudience; steps: RunStep[]; preview: boolean; reward: number }
type Box = { top: number; left: number; width: number; height: number }

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

/** The place itself, or on a phone the menu button it hides behind. */
function findSpot(screen: TourScreen) {
  const el = findTarget(screen.selectors)
  if (el) return { el, viaMenu: false }
  const menu = screen.inMenu ? findTarget([TOUR_MENU_BUTTON]) : null
  return menu ? { el: menu, viaMenu: true } : null
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

/** Positions the card from its measured size, so a long text or a picture never pushes it off screen. */
function placeCard(box: Box | null, vw: number, vh: number, cardW: number, cardH: number, docked: boolean): CSSProperties {
  if (vw < 640) {
    const low = box ? box.top + box.height / 2 > vh / 2 : false
    const room = low && box ? box.top - 2 * GAP : vh - 84 - GAP - (box ? box.top + box.height + GAP : GAP)
    const maxHeight = Math.max(200, Math.min(vh - 108, Math.max(220, room)))
    return low
      ? { top: `calc(env(safe-area-inset-top) + ${GAP}px)`, left: GAP, right: GAP, maxHeight }
      : { bottom: 'calc(env(safe-area-inset-bottom) + 84px)', left: GAP, right: GAP, maxHeight }
  }
  const maxHeight = vh - 2 * GAP
  const shown = Math.min(cardH, maxHeight)
  const lowest = vh - shown - GAP
  if (!box) {
    const left = (vw - cardW) / 2
    return docked ? { bottom: 2 * GAP, left, width: cardW, maxHeight } : { top: clamp((vh - shown) / 2, GAP, lowest), left, width: cardW, maxHeight }
  }
  const left = clamp(box.left + box.width / 2 - cardW / 2, GAP, vw - cardW - GAP)
  const sideLeft = box.left + box.width + GAP
  const sideFits = sideLeft + cardW + GAP <= vw
  if (sideFits && (box.height > vh * 0.5 || (box.left < 280 && box.width < 280))) {
    return { top: clamp(box.top, GAP, lowest), left: sideLeft, width: cardW, maxHeight }
  }
  const below = box.top + box.height + GAP
  if (below + shown <= vh - GAP) return { top: below, left, width: cardW, maxHeight }
  const above = box.top - GAP - shown
  return { top: above >= GAP ? above : lowest, left, width: cardW, maxHeight }
}

export function SiteTour({ settings }: { settings: TourSettings }) {
  const { member, loading, setBalance, requireLogin } = usePoints()
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const onGamePage = pathname.startsWith('/oyunlar/')
  const [run, setRun] = useState<Run | null>(null)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [viaMenu, setViaMenu] = useState(false)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [cardH, setCardH] = useState(260)
  const [claiming, setClaiming] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const shown = useRef(new Set<string>())
  const reported = useRef(true)
  const running = useRef(false)
  useEffect(() => {
    running.current = run !== null
    setTourOpen(run !== null)
  }, [run])
  useEffect(() => () => setTourOpen(false), [])

  const begin = useCallback((audience: TourAudience, source: TourSettings, preview: boolean) => {
    const steps = tourSteps(source, audience).map((s) => ({ ...s, at: tourScreen(s.screen) }))
    if (!steps.length) return
    shown.current = new Set()
    reported.current = preview
    setIndex(0)
    setResult(null)
    setRun({ audience, steps, preview, reward: source.reward })
  }, [])

  const start = useCallback(() => {
    if (!running.current) begin(member ? 'member' : 'guest', settings, false)
  }, [begin, member, settings])

  const step = run?.steps[index]

  const report = useCallback(
    (exit: string | null, done: boolean) => {
      if (!run || reported.current) return
      reported.current = true
      const body = JSON.stringify({ a: run.audience, seen: [...shown.current], exit, done })
      const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'application/json' }))
      if (!sent) void fetch(TRACK_URL, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
    },
    [run],
  )

  const close = useCallback(() => {
    if (!run) return
    if (!run.preview) {
      report(step?.id ?? null, false)
      localStorage.setItem(TOUR_KEY, String(settings.version))
      if (member) void markTourSeenAction()
    }
    setRun(null)
    window.dispatchEvent(new Event(TOUR_DONE_EVENT))
  }, [run, step, report, settings.version, member])

  const claim = useCallback(async () => {
    if (!run) return
    if (run.preview) {
      const text = run.audience === 'guest' ? 'Önizleme: gerçek turda burada kayıt penceresi açılır.' : run.reward > 0 ? `Önizleme: gerçek turda burada ${run.reward.toLocaleString('tr-TR')} KC verilir.` : 'Önizleme bitti.'
      return setResult({ tone: 'info', text })
    }
    report(null, true)
    if (!member) {
      if (run.reward > 0) localStorage.setItem(TOUR_CLAIM_KEY, '1')
      close()
      // The button says "Kayıt ol", so it opens the sign-up tab. With the session still unknown, requireLogin re-checks it first.
      if (loading) requireLogin()
      else window.location.hash = 'kayit'
      return
    }
    if (run.reward <= 0) return close()
    setClaiming(true)
    const res = await completeTourAction()
    setClaiming(false)
    localStorage.setItem(TOUR_KEY, String(settings.version))
    if (res.status === 'awarded') {
      setBalance(res.balance)
      setResult({ tone: 'ok', text: `${res.amount.toLocaleString('tr-TR')} KC hesabına yattı. İyi eğlenceler kanka!` })
    } else if (res.status === 'already') {
      setResult({ tone: 'info', text: 'Tur ödülünü daha önce almışsın, ödül hesap başına bir kez veriliyor.' })
    } else if (res.status === 'multi') {
      setResult({ tone: 'error', text: 'Bu cihaz veya ağdan tur ödülü daha önce alınmış. Ödül kişi başına bir kez verilir.' })
    } else if (res.status === 'off') {
      setResult({ tone: 'info', text: 'Tur ödülü şu an kapalı.' })
    } else if (res.status === 'late') {
      setResult({ tone: 'info', text: `Tur ödülü üyeliğin ilk ${res.days} gününde veriliyor, bu süre geçmiş.` })
    } else if (res.status === 'cap') {
      setResult({ tone: 'info', text: 'Bugünkü tur ödülleri dağıtıldı. Yarın menüden “Siteyi keşfet” ile turu bitirirsen ödülünü alırsın.' })
    } else if (res.status === 'guest') {
      close()
      requireLogin()
    } else {
      setResult({ tone: 'error', text: ('message' in res && res.message) || 'Bir şeyler ters gitti, tekrar dene.' })
    }
  }, [run, member, loading, settings.version, report, close, requireLogin, setBalance])

  useEffect(() => {
    if (!settings.enabled) return
    window.addEventListener(TOUR_START_EVENT, start)
    return () => window.removeEventListener(TOUR_START_EVENT, start)
  }, [start, settings.enabled])

  // Preview from the panel: the draft it parked on the server, no reward, nothing counted or remembered.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const value = params.get(TOUR_PREVIEW_PARAM)
    const audience = value === TOUR_PREVIEW_VALUES.guest ? 'guest' : value === TOUR_PREVIEW_VALUES.member ? 'member' : null
    if (!audience) return
    const token = params.get(TOUR_PREVIEW_TOKEN_PARAM)
    let cancelled = false
    const timer = setTimeout(() => {
      const open = (source: TourSettings) => {
        if (!cancelled) begin(audience, source, true)
      }
      if (token) void getTourPreviewAction(token).then((draft) => open(draft ?? settings), () => open(settings))
      else open(settings)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Only on arrival: the preview must not restart when the settings object is re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!settings.enabled || !settings.autoStart || loading || onGamePage) return
    if (new URLSearchParams(window.location.search).has(TOUR_PREVIEW_PARAM)) return
    if ((Number(localStorage.getItem(TOUR_KEY)) || 0) >= settings.version) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (!cancelled) timer = setTimeout(start, settings.autoStartDelay * 1000)
    }
    if (member) {
      getMyTourState()
        .then((s) => {
          if (s?.done) localStorage.setItem(TOUR_KEY, String(settings.version))
          else schedule()
        })
        .catch(schedule)
    } else schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [settings.enabled, settings.autoStart, settings.autoStartDelay, settings.version, loading, member, start, onGamePage])

  // A guest who finished the tour and then signed up gets the gift without walking it again.
  useEffect(() => {
    if (loading || !member || !settings.enabled || settings.reward <= 0) return
    if (!localStorage.getItem(TOUR_CLAIM_KEY)) return
    localStorage.removeItem(TOUR_CLAIM_KEY)
    let cancelled = false
    void completeTourAction()
      .then((res) => {
        if (cancelled || res.status !== 'awarded' || running.current) return
        localStorage.setItem(TOUR_KEY, String(settings.version))
        setBalance(res.balance)
        const last = tourSteps(settings, 'member').at(-1)
        if (!last) return
        reported.current = true
        setIndex(0)
        setRun({ audience: 'member', steps: [{ ...last, at: tourScreen('hesap'), show: 'spot', image: '' }], preview: false, reward: settings.reward })
        setResult({ tone: 'ok', text: `Tur hediyen ${res.amount.toLocaleString('tr-TR')} KC hesabına yattı. Hoş geldin kanka!` })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [loading, member, settings, setBalance])

  useEffect(() => {
    if (step) shown.current.add(step.id)
  }, [step])

  // An "open the page" step takes the visitor there; the tour itself lives in the layout and stays up.
  const openHref = step?.show === 'open' ? step.at.href : undefined
  useEffect(() => {
    if (openHref && pathname !== openHref) router.push(openHref)
  }, [openHref, pathname, router])

  useEffect(() => {
    if (!run || run.preview || !step) return
    const onHide = () => report(step.id, false)
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [run, step, report])

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight })
    const spot = step && step.show !== 'open' ? findSpot(step.at) : null
    setViaMenu(Boolean(spot?.viaMenu))
    if (!spot) return setBox(null)
    const r = spot.el.getBoundingClientRect()
    setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 })
  }, [step])

  useLayoutEffect(() => {
    if (!step) return
    if (step.show !== 'open') findSpot(step.at)?.el.scrollIntoView({ block: 'nearest' })
    measure()
    nextRef.current?.focus()
    // The page behind may still be arriving (a step that opened it, a menu that is sliding in).
    const settle = window.setTimeout(measure, 350)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(settle)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, measure, pathname])

  const sizeCard = useCallback(() => {
    const h = cardRef.current?.scrollHeight
    if (h) setCardH((prev) => (Math.abs(prev - h) > 1 ? h : prev))
  }, [])
  useLayoutEffect(sizeCard)

  useEffect(() => {
    if (!run) return
    const last = run.steps.length - 1
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (result) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, last))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [run, close, result])

  if (!run || !step) return null

  const count = run.steps.length
  const isLast = index === count - 1
  const hasReward = run.reward > 0
  const docked = step.show === 'open'
  const cardWidth = Math.min(360, viewport.w - 2 * GAP)
  const cardStyle = placeCard(box, viewport.w, viewport.h, cardWidth, cardH, docked)
  const asGuest = run.preview ? run.audience === 'guest' : !member
  const finalLabel = asGuest ? (hasReward ? 'Kayıt ol, hediyeni al' : 'Kayıt ol') : hasReward ? `Bitir ve ${run.reward.toLocaleString('tr-TR')} KC al` : 'Bitir'

  return (
    <div data-tour-overlay="" className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300 ease-out"
          style={{ ...box, boxShadow: '0 0 0 9999px color-mix(in oklab, var(--background) 82%, transparent)' }}
        />
      ) : (
        <div aria-hidden="true" className={cn('absolute inset-0', docked ? 'bg-background/40' : 'bg-background/80 backdrop-blur-sm')} />
      )}
      <button type="button" aria-label="Turu kapat" tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default" style={{ background: 'transparent' }} />

      <div
        key={index}
        ref={cardRef}
        style={cardStyle}
        className="absolute flex animate-in fade-in flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl duration-200"
      >
        <div className="flex items-start gap-3">
          <JakoAvatar pose={step.at.pose} size="md" className="max-sm:size-16" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Siteyi keşfet · {index + 1}/{count}
            </span>
            <h2 id="tour-title" className="text-balance font-display text-base font-bold text-foreground">
              {step.title}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="Turu kapat" className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {run.preview && (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Eye className="size-3.5 shrink-0" aria-hidden="true" />
            Önizleme · {run.audience === 'guest' ? 'misafirin' : 'üyenin'} gördüğü tur, ödül verilmez
          </p>
        )}

        {step.image && (
          // eslint-disable-next-line @next/next/no-img-element -- the address comes from the panel and can be any host
          <img src={step.image} alt="" onLoad={sizeCard} className="max-h-36 w-full shrink-0 rounded-xl border border-border object-cover" />
        )}

        {step.body && (
          <p id="tour-body" className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        )}

        {viaMenu && !result && (
          <p className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-xs leading-relaxed text-foreground">
            <Menu className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Telefonda bu bölüm menünün içinde: işaretli düğmeyle menüyü aç, <strong className="font-semibold">{step.at.label}</strong> satırına dokun.
            </span>
          </p>
        )}

        {hasReward && !result && (index === 0 || isLast) && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            <Coins className="size-4 shrink-0" aria-hidden="true" />
            Turu bitirene {run.reward.toLocaleString('tr-TR')} KC hediye · hesap başına 1 kez
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

        {count > 1 && (
          <div className="flex items-center gap-1" aria-hidden="true">
            {run.steps.map((s, i) => (
              <span key={s.id} className={cn('h-1 rounded-full transition-all', i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border')} />
            ))}
          </div>
        )}

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
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {step.at.href && step.at.go && !docked && !result && (
              <Link href={step.at.href} onClick={close} className="flex h-9 items-center rounded-lg border border-primary/50 px-3 text-xs font-bold text-primary hover:bg-primary/10">
                {step.at.go}
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
