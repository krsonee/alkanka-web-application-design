'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { editLeagueQuestions, finishLeagueMatch, loadLeaguePicks, moveLeagueMatch, removeLeagueMatch } from '@/app/panel/community-actions'
import type { LeagueMatch } from '@/lib/predictions'
import {
  MARKETS,
  SPORTS,
  marketList,
  marketTitle,
  prizeText,
  resultError,
  resultNeeds,
  rewardText,
  sportOf,
  voidedBy,
  type Board,
  type MatchResult,
  type QuestionSet,
} from '@/lib/predictions-shared'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { usePanelAction } from '@/components/panel/flash'
import { PickList } from '@/components/panel/pick-list'
import { RecordLink } from '@/components/panel/record-link'
import { StatusLine } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'
import { QuestionSetEditor, setProblem, type PrizeOptions } from './league-fields'
import { BoardSelect } from './league-boards'

const caption = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground'

const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

type AdminState = 'waiting' | 'open' | 'done'

const adminState = (m: LeagueMatch, now: number): AdminState => (m.settled ? 'done' : new Date(m.kickoff).getTime() <= now ? 'waiting' : 'open')

const STATES: { id: AdminState; label: string; empty: string }[] = [
  { id: 'waiting', label: 'Sonuç bekleyen', empty: 'Sonucu girilmeyi bekleyen maç yok.' },
  { id: 'open', label: 'Tahmine açık', empty: 'Yayında, henüz başlamamış maç yok. Takvimden seç ya da elle ekle.' },
  { id: 'done', label: 'Sonuçlanan', empty: 'Sonuçlanan maç yok.' },
]

function Questions({ set }: { set: QuestionSet }) {
  const bonus = set.bonus ? [set.bonus.pts ? `${set.bonus.pts} puan` : '', prizeText(set.bonus.prize)].filter(Boolean).join(' + ') : ''
  return (
    <ul className="flex flex-wrap gap-1.5 text-xs">
      {marketList(set).map((id) => {
        const rule = set.markets[id]!
        return (
          <li key={id} className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
            <b>{marketTitle(id, rule)}</b>
            {rewardText(rule) && <span className="text-muted-foreground">{` · ${rewardText(rule)}`}</span>}
          </li>
        )
      })}
      {bonus && (
        <li className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-foreground">
          <b>Hepsini bilene</b>
          <span className="text-muted-foreground">{` · ${bonus}`}</span>
        </li>
      )}
    </ul>
  )
}

function Digits({ label, value, onChange, wide = false, digits = 2 }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; digits?: number }) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, digits))}
      placeholder="-"
      className={cn('h-10 rounded-lg border border-border bg-background text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring', wide ? 'w-20' : 'w-14')}
    />
  )
}

const numberOrNull = (v: string) => (v === '' ? null : Number(v))

