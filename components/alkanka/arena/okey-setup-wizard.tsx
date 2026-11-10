'use client'

import { useState } from 'react'
import { ArrowLeft, Check, Loader2, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SetupConfig } from '@/lib/home-v2-shared'

const fmt = (n: number) => n.toLocaleString('tr-TR')

type Key = 'seats' | 'mode' | 'points' | 'bots' | 'stake'
type Choice = { value: string; label: string; hint?: string; disabled?: boolean }
type Picks = Partial<Record<Key, string>>

export type OkeyWizardResult = {
  stake: number
  options: { seats: number; team: boolean; bots: number; rounds?: number }
}

const TITLES: Record<Key, string> = { seats: 'Kişi sayısı', mode: 'Oyun modu', points: 'Puan', bots: 'Bot', stake: 'Bahis' }

export function OkeySetupWizard({
  config,
  bets,
  balance,
  commission,
  busy,
  error,
  onCreate,
  onClose,
}: {
  config: SetupConfig
  bets: number[]
  balance: number | null
  commission: number
  busy: boolean
  error: string | null
  onCreate: (r: OkeyWizardResult) => void
  onClose: () => void
}) {
  const [picks, setPicks] = useState<Picks>(() => (config.allowTwoSeats ? {} : { seats: '4' }))
  const [editing, setEditing] = useState<Key | null>(null)

  const two = picks.seats === '2'
  const steps: { key: Key; choices: Choice[] }[] = [
    ...(config.allowTwoSeats
      ? [{ key: 'seats' as Key, choices: [
          { value: '2', label: '2 kişilik', hint: 'Birebir · 2 koltuğa bot oturur' },
          { value: '4', label: '4 kişilik', hint: 'Klasik masa' },
        ] }]
      : []),
    { key: 'mode', choices: [
      { value: 'solo', label: 'Tekli', hint: 'Herkes kendine' },
      { value: 'team', label: 'Takımlı', hint: '2+2, sadece 4 kişide', disabled: two },
    ] },
    { key: 'points', choices: config.points.map((p) => ({ value: String(p), label: p === 0 ? 'Tek el' : `${p} puan`, hint: p === 0 ? 'Tek el biter' : p === 10 ? 'Kısa' : p === 20 ? 'Orta' : 'Uzun' })) },
    ...(two
      ? []
      : [{ key: 'bots' as Key, choices: [
          { value: '0', label: 'Bot yok', hint: 'Sadece oyuncular' },
          { value: '1', label: '1 bot' },
          { value: '2', label: '2 bot' },
          { value: '3', label: 'Bota karşı', hint: '3 bot · hemen başlar' },
        ] }]),
    { key: 'stake', choices: bets.map((b) => ({ value: String(b), label: `${fmt(b)} KC`, disabled: balance != null && b > balance })) },
  ]

  const current = editing ?? steps.find((s) => picks[s.key] == null)?.key ?? null
  const currentStep = steps.find((s) => s.key === current)
  const done = steps.filter((s) => picks[s.key] != null && s.key !== current)
  const complete = current == null

  const labelOf = (k: Key) => steps.find((s) => s.key === k)?.choices.find((c) => c.value === picks[k])?.label ?? ''

  const choose = (k: Key, v: string) => {
    setPicks((p) => {
      const next = { ...p, [k]: v }
      if (k === 'seats' && v === '2') {
        next.mode = 'solo'
        delete next.bots
      }
      return next
    })
    setEditing(null)
  }

  const stake = Number(picks.stake ?? 0)
  const seats = Number(picks.seats ?? 4)
  const bots = two ? 2 : Number(picks.bots ?? 0)
  const team = picks.mode === 'team' && seats === 4
  const points = Number(picks.points ?? 0)
  const prize = Math.floor(stake * 4 * (1 - commission / 100))

  const submit = () =>
    onCreate({ stake, options: { seats: 4, team, bots, ...(points ? { rounds: points } : {}) } })

  return (
    <section aria-label={config.title} className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Okey</span>
          <h2 className="text-2xl font-black text-foreground">{config.title}</h2>
          {config.intro && <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{config.intro}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Kapat" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <ol className="flex gap-1.5" aria-label="İlerleme">
        {steps.map((s) => (
          <li key={s.key} className={cn('h-1.5 flex-1 rounded-full', picks[s.key] != null && s.key !== current ? 'bg-primary' : s.key === current ? 'bg-primary/50' : 'bg-secondary')}>
            <span className="sr-only">{`${TITLES[s.key]}${picks[s.key] != null ? ': seçildi' : ''}`}</span>
          </li>
        ))}
      </ol>

      {done.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Seçimlerin">
          {done.map((s) => (
            <li key={s.key}>
              <button type="button" onClick={() => setEditing(s.key)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50">
                <span className="text-muted-foreground">{TITLES[s.key]}:</span>
                {labelOf(s.key)}
                <Pencil className="size-3 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
          {two && (
            <li className="inline-flex items-center rounded-full bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground">Bot: 2 bot (otomatik)</li>
          )}
        </ul>
      )}

      {currentStep && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {editing && (
              <button type="button" onClick={() => setEditing(null)} aria-label="Geri" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
              </button>
            )}
            <h3 className="font-bold text-foreground">{TITLES[currentStep.key]}</h3>
          </div>
          <div role="radiogroup" aria-label={TITLES[currentStep.key]} className={cn('grid gap-2', currentStep.key === 'stake' ? 'grid-cols-4' : 'grid-cols-2')}>
            {currentStep.choices.map((c) => {
              const on = picks[currentStep.key] === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={c.disabled}
                  onClick={() => choose(currentStep.key, c.value)}
                  className={cn(
                    'flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                    currentStep.key === 'stake' && 'items-center text-center',
                    on ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                    {on && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                    {c.label}
                  </span>
                  {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
                </button>
              )
            })}
          </div>
          {currentStep.key === 'points' && config.ruleFull && (
            <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{config.ruleFull}</p>
          )}
        </div>
      )}

      {complete && (
        <div className="flex flex-col gap-4 rounded-2xl bg-secondary/60 p-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="flex flex-col"><dt className="text-xs text-muted-foreground">Masa</dt><dd className="font-bold text-foreground">{`${seats} kişi · ${team ? 'Takımlı' : 'Tekli'}`}</dd></div>
            <div className="flex flex-col"><dt className="text-xs text-muted-foreground">Puan</dt><dd className="font-bold text-foreground">{points ? `${points} puan` : 'Tek el'}</dd></div>
            <div className="flex flex-col"><dt className="text-xs text-muted-foreground">Bot</dt><dd className="font-bold text-foreground">{bots ? `${bots} bot` : 'Yok'}</dd></div>
            <div className="flex flex-col"><dt className="text-xs text-muted-foreground">{team ? 'Takıma' : 'Kazanırsan'}</dt><dd className="font-bold tabular-nums text-primary">{`${fmt(prize)} KC`}</dd></div>
          </dl>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {`Masayı aç · ${fmt(stake)} KC`}
          </button>
        </div>
      )}
    </section>
  )
}
