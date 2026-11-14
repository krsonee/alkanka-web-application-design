'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Smartphone, Volume1, Volume2, VolumeX } from 'lucide-react'
import { setHaptics, setSoundMuted, setSoundVolume, useHaptics, useSoundMuted, useSoundVolume, type SoundName } from '@/lib/sound'
import { cn } from '@/lib/utils'

const PANEL_WIDTH = 224

/** Sound button that opens the game settings every table shares: mute, volume and vibration. */
export function SoundToggle({ className }: { className?: string }) {
  const muted = useSoundMuted()
  const volume = useSoundVolume()
  const haptics = useHaptics()
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<CSSProperties>({})
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const silent = muted || volume === 0
  const Icon = silent ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  const toggle = () => {
    const r = button.current?.getBoundingClientRect()
    if (r) {
      // Fixed to the viewport so a table that clips its overflow cannot cut the panel off.
      const left = Math.min(Math.max(8, r.right - PANEL_WIDTH), window.innerWidth - PANEL_WIDTH - 8)
      const below = window.innerHeight - r.bottom > 190
      setPlace(below ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    const dismiss = () => setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', dismiss)
    }
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label="Ses ve titreşim ayarları"
        title="Ses ve titreşim"
        className={cn(
          'flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-secondary/70',
          silent && 'text-muted-foreground',
          className,
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="group"
          aria-label="Ses ve titreşim ayarları"
          style={{ ...place, width: PANEL_WIDTH }}
          className="fixed z-[80] flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-2xl"
        >
          <Switch label="Oyun sesleri" on={!muted} onChange={(v) => setSoundMuted(!v)} />
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              Ses seviyesi
              <span className="tabular-nums text-foreground">{`%${Math.round(volume * 100)}`}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(volume * 100)}
              disabled={muted}
              onChange={(e) => setSoundVolume(Number(e.target.value) / 100)}
              className="h-6 w-full accent-primary disabled:opacity-40"
            />
          </label>
          <Switch
            label="Titreşim"
            hint="Telefonda sıra gelince ve hamlede"
            icon={<Smartphone className="size-4" aria-hidden="true" />}
            on={haptics}
            onChange={setHaptics}
          />
        </div>
      )}
    </>
  )
}

function Switch({ label, hint, icon, on, onChange }: { label: string; hint?: string; icon?: React.ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-9 items-center justify-between gap-3 rounded-lg text-left"
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        <span className="flex min-w-0 flex-col">
          {label}
          {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn('flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'justify-end bg-primary' : 'justify-start bg-secondary')}
      >
        <span className="size-4 rounded-full bg-foreground" />
      </span>
    </button>
  )
}

/** Sound for the local player's own action, played the moment they make it. */
export function actionSound(game: string, type: string): SoundName {
  if (type === 'roll' || type === 'rollDice') return 'dice'
  if (type === 'shoot' || type === 'shot') return 'cue'
  if (type === 'buy' || type === 'pay' || type === 'build') return 'coin'
  if (game === 'batak' || game === 'pisti' || game === 'papaz') return 'card'
  if (game === 'okey' || game === 'okey101') return 'tile'
  if (game === 'tavla' || game === 'monopoly') return 'tile'
  if (game === 'bilardo') return 'cue'
  return 'tick'
}