function ResultForm({ m }: { m: LeagueMatch }) {
  const { pending, status, run } = usePanelAction('Maç puanlandı.')
  const [v, setV] = useState({ home: '', away: '', htHome: '', htAway: '', corners: '', cards: '', first: '' })
  const put = (k: keyof typeof v) => (value: string) => setV((prev) => ({ ...prev, [k]: value }))
  const needs = resultNeeds(m.set)
  const info = SPORTS[sportOf(m.set)]
  const digits = String(info.maxScore).length
  const ready = v.home !== '' && v.away !== ''
  const result: MatchResult = {
    home: Number(v.home),
    away: Number(v.away),
    htHome: needs.half ? numberOrNull(v.htHome) : null,
    htAway: needs.half ? numberOrNull(v.htAway) : null,
    corners: needs.corners ? numberOrNull(v.corners) : null,
    cards: needs.cards ? numberOrNull(v.cards) : null,
    first: needs.first && (v.first === '1' || v.first === '2') ? v.first : null,
  }
  const problem = ready ? resultError(m.set, result) : null
  const voided = ready && !problem ? voidedBy(m.set, result) : []
  const nothingLeft = voided.length === marketList(m.set).length

  const submit = () => {
    const dropped = voided.length ? ` Rakamı boş bırakılan sorular iptal edilir ve puanlanmaz: ${voided.map((id) => MARKETS[id].label).join(', ')}.` : ''
    void askConfirm(`${m.home} ${result.home} - ${result.away} ${m.away} sonucu girilsin mi? ${m.picks} tahmin hemen puanlanır ve ödüller dağıtılır.${dropped} Bu işlem geri alınamaz.`).then(
      (ok) => ok && run(() => finishLeagueMatch(m.id, result)),
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className={caption}>
          {info.scoreLabel}
          <span className="flex items-center gap-1.5">
            <Digits label={`${m.home} ${info.unit}`} value={v.home} onChange={put('home')} digits={digits} wide={digits > 2} />
            <span aria-hidden="true">-</span>
            <Digits label={`${m.away} ${info.unit}`} value={v.away} onChange={put('away')} digits={digits} wide={digits > 2} />
          </span>
        </div>
        {needs.half && (
          <div className={caption}>
            İlk yarı skoru
            <span className="flex items-center gap-1.5">
              <Digits label={`${m.home} ilk yarı ${info.unit}`} value={v.htHome} onChange={put('htHome')} digits={digits} wide={digits > 2} />
              <span aria-hidden="true">-</span>
              <Digits label={`${m.away} ilk yarı ${info.unit}`} value={v.htAway} onChange={put('htAway')} digits={digits} wide={digits > 2} />
            </span>
          </div>
        )}
        {needs.first && (
          <label className={cn(caption, 'w-full sm:w-56')}>
            İlk {info.unit} kimin
            <select
              value={v.first}
              onChange={(e) => put('first')(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Bilinmiyor (soru iptal olur)</option>
              <option value="1">{m.home}</option>
              <option value="2">{m.away}</option>
            </select>
          </label>
        )}
        {needs.corners && (
          <div className={caption}>
            Toplam korner
            <Digits label="Toplam korner" value={v.corners} onChange={put('corners')} wide />
          </div>
        )}
        {needs.cards && (
          <div className={caption}>
            Toplam kart (sarı + kırmızı)
            <Digits label="Toplam kart" value={v.cards} onChange={put('cards')} wide />
          </div>
        )}
        <button
          type="button"
          disabled={pending || !ready || Boolean(problem) || nothingLeft}
          onClick={submit}
          className="h-10 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40"
        >
          {pending ? 'Puanlanıyor...' : 'Sonucu gir ve puanla'}
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {problem}
        </p>
      )}
      {!problem && voided.length > 0 && (
        <p className="text-xs leading-relaxed text-primary">
          {nothingLeft
            ? 'Bu sonuçla puanlanacak soru kalmıyor. Eksik rakamları gir.'
            : `Boş bırakılan rakam yüzünden iptal edilecek soru: ${voided.map((id) => MARKETS[id].label).join(', ')}. İptal edilen soru kimseye puan yazmaz.`}
        </p>
      )}
      <StatusLine status={status} />
    </div>
  )
}

function resultLine(m: LeagueMatch) {
  const r = m.result
  if (!r) return `${m.homeGoals} - ${m.awayGoals}`
  const sport = sportOf(m.set)
  const unit = SPORTS[sport].unit
  return [
    `${r.home} - ${r.away}${sport === 'football' ? '' : ` (${unit})`}`,
    r.htHome !== null && r.htAway !== null ? `ilk yarı ${r.htHome} - ${r.htAway}` : '',
    r.first ? `ilk ${unit} ${r.first === '1' ? m.home : m.away}` : '',
    r.corners !== null ? `${r.corners} korner` : '',
    r.cards !== null ? `${r.cards} kart` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** What kind of match this is, for sports where the league name alone does not say. */
function sportLine(set: QuestionSet) {
  const sport = sportOf(set)
  if (sport === 'football') return ''
  const info = SPORTS[sport]
  return `${info.label}${set.bestOf && info.bestOf.length > 1 ? `, ${set.bestOf} ${info.unit} üzerinden` : ''} · `
}

function MatchAdminRow({ m, state, options, boards }: { m: LeagueMatch; state: AdminState; options: PrizeOptions; boards: Board[] }) {
  const { pending, status, run } = usePanelAction()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<QuestionSet>(m.set)
  const canEdit = !m.settled && m.picks === 0
  const problem = editing ? setProblem(draft) : null
  const voided = m.result ? voidedBy(m.set, m.result) : []

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-bold text-foreground">
            {m.home} - {m.away}
          </span>
          <span className="text-xs text-muted-foreground">
            {sportLine(m.set)}
            {m.league} · {when(m.kickoff)}
            {m.closesAt && m.closesAt !== m.kickoff ? ` · tahmin ${when(m.closesAt)} kapanır` : ''}
            {m.extId ? ' · takvimden' : ' · elle eklendi'}
          </span>
          <span className="text-xs text-muted-foreground">
            Lig: <b className={m.boardName ? 'text-primary' : 'text-foreground'}>{m.boardName ?? 'Genel lig'}</b>
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="text-xs font-semibold text-foreground">{m.picks} tahmin</span>
          <RecordLink kind="tahmin" id={m.id} name={`${m.home} - ${m.away}`} compact className="contents" />
          {canEdit && (
            <button
              type="button"
              aria-expanded={editing}
              onClick={() => {
                setDraft(m.set)
                setEditing((v) => !v)
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {editing ? 'Vazgeç' : boards.some((b) => b.open) ? 'Soruları ve ligi değiştir' : 'Soruları değiştir'}
            </button>
          )}
          {!m.settled && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void askConfirm(m.picks ? `Maç ve ${m.picks} tahmini silinsin mi? Tahmin yapan üyelere puan ya da ödül yazılmaz.` : 'Maç silinsin mi?').then((ok) => ok && run(() => removeLeagueMatch(m.id)))
              }
              aria-label={`${m.home} - ${m.away} maçını sil`}
              className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <BoardSelect boards={boards} value={m.boardId} onChange={(id) => id !== m.boardId && run(() => moveLeagueMatch(m.id, id))} label="Bu maçın ligi (seçince hemen kaydedilir)" className="sm:max-w-md" />
          <QuestionSetEditor value={draft} onChange={setDraft} options={options} />
          {problem && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {problem}
            </p>
          )}
          <button
            type="button"
            disabled={pending || Boolean(problem)}
            onClick={() => run(() => editLeagueQuestions(m.id, draft), () => setEditing(false))}
            className="h-10 self-start rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40"
          >
            {pending ? 'Kaydediliyor...' : 'Bu maçın sorularını kaydet'}
          </button>
        </div>
      ) : (
        <Questions set={m.set} />
      )}

      {!m.settled && m.picks > 0 && <p className="text-xs leading-relaxed text-muted-foreground">Bu maça tahmin yapıldı; soruları, ödülleri ve ligi artık değiştirilemez.</p>}

      {state === 'done' && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sonuç: <b className="text-foreground">{resultLine(m)}</b> (puanlandı)
          {voided.length > 0 && ` · iptal edilen soru: ${voided.map((id) => MARKETS[id].label).join(', ')}`}
        </p>
      )}
      {state === 'waiting' && <ResultForm m={m} />}
      {state === 'open' && <p className="text-xs leading-relaxed text-muted-foreground">Sonuç, maç başladıktan sonra &quot;Sonuç bekleyen&quot; sekmesinden girilir.</p>}

      <StatusLine status={status} />
      <PickList cacheKey={`league-picks-${m.id}-${m.settled ? 'done' : m.picks}`} load={() => loadLeaguePicks(m.id)} count={m.picks} pickLabel="Cevapları" />
    </li>
  )
}

