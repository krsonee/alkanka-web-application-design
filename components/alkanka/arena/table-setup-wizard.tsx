'use client'

import { useState } from 'react'
import { ArrowLeft, Check, Loader2, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIZARD_GAME_LABEL, type SetupConfig, type WizardGame } from '@/lib/home-v2-shared'
import { BATAK_RULE_OPTIONS, BATAK_VARIANTS, type BatakVariant } from '@/lib/games/batak'
import { DEFAULT_PISTI_RULES, PISTI_RULE_OPTIONS, PISTI_TARGETS, pistiRulesToList } from '@/lib/games/pisti'
import { PAPAZ_RULE_OPTIONS } from '@/lib/games/papaz'
import { MONO_RULE_OPTIONS } from '@/lib/games/monopoly'
import { BOT_DAILY_PROFIT_CAP, isFullPotGame, tablePot } from '@/lib/arena'
import { arenaThemeGame } from '@/lib/table-themes'
import { TableThemeField } from './table-theme'

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
/** Most bots first: a table against bots starts on the spot, an all-player table waits for kankas. */
const botChoices = (seats: number): Choice[] =>
  range(0, seats - 1).reverse().map((i) => ({
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

const CARD_SCORING = 'En çok kart +3, eşitlikte kimseye verilmez. As ve Vale +1, ♣2 +2, ♦10 +3. Pişti +10, Vale pişti +20.'

function gameNotes(game: WizardGame, p: Picks): string[] {
  const notes: string[] = []
  if ((game === 'okey' || game === 'okey101' || game === 'pisti') && p.mode === 'team')
    notes.push('Karşılıklı oturanlar eş olur, eşlerden biri bitirince takım kazanır.')
  if (game === 'batak' && p.rounds)
    notes.push(
      p.rounds === '1'
        ? 'Tek el oynanır, en yüksek puan kazanır. Eşitlikte ihaleyi alan kazanır.'
        : `${p.rounds} puana ilk ulaşan kazanır. Zirvede eşitlik olursa bir el daha oynanır.`,
    )
  if (game === 'pisti' || game === 'papaz') notes.push(CARD_SCORING)
  if (game === 'monopoly') notes.push('Alınmayan tapu mezata çıkar. Oyuncular kendi sıralarında takas teklif edebilir. En iyi oyun 4-6 kişiyle oynanır.')
  return notes
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
  switch (game) {
    case 'okey': {
      steps.push({ key: 'mode', title: 'Oyun modu', note: 'Masalar 4 kişilik. Gerçek oyuncu gelmeyen koltuklara bot oturtabilirsin.', choices: [
        { value: 'solo', label: 'Tekli', hint: 'Herkes kendine' },
        { value: 'team', label: 'Takımlı', hint: 'Karşılıklı oturanlar takım (2+2)' },
      ] })
      steps.push({
        key: 'points',
        title: 'Puan',
        note:
          p.points && p.points !== '0'
            ? `Herkes ${p.points} puanla başlar. Normal bitişte rakipler 2 puan kaybeder (1 kat). Okeyle ya da çiftten bitiş 2 kat (4 puan), çiftten ve okeyle bitiş 4 kat (8 puan) sildirir. Göstergeyi gösteren rakiplerine 1 puan sildirir. Puanı ilk sıfırlanan olunca en yüksek puanlı kazanır.`
            : 'İlk bitiren masayı kazanır.',
        choices: [0, 10, 20, 30].map((n) => ({ value: String(n), label: n === 0 ? 'Tek el' : `${n} puan` })),
      })
      steps.push({ key: 'bots', title: 'Bot koltuğu', choices: [
          { value: '3', label: 'Bota karşı (3 bot)', hint: 'Hemen başlar' },
          { value: '2', label: '2 bot' },
          { value: '1', label: '1 bot' },
          { value: '0', label: 'Bot yok', hint: 'Sadece oyuncular' },
        ] })
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
      steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
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
      steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
      steps.push(multi('extras', 'Masa ayarları', PISTI_RULE_OPTIONS))
      break
    case 'papaz':
      steps.push({ key: 'seats', title: 'Kişi sayısı', choices: range(2, 6).map((n) => ({ value: String(n), label: `${n} kişilik` })) })
      steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
      steps.push(multi('extras', 'Masa ayarları', PAPAZ_RULE_OPTIONS))
      break
    case 'monopoly':
      steps.push({ key: 'seats', title: 'Kişi sayısı', choices: range(2, 8).map((n) => ({ value: String(n), label: `${n} kişilik`, hint: n >= 4 && n <= 6 ? 'İdeal' : undefined })) })
      steps.push({ key: 'rounds', title: 'Süre', choices: [999, 50, 30].map((n) => ({ value: String(n), label: n >= 999 ? 'Sınırsız' : `${n} tur`, hint: n >= 999 ? 'Son kalan kazanır' : 'En zengin kazanır' })) })
      steps.push({ key: 'bots', title: 'Bot', choices: botChoices(seats) })
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
      const bots = n('bots')
      const team = p.mode === 'team'
      const points = n('points')
      return {
        options: { seats: 4, team, bots, ...(points ? { rounds: points } : {}) },
        humans: 4 - bots,
        bots,
        summary: [['Masa', `4 kişi · ${team ? 'Takımlı' : 'Tekli'}`], ['Puan', points ? `${points} puan` : 'Tek el'], ['Bot', bots ? `${bots} bot` : 'Yok']],
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
  embedded = false,
}: {
  embedded?: boolean
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
  const [picks, setPicks] = useState<Picks>((): Picks => {
    const base: Picks = game === 'okey' ? { seats: '4' } : {}
    // Only the guest "Üye ol ve oyna" handoff restores picks; every other visit starts empty.
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storeKey) ?? 'null') as Picks | null
      window.sessionStorage.removeItem(storeKey)
      if (saved && typeof saved === 'object') return prune(game, { ...base, ...saved }, config, bets, balance)
    } catch {}
    return base
  })
  const savePicksForLogin = () => {
    try {
      window.sessionStorage.setItem(storeKey, JSON.stringify(picks))
    } catch {}
  }
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<string[]>(DEFAULT_EXTRAS[game] ?? [])

  const steps = buildSteps(game, picks, config, bets, balance)
  const current = editing ?? steps.find((s) => picks[s.key] == null)?.key ?? null
  const currentStep = steps.find((s) => s.key === current)
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
    setPicks((p) => {
      const next: Picks = { ...p, [key]: value }
      if (p[key] != null && p[key] !== value) {
        const order = buildSteps(game, p, config, bets, balance).map((s) => s.key)
        for (const later of order.slice(order.indexOf(key) + 1)) delete next[later]
      }
      return prune(game, next, config, bets, balance)
    })
    setEditing(null)
  }

  const openStep = (s: Step) => {
    if (picks[s.key] == null && s.key !== current) return
    if (s.multi) setDraft((picks[s.key] ?? '').split(',').filter(Boolean))
    setEditing(s.key)
  }

  const stake = Number(picks.stake ?? 0)
  const result = buildResult(game, picks)
  const split = tablePot(game, stake, commission, { humans: result.humans, bots: Number(picks.bots ?? 0) })
  const prize = Math.floor(split.net)
  const intro = gameCfg?.intro || config.intro
  const rule = game === 'okey' ? '' : gameCfg?.rule
  const themeGame = arenaThemeGame(game)

  return (
    <section aria-label={`${WIZARD_GAME_LABEL[game]} ${config.title}`} className={embedded ? 'flex flex-col gap-4' : 'flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 sm:p-7'}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{WIZARD_GAME_LABEL[game]}</span>
          <h2 className={embedded ? 'text-lg font-black text-foreground' : 'text-2xl font-black text-foreground'}>{config.title}</h2>
          {intro && <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{intro}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Kapat" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Masa ayarların</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {`${steps.filter((s) => picks[s.key] != null && s.key !== current).length}/${steps.length} seçildi`}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Masa ayarların">
          {steps.map((s) => {
            const picked = picks[s.key] != null && s.key !== current
            const active = s.key === current
            const locked = !picked && !active
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => openStep(s)}
                  disabled={locked}
                  aria-current={active ? 'step' : undefined}
                  title={locked ? 'Önce önceki adımı seç' : undefined}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/10'
                      : picked
                        ? 'border-border bg-secondary hover:border-primary/60'
                        : 'cursor-not-allowed border-dashed border-border bg-background opacity-60',
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      {s.title}
                      <span className="text-primary" aria-hidden="true">*</span>
                      <span className="sr-only">(zorunlu)</span>
                    </span>
                    <span className={cn('truncate text-sm font-bold', picked ? 'text-foreground' : active ? 'text-primary' : 'text-muted-foreground')}>
                      {picked ? labelOf(s) : active ? 'Şimdi seç' : 'Sırada bekliyor'}
                    </span>
                  </span>
                  {picked ? (
                    <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : active ? (
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
        {!complete && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-bold text-primary">*</span> Tüm alanlar zorunlu ve sırayla seçilir. Hepsini seçmeden masa açılmaz.
          </p>
        )}
      </div>

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
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
            {`Pot ${fmt(split.pot)} KC${split.botStake ? (isFullPotGame(game) ? ' (her bot kendi bahsini koyar)' : ' (botlar birlikte tek bahis koyar)') : ''}, %${split.cut} kesinti düşülür.${split.botStake && isFullPotGame(game) ? ` Botlu masalarda günde en çok ${fmt(BOT_DAILY_PROFIT_CAP)} KC kâr edilir.` : ''}`}
          </p>
          {rule && <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{rule}</p>}
          {gameNotes(game, picks).map((note) => (
            <p key={note} className="text-pretty text-xs leading-relaxed text-muted-foreground">{note}</p>
          ))}
          {game === 'tavla' && (
            <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
              {picks.rounds === '1'
                ? `Tek elde mars 2 kat, ağır mars 3 kat öder. Mars güvencesi için girişte +${fmt(stake * 2)} KC bloke edilir, oyun bitince iade edilir.`
                : `${picks.rounds === '3' ? '2' : '3'} eli ilk alan maçı kazanır. Mars 2, ağır mars 3 el sayılır.`}
            </p>
          )}
          {themeGame && <TableThemeField game={themeGame} />}
          {result.humans === 1 && result.bots > 0 && (
            <p className="text-xs text-muted-foreground">Tek gerçek oyuncuyla oyun hemen botlara karşı başlar.</p>
          )}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (guest) savePicksForLogin()
              onCreate(stake, result.options)
            }}
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
