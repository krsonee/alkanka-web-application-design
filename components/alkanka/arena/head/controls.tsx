'use client'

import { useState, useSyncExternalStore } from 'react'
import NextImage from 'next/image'
import { ArrowBigUp, ChevronLeft, ChevronRight, Footprints, Maximize2, Smartphone, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playSound, setSoundMuted, useSoundMuted } from '@/lib/sound'
import { CHARACTERS, type BotLevel, type Keys, type NetEvent, type Sport } from './engine'

/* --------------------------- preferences --------------------------- */

export type ControlPrefs = { size: 's' | 'm' | 'l'; opacity: 'low' | 'mid' | 'high'; haptics: boolean; bot: BotLevel; char: string }
const PREFS_KEY = 'alkanka:head-controls'
const DEFAULT_PREFS: ControlPrefs = { size: 'm', opacity: 'mid', haptics: true, bot: 'mid', char: 'jako' }
let prefs = DEFAULT_PREFS
let prefsLoaded = false
const prefListeners = new Set<() => void>()

export function readPrefs() {
  if (!prefsLoaded && typeof window !== 'undefined') {
    prefsLoaded = true
    try {
      prefs = { ...DEFAULT_PREFS, ...JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}') }
    } catch {
      prefs = DEFAULT_PREFS
    }
  }
  return prefs
}

export function setPrefs(patch: Partial<ControlPrefs>) {
  prefs = { ...readPrefs(), ...patch }
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  prefListeners.forEach((l) => l())
}

export function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      prefListeners.add(l)
      return () => prefListeners.delete(l)
    },
    readPrefs,
    () => DEFAULT_PREFS,
  )
}

export const charIndex = (id: string) => Math.max(0, CHARACTERS.findIndex((c) => c.id === id))

/** Plays sounds and haptics from an event batch; visual events are handled by the renderer. */
export function playEvents(list: NetEvent[], seat: 0 | 1) {
  for (const [name, v] of list) {
    if (name === 'shake' || name === 'fx') continue
    if (name === 'hb' || name === 'h0' || name === 'h1') {
      if ((name === 'hb' || name === `h${seat}`) && readPrefs().haptics) navigator.vibrate?.(v)
    } else playSound(name, v)
  }
}

/* --------------------------- media helpers --------------------------- */

export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const PHONE_PORTRAIT = '(pointer: coarse) and (orientation: portrait)'

/** Hides the browser bars on Android once the player touches a control in landscape (needs a user gesture). */
export function enterFullscreen() {
  if (document.fullscreenElement || !window.matchMedia('(pointer: coarse) and (orientation: landscape)').matches) return
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
}

function requestLandscape() {
  const el = document.documentElement
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
  el.requestFullscreen?.()
    .then(() => orientation.lock?.('landscape'))
    .catch(() => {})
}

/* --------------------------- touch controls --------------------------- */

function bindKey(keys: React.RefObject<Keys>, k: keyof Keys, onPress?: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      keys.current[k] = true
      onPress?.()
    },
    onPointerUp: () => (keys.current[k] = false),
    onPointerCancel: () => (keys.current[k] = false),
    onLostPointerCapture: () => (keys.current[k] = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}

const OVERLAY_BTN =
  'pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border-2 border-foreground/35 bg-background/15 text-foreground shadow-md backdrop-blur-[2px] transition-transform active:scale-90 active:border-primary active:bg-primary/70 active:text-primary-foreground active:opacity-100'
const OVERLAY_PAD =
  'pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border-2 border-foreground/35 bg-background/15 text-foreground shadow-md backdrop-blur-[2px] transition-transform'
const OVERLAY_PAD_ON = 'scale-90 border-primary bg-primary/70 text-primary-foreground opacity-100'

const BTN_SIZE: Record<ControlPrefs['size'], string> = {
  s: 'size-12 landscape:size-14',
  m: 'size-14 landscape:size-16',
  l: 'size-16 landscape:size-20',
}
const SMALL_BTN: Record<ControlPrefs['size'], string> = {
  s: 'size-11 landscape:size-12',
  m: 'size-12 landscape:size-14',
  l: 'size-14 landscape:size-16',
}
const ICON_SIZE: Record<ControlPrefs['size'], string> = { s: 'size-6', m: 'size-7', l: 'size-8' }
const BTN_OPACITY: Record<ControlPrefs['opacity'], string> = { low: 'opacity-40', mid: 'opacity-75', high: 'opacity-100' }

/** One touch zone for left/right so sliding the thumb across switches direction without lifting it. */
function DirectionPad({ k1, size, icon, onPress }: { k1: React.RefObject<Keys>; size: string; icon: string; onPress?: () => void }) {
  const [dir, setDir] = useState<-1 | 0 | 1>(0)
  const aim = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const right = e.clientX > r.left + r.width / 2
    k1.current.left = !right
    k1.current.right = right
    setDir(right ? 1 : -1)
  }
  const release = () => {
    k1.current.left = false
    k1.current.right = false
    setDir(0)
  }
  return (
    <div
      role="group"
      aria-label="Sola ve sağa hareket"
      className="pointer-events-auto flex touch-none select-none gap-2.5"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        aim(e)
        onPress?.()
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) aim(e)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={cn(OVERLAY_PAD, size, dir === -1 && OVERLAY_PAD_ON)} aria-hidden="true">
        <ChevronLeft className={icon} />
      </span>
      <span className={cn(OVERLAY_PAD, size, dir === 1 && OVERLAY_PAD_ON)} aria-hidden="true">
        <ChevronRight className={icon} />
      </span>
    </div>
  )
}

