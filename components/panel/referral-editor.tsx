'use client'

import { useActionState } from 'react'
import { Save } from 'lucide-react'
import { saveReferral, type ReferralActionState } from '@/app/panel/referral-actions'
import { REFERRAL_LIMITS, type ReferralSettings } from '@/lib/referral-settings'

const FIELDS: { name: keyof ReferralSettings; label: string; hint: string; min: number }[] = [
  { name: 'welcome', label: 'Hoş geldin bonusu (KC)', hint: 'Davet linkiyle kayıt olan kişiye anında verilir. 0 yaparsan kapanır.', min: 0 },
  { name: 'referred', label: 'Arkadaş ödülü (KC)', hint: 'Davet edilen kişi oyun şartını tamamlayınca ona verilir.', min: 0 },
  { name: 'referrer', label: 'Davet eden ödülü (KC)', hint: 'Arkadaşı oyun şartını tamamlayınca davet edene verilir (rütbe çarpanıyla).', min: 0 },
  { name: 'minGames', label: 'Oyun şartı', hint: 'Ödüllerin açılması için davet edilenin oynaması gereken oyun sayısı.', min: 1 },
]

export function ReferralEditor({ settings }: { settings: ReferralSettings }) {
  const [state, action, pending] = useActionState<ReferralActionState, FormData>(saveReferral, {})
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold uppercase text-foreground">Davet ödülleri</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Aynı ağdan açılan ve işaretlenen hesaplar ödül alamaz. Hak eden davetler her gün otomatik ödenir ve davet edene bildirim gider.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.name} className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-foreground">{f.label}</span>
            <input
              type="number"
              name={f.name}
              min={f.min}
              max={REFERRAL_LIMITS[f.name]}
              defaultValue={settings[f.name]}
              required
              className="h-10 rounded-lg border border-input bg-background px-3 text-foreground"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">{f.hint}</span>
          </label>
        ))}
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
