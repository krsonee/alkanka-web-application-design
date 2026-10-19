'use client'

import { useActionState, useTransition } from 'react'
import { Compass, Loader2, Save, ShieldAlert } from 'lucide-react'
import { clearTourBlockAction, saveTourSettingsAction } from '@/app/panel/tour-actions'
import type { ActionState } from '@/app/panel/actions'
import { TOUR_STEP_IDS, TOUR_STEP_LABELS, type TourSettings } from '@/lib/tour-config'
import type { TourStats } from '@/lib/tour'

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

function Toggle({ name, label, defaultChecked, disabled }: { name: string; label: string; defaultChecked: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  )
}

export function TourSettingsEditor({ settings, stats }: { settings: TourSettings; stats: TourStats }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTourSettingsAction, {})
  const [clearing, startClear] = useTransition()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Turu bitiren', value: stats.done },
          { label: 'Ödül alan', value: stats.rewarded },
          { label: 'Multi engeli', value: stats.blocked },
          { label: 'Dağıtılan KC', value: stats.paidTotal.toLocaleString('tr-TR') },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="font-display text-2xl font-bold text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      <form action={action} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Site turu</h2>
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Turu bitiren üyeye ödül sadece bir kez verilir. Aynı ağdan, aynı tarayıcıdan veya multi olarak işaretlenmiş hesaplara ödül
          verilmez. 0 yazarsan ödül kapanır, tur yine gösterilir.
        </p>

        <div className="flex flex-col gap-3">
          <Toggle name="enabled" label="Tur açık" defaultChecked={settings.enabled} />
          <Toggle name="autoStart" label="Yeni ziyaretçide otomatik başlasın" defaultChecked={settings.autoStart} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Bitirme ödülü (KC)
            <input name="reward" type="number" min={0} max={100000} defaultValue={settings.reward} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Otomatik başlama gecikmesi (saniye)
            <input name="autoStartDelay" type="number" min={0} max={60} defaultValue={settings.autoStartDelay} className={input} />
          </label>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="pb-2 text-sm font-bold text-foreground">Adımlar</legend>
          {TOUR_STEP_IDS.map((id, i) => {
            const step = settings.steps[id]
            return (
              <div key={id} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {i + 1}. {TOUR_STEP_LABELS[id]}
                  </span>
                  {id === 'final' ? (
                    <span className="text-xs text-muted-foreground">Her zaman açık</span>
                  ) : (
                    <Toggle name={`${id}.enabled`} label="Göster" defaultChecked={step.enabled} />
                  )}
                </div>
                {id === 'final' && <input type="hidden" name="final.enabled" value="on" />}
                <input name={`${id}.title`} defaultValue={step.title} maxLength={80} aria-label={`${TOUR_STEP_LABELS[id]} başlığı`} className={input} />
                <textarea
                  name={`${id}.body`}
                  defaultValue={step.body}
                  maxLength={400}
                  rows={3}
                  aria-label={`${TOUR_STEP_LABELS[id]} metni`}
                  className={`${input} resize-y leading-relaxed`}
                />
              </div>
            )
          })}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            Kaydet
          </button>
          {state.message ? (
            <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-labelledby="tour-blocked">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-destructive" aria-hidden />
          <h2 id="tour-blocked" className="font-display text-lg font-bold uppercase text-foreground">
            Engellenen ödül talepleri
          </h2>
        </div>
        {stats.recentBlocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz multi engeli yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stats.recentBlocked.map((b) => (
              <li key={b.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.reason} · {new Date(b.at).toLocaleString('tr-TR')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => startClear(() => void clearTourBlockAction(b.userId))}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Engeli kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