export function MatchList({ matches, options, boards }: { matches: LeagueMatch[]; options: PrizeOptions; boards: Board[] }) {
  const [now] = useState(() => Date.now())
  const [chosen, setChosen] = useState<AdminState | null>(null)
  // 'all', the general league (0) or one special league.
  const [league, setLeague] = useState<'all' | number>('all')
  const used = boards.filter((b) => matches.some((m) => m.boardId === b.id))
  const only = league === 'all' || league === 0 || used.some((b) => b.id === league) ? league : 'all'
  const groups: Record<AdminState, LeagueMatch[]> = { waiting: [], open: [], done: [] }
  for (const m of matches) if (only === 'all' || (m.boardId ?? 0) === only) groups[adminState(m, now)].push(m)
  groups.done.sort((a, b) => b.kickoff.localeCompare(a.kickoff))
  const tab = chosen ?? (groups.waiting.length ? 'waiting' : groups.open.length ? 'open' : 'done')

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="tablist" aria-label="Maç durumu" className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={tab === s.id}
            onClick={() => setChosen(s.id)}
            className={cn('h-9 rounded-md px-3 text-xs font-bold', tab === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {s.label} ({groups[s.id].length})
          </button>
        ))}
      </div>
      {used.length > 0 && (
        <div role="group" aria-label="Lig" className="flex flex-wrap gap-1.5">
          {(['all', 0, ...used.map((b) => b.id)] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={only === id}
              onClick={() => setLeague(id)}
              className={cn(
                'min-h-9 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                only === id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {id === 'all' ? 'Bütün ligler' : id === 0 ? 'Genel lig' : used.find((b) => b.id === id)?.name}
            </button>
          ))}
        </div>
      )}
      {groups[tab].length ? (
        <ul className="flex flex-col gap-2">
          {groups[tab].map((m) => (
            <MatchAdminRow key={m.id} m={m} state={tab} options={options} boards={boards} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm leading-relaxed text-muted-foreground">{STATES.find((s) => s.id === tab)?.empty}</p>
      )}
    </div>
  )
}
