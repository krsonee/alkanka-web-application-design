'use client'

import { useState } from 'react'
import { ArrowLeft, Check, Loader2, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIZARD_GAME_LABEL, type SetupConfig, type WizardGame } from '@/lib/home-v2-shared'
import { BATAK_RULE_OPTIONS, BATAK_VARIANTS, type BatakVariant } from '@/lib/games/batak'
import { DEFAULT_PISTI_RULES, PISTI_RULE_OPTIONS, PISTI_TARGETS, pistiRulesToList } from '@/lib/games/pisti'
import { PAPAZ_RULE_OPTIONS } from '@/lib/games/papaz'
import { MONO_RULE_OPTIONS } from '@/lib/games/monopoly'

const fmt = (n: number) => n.toLocaleString('tr-TR')

type Choice = { value: string; label: string; hint?: string; disabled?: boolean }
type Step = { key: string; title: string; choices: Choice[]; multi?: boolean; note?: string; wide?: boolean }
type Picks = Record<string, string>

export type TableOptions = {
  seats?: number
  team?: boolean
  bots?: number
  rounds?: number
  variant?: string
  extras?: string[]
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const botChoices = (seats: number): Choice[] =>
  range(0, seats - 1).map((i) => ({
    value: String(i),
    label: i === 0 ? 'Bot yok' : i === seats - 1 ? `Bota karşı (${i})` : `${i} bot`,
    hint: i === 0 ? 'Sadece oyuncular' : i === seats - 1 ? 'Hemen başlar' : undefined,
  }))
const modeChoices = (teamLabel = 'Eşli (2+2)'): Choice[] => [
  { value: 'solo', label: 'Tekli', hint: 'Herkes kendine' },
  { value: 'team', label: teamLabel, hint: 'Karşılıklı oturanlar takım' },
]
const multi = (key: string, title: string, list: { key: string; label: string; hint: string }[]): Step => ({
  key,
  title,
  multi: true,
  choices: list.map((o) => ({ value: o.key, label: o.label, hint: o.hint })),
})

const DEFAULT_EXTRAS: Partial<Record<WizardGame, string[]>> = {
  batak: ['batma'],
  pisti: pistiRulesToList(DEFAULT_PISTI_RULES) as string[],
}

function batakSeats(p: Picks) {
  return BATAK_VARIANTS.find((v) => v.value === p.variant)?.seats ?? 4
}

function seatCount(game: WizardGame, p: Picks): number {
  if (game === 'okey') return Number(p.seats ?? 4)
  if (game === 'okey101') return 4
  if (game === 'batak') return batakSeats(p)
  if (game === 'pisti') return Number(p.seats ?? 4)
  if (game === 'papaz' || game === 'monopoly') return Number(p.seats ?? 4)
  return 2
}

function buildSteps(game: WizardGame, p: Picks, config: SetupConfig, bets: number[], balance: number | null): Step[] {
  const seats = seatCount(game, p)
  const steps: Step[] = []
  const botsOn = config.quickBotEnabled
  switch (game) {
    case 'okey': {
      const two = p.seats === '2'
      if (config.allowTwoSeats && botsOn)
        steps.push({ key: 'seats', title: 'Kişi sayısı', choices: [
          { value: '2', label: '2 kişilik', hint: 'Birebir · 2 koltuğa bot oturur' },
          { value: '4', label: '4 kişilik', hint: 'Klasik masa' },
        ] })
      steps.push({ key: 'mode', title: 'Oyun modu', choices: [
        { value: 'solo', label: 'Tekli', hint: 'Herkes kendine' },
        { value: 'team', label: 'Takımlı', hint: '2+2, sadece 4 kişide', disabled: two },
      ] })
      steps.push({ key: 'points', title: 'Puan', note: config.ruleFull, choices: config.points.map((n) => ({
        value: String(n), label: n === 0 ? 'Tek el' : `${n} puan`, hint: n === 0 ? 'Tek el biter' : n === 10 ? 'Kısa' : n === 20 ? 'Orta' : 'Uzun',
      })) })
      if (!two && botsOn) steps.push({ key: 'bots', title: 'Bot', choices: botChoices(4) })
      break
    }
    case 'okey101':
      steps.push({ key: 'mode', title: 'Oyun modu', choices: modeChoices() })
      steps.push({ key: 'rounds', title: 'El sayısı', choices: [1, 3, 5].map((n) => ({ value: String(n), label: `${n} el`, hint: n === 1 ? 'Kısa' : n === 3 ? 'Orta' : 'Uzun' })) })
      steps.push({ key: 'bots', title: 'Bot', choices: botChoices(4) })
      break
    case 'tavla':
      steps.push({ key: 'rounds', title: 'Maç', choices: [
        { value: '1', label: 'Tek el', hint: 'Mars 2, ağır mars 3 kat' },
        { value: '3', label: '3 el', hint: '2 eli ilk alan kazanır' },
        { value: '5', label: '5 el', hint: '3 eli ilk alan kazanır' },
      ] })
      break
    case 'batak':
      steps.push({ key: 'variant', title: 'Batak türü', wide: true, choices: BATAK_VARIANTS.map((v) => ({ value: v.value, label: v.label, hint: `${v.hint} · ${v.seats} kişi` })) })
      steps.push({ key: 'rounds', title: 'Oyun sonu', choices: [1, 31, 51, 101].map((n) => ({ value: String(n), label: n === 1 ? 'Tek el' : `${n} puan` })) })
      if (botsOn) steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
      {
        const list = BATAK_RULE_OPTIONS.filter((o) => o.variants.includes((p.variant ?? 'klasik') as BatakVariant))
        if (list.length) steps.push(multi('extras', 'Masa ayarları', list))
      }
      break
    case 'pisti':
      steps.push({ key: 'target', title: 'Puan', choices: PISTI_TARGETS.map((t) => ({ value: t.value, label: t.label, hint: t.hint })) })
      steps.push({ key: 'seats', title: 'Kişi sayısı', choices: [
        { value: '2', label: '2 kişilik', hint: 'Birebir' },
        { value: '4', label: '4 kişilik', hint: 'Eşli ya da tekli' },
      ] })
      if (p.seats === '4') steps.push({ key: 'mode', title: 'Oyun modu', choices: modeChoices() })
      if (botsOn) steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
      steps.push(multi('extras', 'Masa ayarları', PISTI_RULE_OPTIONS))
      break
    case 'papaz':
      steps.push({ key: 'seats', title: 'Kişi sayısı', choices: range(2, 6).map((n) => ({ value: String(n), label: `${n} kişilik` })) })
      if (botsOn) steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
      steps.push(multi('extras', 'Masa ayarları', PAPAZ_RULE_OPTIONS))
      break
    case 'monopoly':
      steps.push({ key: 'seats', title: 'Kişi sayısı', choices: range(2, 8).map((n) => ({ value: String(n), label: `${n} kişilik`, hint: n >= 4 && n <= 6 ? 'İdeal' : undefined })) })
      steps.push({ key: 'rounds', title: 'Süre', choices: [999, 50, 30].map((n) => ({ value: String(n), label: n >= 999 ? 'Sınırsız' : `${n} tur`, hint: n >= 999 ? 'Son kalan kazanır' : 'En zengin kazanır' })) })
      if (botsOn) steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
      steps.push(multi('extras', 'Ev kuralları', MONO_RULE_OPTIONS))
      break
    case 'bilardo':
      break
  }
  steps.push({ key: 'stake', title: 'Bahis', choices: bets.map((b) => ({ value: String(b), label: `${fmt(b)} KC`, disabled: balance != null && b > balance })) })
  return steps
}

function buildResult(game: WizardGame, p: Picks): { options: TableOptions | undefined; humans: number; bots: number; summary: [string, string][] } {
  const seats = seatCount(game, p)
  const extras = p.extras ? p.extras.split(',').filter(Boolean) : []
  const n = (k: string) => Number(p[k] ?? 0)
  const modeLabel = p.mode === 'team' ? 'Eşli' : 'Tekli'
  switch (game) {
    case 'okey': {
      const two = p.seats === '2'
      const bots = two ? 2 : n('bots')
      const team = !two && p.mode === 'team'
      const points = n('points')
      return {
        options: { seats: 4, team, bots, ...(points ? { rounds: points } : {}) },
        humans: 4 - bots,
        bots,
        summary: [['Masa', `${two ? 2 : 4} kişi · ${team ? 'Takımlı' : 'Tekli'}`], ['Puan', points ? `${points} puan` : 'Tek el'], ['Bot', bots ? `${bots} bot` : 'Yok']],
      }
    }
    case 'okey101':
      return {
        options: { seats: 4, bots: n('bots'), rounds: n('rounds'), team: p.mode === 'team' },
        humans: 4 - n('bots'),
        bots: n('bots'),
        summary: [['Masa', `4 kişi · ${modeLabel}`], ['El', `${n('rounds')} el`], ['Bot', n('bots') ? `${n('bots')} bot` : 'Yok']],
      }
    case 'tavla':
      return { options: { rounds: n('rounds') }, humans: 2, bots: 0, summary: [['Maç', n('rounds') === 1 ? 'Tek el' : `${n('rounds')} el`]] }
    case 'batak': {
      const variant = (p.variant ?? 'klasik') as BatakVariant
      const allowed = BATAK_RULE_OPTIONS.filter((o) => o.variants.includes(variant)).map((o) => o.key as string)
      return {
        options: { seats, bots: n('bots'), rounds: n('rounds'), variant, extras: extras.filter((k) => allowed.includes(k)) },
        humans: seats - n('bots'),
        bots: n('bots'),
        summary: [['Tür', BATAK_VARIANTS.find((v) => v.value === variant)?.label ?? ''], ['Oyun sonu', n('rounds') === 1 ? 'Tek el' : `${n('rounds')} puan`], ['Bot', n('bots') ? `${n('bots')} bot` : 'Yok']],
      }
    }
    case 'pisti':
      return {
        options: { seats, bots: n('bots'), variant: p.target ?? '151', team: seats === 4 && p.mode === 'team', extras },
        humans: seats - n('bots'),
        bots: n('bots'),
        summary: [['Masa', `${seats} kişi${seats === 4 ? ` · ${modeLabel}` : ''}`], ['Puan', `${p.target ?? '151'}`], ['Bot', n('bots') ? `${n('bots')} bot` : 'Yok']],
      }
    case 'papaz':
      return {
        options: { seats, bots: n('bots'), extras },
        humans: seats - n('bots'),
        bots: n('bots'),
        summary: [['Masa', `${seats} kişi`], ['Bot', n('bots') ? `${n('bots')} bot` : 'Yok'], ['Kural', extras.length ? `${extras.length} seçili` : 'Standart']],
      }
    case 'monopoly':
      return {
        options: { seats, bots: n('bots'), rounds: n('rounds'), extras },
        humans: seats - n('bots'),
        bots: n('bots'),
        summary: [['Masa', `${seats} kişi`], ['Süre', n('rounds') >= 999 ? 'Sınırsız' : `${n('rounds')} tur`], ['Bot', n('bots') ? `${n('bots')} bot` : 'Yok']],
      }
    case 'bilardo':
      return { options: undefined, humans: 2, bots: 0, summary: [['Masa', 'Birebir']] }
  }
}

function prune(game: WizardGame, p: Picks, config: SetupConfig, bets: number[], balance: number | null): Picks {
  const steps = buildSteps(game, p, config, bets, balance)
  const next: Picks = {}
  for (const s of steps) {
    const v = p[s.key]
    if (v == null) continue
    if (s.multi) {
      const allowed = s.choices.map((c) => c.value)
      next[s.key] = v.split(',').filter((k) => allowed.includes(k)).join(',')
    } else if (s.choices.some((c) => c.value === v && !c.disabled)) next[s.key] = v
  }
  return next
}

export function TableSetupWizard({
  game,
  config,
  bets,
  balance,
  commission,
  busy,
  error,
  onCreate,
  onClose,
}: {
  game: WizardGame
  config: SetupConfig
  bets: number[]
  balance: number | null
  commission: number
  busy: boolean
  error: string | null
  onCreate: (stake: number, options: TableOptions | undefined) => void
  onClose: () => void
}) {
  const gameCfg = config.games[game]
  const guest = balance == null
  const storeKey = `alkanka:masa-ac:${game}`
  const [picks, setPicksState] = useState<Picks>((): Picks => {
    const base: Picks = game === 'okey' && (!config.allowTwoSeats || !config.quickBotEnabled) ? { seats: '4' } : {}
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storeKey) ?? 'null') as Picks | null
      if (saved && typeof saved === 'object') return prune(game, { ...base, ...saved }, config, bets, balance)
    } catch {}
    return base
  })
  const setPicks = (fn: (p: Picks) => Picks) =>
    setPicksState((p) => {
      const next = fn(p)
      try {
        window.sessionStorage.setItem(storeKey, JSON.stringify(next))
      } catch {}
      return next
    })
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<string[]>(DEFAULT_EXTRAS[game] ?? [])

  const steps = buildSteps(game, picks, config, bets, balance)
  const current = editing ?? steps.find((s) => picks[s.key] == null)?.key ?? null
  const currentStep = steps.find((s) => s.key === current)
  const done = steps.filter((s) => picks[s.key] != null && s.key !== current)
  const complete = current == null

  const labelOf = (s: Step) => {
    const v = picks[s.key] ?? ''
    if (s.multi) {
      const n = v.split(',').filter(Boolean).length
      return n ? `${n} seçili` : 'Standart'
    }
    return s.choices.find((c) => c.value === v)?.label ?? ''
  }

  const commit = (key: string, value: string) => {
    setPicks((p) => prune(game, { ...p, [key]: value }, config, bets, balance))
    setEditing(null)
  }

  const openStep = (s: Step) => {
    if (s.multi) setDraft((picks[s.key] ?? '').split(',').filter(Boolean))
    setEditing(s.key)
  }

  const stake = Number(picks.stake ?? 0)
  const result = buildResult(game, picks)
  const pot = stake * result.humans
  const prize = pot - Math.round((pot * commission) / 100)
  const intro = gameCfg?.intro || config.intro
  const rule = game === 'okey' ? '' : gameCfg?.rule

  return (
    <section aria-label={`${WIZARD_GAME_LABEL[game]} ${config.title}`} className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{WIZARD_GAME_LABEL[game]}</span>
          <h2 className="text-2xl font-black text-foreground">{config.title}</h2>
          {intro && <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{intro}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Kapat" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <ol className="flex gap-1.5" aria-label="İlerleme">
        {steps.map((s) => (
          <li key={s.key} className={cn('h-1.5 flex-1 rounded-full', picks[s.key] != null && s.key !== current ? 'bg-primary' : s.key === current ? 'bg-primary/50' : 'bg-secondary')}>
            <span className="sr-only">{`${s.title}${picks[s.key] != null ? ': seçildi' : ''}`}</span>
          </li>
        ))}
      </ol>

      {done.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Seçimlerin">
          {done.map((s) => (
            <li key={s.key}>
              <button type="button" onClick={() => openStep(s)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50">
                <span className="text-muted-foreground">{s.title}:</span>
                {labelOf(s)}
                <Pencil className="size-3 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
          {game === 'okey' && picks.seats === '2' && (
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
            <h3 className="font-bold text-foreground">{currentStep.title}</h3>
            {currentStep.multi && <span className="text-xs text-muted-foreground">(birden fazla seçebilirsin)</span>}
          </div>
          <div
            role={currentStep.multi ? 'group' : 'radiogroup'}
            aria-label={currentStep.title}
            className={cn('grid gap-2', currentStep.key === 'stake' ? 'grid-cols-4' : currentStep.choices.length > 4 && !currentStep.wide ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2')}
          >
            {currentStep.choices.map((c) => {
              const on = currentStep.multi ? draft.includes(c.value) : picks[currentStep.key] === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  role={currentStep.multi ? 'switch' : 'radio'}
                  aria-checked={on}
                  disabled={c.disabled}
                  onClick={() =>
                    currentStep.multi
                      ? setDraft((d) => (on ? d.filter((k) => k !== c.value) : [...d, c.value]))
                      : commit(currentStep.key, c.value)
                  }
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
                  {c.hint && <span className="text-pretty text-xs leading-snug text-muted-foreground">{c.hint}</span>}
                </button>
              )
            })}
          </div>
          {currentStep.multi && (
            <button
              type="button"
              onClick={() => commit(currentStep.key, draft.join(','))}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {draft.length ? 'Devam' : 'Standart kurallarla devam'}
            </button>
          )}
          {currentStep.note && <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{currentStep.note}</p>}
        </div>
      )}

      {complete && (
        <div className="flex flex-col gap-4 rounded-2xl bg-secondary/60 p-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {result.summary.map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-bold text-foreground">{v}</dd>
              </div>
            ))}
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{game === 'papaz' ? 'Dağıtılan' : picks.mode === 'team' ? 'Takıma' : 'Kazanırsan'}</dt>
              <dd className="font-bold tabular-nums text-primary">{`${fmt(prize)} KC`}</dd>
            </div>
          </dl>
          {rule && <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{rule}</p>}
          {result.humans === 1 && result.bots > 0 && (
            <p className="text-xs text-muted-foreground">Tek gerçek oyuncuyla oyun hemen botlara karşı başlar.</p>
          )}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => onCreate(stake, result.options)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {guest ? 'Üye ol ve oyna' : `Masayı aç · ${fmt(stake)} KC`}
          </button>
          {guest && (
            <p className="text-center text-xs text-muted-foreground">Seçimlerini koruruz. Giriş yapınca masan bu ayarlarla hazır olur.</p>
          )}
        </div>
      )}
    </section>
  )
}
