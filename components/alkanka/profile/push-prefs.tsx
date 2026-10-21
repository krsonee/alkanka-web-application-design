'use client'

import { useState, useTransition } from 'react'
import { BellRing, BellOff } from 'lucide-react'
import { saveMyPushPrefs } from '@/app/actions/app'
import { usePwa } from '../app/pwa-provider'
import { cn } from '@/lib/utils'

type Topic = { value: string; label: string; hint: string }

export function PushPrefsCard({ topics, initialOff }: { topics: Topic[]; initialOff: string[] }) {
  const { pushState, enablePush } = usePwa()
  const [off, setOff] = useState(initialOff)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const toggle = (value: string) => {
    const next = off.includes(value) ? off.filter((t) => t !== value) : [...off, value]
    setOff(next)
    setMsg(null)
    start(async () => {
      const res = await saveMyPushPrefs(next)
      setOff(res.off)
      setMsg(res.ok ? 'Kaydedildi' : 'Çok hızlı değiştirdin, biraz bekle kanka.')
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      {pushState !== 'granted' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellOff className="size-4 shrink-0" aria-hidden />
            {pushState === 'denied' ? 'Bildirimler tarayıcı ayarlarından kapalı.' : 'Bu cihazda bildirimler kapalı.'}
          </p>
          {pushState === 'default' && (
            <button type="button" onClick={() => enablePush()} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground">
              <BellRing className="size-3.5" aria-hidden /> Aç
            </button>
          )}
        </div>
      )}
      <ul className="flex flex-col divide-y divide-border">
        {topics.map((t) => {
          const on = !off.includes(t.value)
          return (
            <li key={t.value} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-foreground">{t.label}</span>
                <span className="text-pretty text-xs leading-relaxed text-muted-foreground">{t.hint}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t.label}
                disabled={pending}
                onClick={() => toggle(t.value)}
                className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60', on ? 'bg-primary' : 'bg-muted-foreground/30')}
              >
                <span className={cn('absolute top-0.5 size-5 rounded-full bg-background shadow transition-all', on ? 'left-5' : 'left-0.5')} />
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground" role="status">
        {msg ?? 'Kazanç, seviye ve önemli hesap bildirimleri her zaman gelir.'}
      </p>
    </div>
  )
}
