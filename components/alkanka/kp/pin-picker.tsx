'use client'

import { useState, useTransition } from 'react'
import { Pin } from 'lucide-react'
import { savePinsAction } from '@/app/actions/badges'
import { SpecialEmblem } from './emblem'
import { cn } from '@/lib/utils'

type Owned = { id: string; name: string; icon: string; tier: string; rarity: string }

export function PinPicker({ owned, initial, max }: { owned: Owned[]; initial: string[]; max: number }) {
  const [pins, setPins] = useState(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const toggle = (id: string) => {
    const next = pins.includes(id) ? pins.filter((p) => p !== id) : pins.length >= max ? pins : [...pins, id]
    if (next === pins) return setMsg(`En fazla ${max} rozet sabitleyebilirsin.`)
    setPins(next)
    setMsg(null)
    start(async () => {
      const r = await savePinsAction(next)
      if (!r.ok) {
        setPins(pins)
        setMsg(r.error)
      } else setMsg('Vitrin kaydedildi. Sıralamada isminin yanında görünür.')
    })
  }

  if (!owned.length) return null
  return (
    <section aria-labelledby="vitrin" className="flex flex-col gap-3 rounded-2xl border border-gold/25 bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 id="vitrin" className="flex items-center gap-1.5 font-display text-base font-bold text-foreground">
          <Pin className="size-4 text-gold" aria-hidden /> Rozet vitrinim
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {max} rozet seç, sıralamada ve profilinde isminin yanında herkes görsün. ({pins.length}/{max})
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {owned.map((b) => {
          const on = pins.includes(b.id)
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => toggle(b.id)}
                disabled={pending}
                aria-pressed={on}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors disabled:opacity-60',
                  on ? 'border-gold bg-gold/10' : 'border-border hover:border-gold/50',
                )}
              >
                <SpecialEmblem icon={b.icon} tier={b.tier} size="xs" />
                <span className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">{b.name}</span>
                  <span className="text-[10px] text-muted-foreground">{b.rarity}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {msg && <p role="status" className="text-xs text-muted-foreground">{msg}</p>}
    </section>
  )
}