/**
 * Translucent buttons on touch screens: arrows bottom-left, jump/kick bottom-right, the super power above them.
 * In full landscape they sit at the screen corners so they cover less of the goal mouths.
 */
export function OverlayControls({
  k1,
  full,
  onPress,
  onPower,
  powerReady,
  powerColor,
}: {
  k1: React.RefObject<Keys>
  full?: boolean
  onPress?: () => void
  onPower: () => void
  powerReady: boolean
  powerColor: string
}) {
  const p = usePrefs()
  const size = cn(BTN_SIZE[p.size], BTN_OPACITY[p.opacity])
  const icon = ICON_SIZE[p.size]
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-2.5',
        // Inset ~9% from each edge so both goal mouths (the outer ~8% of the pitch) stay fully visible.
        full
          ? 'pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(9%,env(safe-area-inset-left))] pr-[max(9%,env(safe-area-inset-right))]'
          : 'lg:hidden',
      )}
    >
      <DirectionPad k1={k1} size={size} icon={icon} onPress={onPress} />
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          aria-label={powerReady ? 'Süper gücü kullan' : 'Süper güç doluyor'}
          aria-disabled={!powerReady}
          onPointerDown={(e) => {
            e.preventDefault()
            onPress?.()
            onPower()
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            OVERLAY_BTN,
            SMALL_BTN[p.size],
            'mr-1',
            powerReady ? 'animate-pulse border-primary bg-primary/80 text-primary-foreground opacity-100' : BTN_OPACITY[p.opacity],
          )}
          style={powerReady ? { boxShadow: `0 0 18px ${powerColor}` } : undefined}
        >
          <Zap className="size-5" aria-hidden="true" />
        </button>
        <div className="flex items-end gap-2.5">
          <button type="button" className={cn(OVERLAY_BTN, size)} aria-label="Zıpla" {...bindKey(k1, 'jump', onPress)}>
            <ArrowBigUp className={icon} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn(OVERLAY_BTN, size, 'mb-5 border-primary/80')}
            aria-label="Şut, basılı tutarak güç doldur"
            {...bindKey(k1, 'kick', onPress)}
          >
            <Footprints className={icon} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- settings --------------------------- */

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-bold transition-colors',
              value === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-background/60',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-3 py-0.5 text-sm font-semibold text-foreground"
    >
      {label}
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted')}>
        <span className={cn('absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow transition-transform', on && 'translate-x-4')} />
      </span>
    </button>
  )
}

const SIZE_OPTIONS = [['s', 'Küçük'], ['m', 'Orta'], ['l', 'Büyük']] as const
const OPACITY_OPTIONS = [['low', 'Silik'], ['mid', 'Orta'], ['high', 'Net']] as const
export const BOT_OPTIONS = [['easy', 'Kolay'], ['mid', 'Orta'], ['hard', 'Zor']] as const

export function ControlSettings({ pauses, onClose }: { pauses: boolean; onClose: () => void }) {
  const p = usePrefs()
  const muted = useSoundMuted()
  return (
    <div
      role="dialog"
      aria-label="Kontrol ayarları"
      className="absolute left-2 top-12 z-30 flex max-h-[calc(100%-3.5rem)] w-60 flex-col gap-3 overflow-y-auto rounded-xl border border-primary/30 bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-black uppercase tracking-tight">Kontrol ayarları</p>
        <button type="button" onClick={onClose} aria-label="Ayarları kapat" className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <Segmented label="Tuş boyutu" value={p.size} options={SIZE_OPTIONS} onChange={(size) => setPrefs({ size })} />
      <Segmented label="Tuş görünürlüğü" value={p.opacity} options={OPACITY_OPTIONS} onChange={(opacity) => setPrefs({ opacity })} />
      {pauses && <Segmented label="Bot seviyesi" value={p.bot} options={BOT_OPTIONS} onChange={(bot) => setPrefs({ bot })} />}
      <ToggleRow label="Titreşim" on={p.haptics} onChange={(haptics) => setPrefs({ haptics })} />
      <ToggleRow label="Ses ve tribün" on={!muted} onChange={(on) => setSoundMuted(!on)} />
      {pauses && <p className="text-xs leading-relaxed text-muted-foreground">Ayarlar açıkken maç durur.</p>}
    </div>
  )
}

export function RotatePrompt({ sport, paused }: { sport: Sport; paused: boolean }) {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-background px-6 py-8 text-center"
    >
      <div className="relative">
        <NextImage
          src="/images/mascots/jako-duyuru.png"
          alt="Jako maskot"
          width={160}
          height={160}
          className="size-36 animate-[jako-bob_1.6s_ease-in-out_infinite] object-contain drop-shadow-xl"
        />
        <span className="absolute -bottom-1 -right-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Smartphone className="size-6 animate-[phone-rotate_2s_ease-in-out_infinite]" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-balance font-display text-2xl font-black uppercase tracking-tight text-foreground">
          {paused ? 'Maç durdu kanka!' : 'Telefonu yan çevir kanka!'}
        </p>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {paused
            ? 'Dik tutunca saha sığmıyor. Telefonu tekrar yan çevir, maç kaldığı yerden devam etsin.'
            : `${sport === 'futbol' ? 'Kafa topu' : 'Kafa basketbolu'} yatay ekranda çok daha rahat oynanır. Telefonu yan çevirdiğin an maç başlar.`}
        </p>
      </div>
      <button
        type="button"
        onClick={requestLandscape}
        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md transition-transform active:scale-95"
      >
        <Maximize2 className="size-4" aria-hidden="true" />
        Tam ekran yatay aç
      </button>
    </div>
  )
}
