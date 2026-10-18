'use client'

import { useActionState } from 'react'
import { Save } from 'lucide-react'
import { saveAmbient, type AmbientActionState } from '@/app/panel/ambient-actions'
import type { AmbientSettings } from '@/lib/ambient-tables'

const HOURS = Array.from({ length: 25 }, (_, h) => h)

export function AmbientEditor({ settings }: { settings: AmbientSettings }) {
  const [state, action, pending] = useActionState<AmbientActionState, FormData>(saveAmbient, {})
  const select = 'h-10 rounded-lg border border-input bg-background px-3 text-foreground'
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold uppercase text-foreground">Dolu masalar</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Seçtiğin saatlerde her oyunun lobisinde normal üye isimleriyle oynanan dolu masalar görünür. Veritabanına kayıt yazmaz,
          sunucuda oyun çalıştırmaz; masalar her 9 dakikada bir değişir. 20:00-01:00 arası her lobiye 1 masa fazla eklenir. Saatler
          Türkiye saatidir; bitiş başlangıçtan küçükse gece yarısını geçer.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="size-4 accent-primary" />
        Açık
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-foreground">Başlangıç saati</span>
          <select name="startHour" defaultValue={settings.startHour} className={select}>
            {HOURS.slice(0, 24).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-foreground">Bitiş saati</span>
          <select name="endHour" defaultValue={settings.endHour} className={select}>
            {HOURS.map((h) => (
              <option key={h} value={h}>{String(h % 24).padStart(2, '0')}:00</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-foreground">Lobi başına masa</span>
          <input type="number" name="perGame" min={0} max={8} defaultValue={settings.perGame} className={select} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        {state.message && (
          <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
