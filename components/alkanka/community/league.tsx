'use client'

import { useState } from 'react'
import { Clock, Crown, Lock, Minus, Plus } from 'lucide-react'
import { savePickAction } from '@/app/actions/community'
import type { LeagueMatch, LeagueRow } from '@/lib/community'
import { cn } from '@/lib/utils'
import { TeamLogo } from '../logo-context'
import { usePoints } from '../points-context'
import { StatusLine, useAction } from './use-action'
import { MemberRank } from '../kp/member-rank'

function Stepper({ value, onChange, label, disabled }: { value: number; onChange: (n: number) => void; label: string; disabled: boolean }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} aria-label={`${label} azalt`} className="flex size-9 items-center justify-center rounded-md bg-background text-muted-foreground disabled:opacity-30">
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="w-7 text-center font-display text-2xl font-bold tabular-nums text-foreground" aria-live="polite">{value}</span>
      <button type="button" disabled={disabled || value >= 20} onClick={() => onChange(value + 1)} aria-label={`${label} artır`} className="flex size-9 items-center justify-center rounded-md bg-background text-muted-foreground disabled:opacity-30">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function Crest({ name, src }: { name: string; src: string | null }) {
  if (!src) return <TeamLogo name={name} />
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary p-1.5 sm:size-12 sm:p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name} logosu`} width={32} height={32} loading="lazy" className="size-7 object-contain sm:size-8" />
    </span>
  )
}

type MatchState = 'open' | 'locked' | 'settled'

function matchState(m: LeagueMatch, now: number): MatchState {
  if (m.settled) return 'settled'
  return new Date(m.kickoff).getTime() <= now ? 'locked' : 'open'
}

function Team({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <Crest name={name} src={logo} />
      <span className="w-full truncate text-sm font-bold text-foreground">{name}</span>
    </div>
  )
}

function MatchCard({ m, state }: { m: LeagueMatch; state: MatchState }) {
  const { requireLogin } = usePoints()
  const { pending, status, run } = useAction()
  const [home, setHome] = useState(m.myPick?.home ?? 0)
  const [away, setAway] = useState(m.myPick?.away ?? 0)
  const kickoff = new Date(m.kickoff).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const changed = !m.myPick || m.myPick.home !== home || m.myPick.away !== away

  const center =
    state === 'settled' ? (
      <span className="flex flex-col items-center gap-0.5">
        <span className="font-display text-2xl font-bold tabular-nums text-foreground">{m.homeGoals}-{m.awayGoals}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sonuç</span>
      </span>
    ) : state === 'locked' ? (
      <span className="flex flex-col items-center gap-0.5">
        <span className={cn('font-display text-2xl font-bold tabular-nums', m.myPick ? 'text-primary' : 'text-muted-foreground')}>
          {m.myPick ? `${m.myPick.home}-${m.myPick.away}` : '–'}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.myPick ? 'Tahminin' : 'Tahmin yok'}</span>
      </span>
    ) : (
      <span className="rounded bg-background px-2 py-1 font-display text-xs font-bold text-muted-foreground">VS</span>
    )

  return (
    <article className={cn('flex flex-col gap-3 rounded-xl p-4', state === 'open' ? 'panel-gold' : 'border border-border bg-card')}>
      <header className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-semibold uppercase tracking-wider text-primary">{m.league}</span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          {state === 'locked' && <Lock className="size-3" aria-label="Kilitli" />}
          {state === 'settled' ? 'Bitti' : kickoff}
        </span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Team name={m.home} logo={m.homeLogo} />
        {center}
        <Team name={m.away} logo={m.awayLogo} />
      </div>

      {state === 'open' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex justify-center">
              <Stepper value={home} onChange={setHome} label={`${m.home} golü`} disabled={pending} />
            </div>
            <div className="flex justify-center">
              <Stepper value={away} onChange={setAway} label={`${m.away} golü`} disabled={pending} />
            </div>
          </div>
          <button
            disabled={pending || !changed}
            onClick={() => requireLogin() && run(() => savePickAction(m.id, home, away))}
            className="h-11 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-primary/15 disabled:text-primary"
          >
            {pending ? 'Kaydediliyor...' : m.myPick && !changed ? 'Tahmin kayıtlı' : m.myPick ? 'Tahmini güncelle' : 'Tahmini kaydet'}
          </button>
          <span className="text-center text-xs text-muted-foreground">{m.picks} kişi tahmin yaptı</span>
        </>
      )}

      {state === 'settled' && (
        <p className="rounded-lg bg-background px-3 py-2 text-center text-xs text-muted-foreground">
          {m.myPick ? (
            <>
              Tahminin {m.myPick.home}-{m.myPick.away} ·{' '}
              <b className={m.myPick.points ? 'text-primary' : 'text-foreground'}>
                {m.myPick.points === 3 ? 'Tam skor! +3 puan' : m.myPick.points === 1 ? 'Doğru taraf +1 puan' : '0 puan'}
              </b>
            </>
          ) : (
            'Bu maça tahmin yapmadın.'
          )}
        </p>
      )}
      <StatusLine status={status} />
    </article>
  )
}

function MatchSection({ id, title, hint, items, state }: { id: string; title: string; hint?: string; items: LeagueMatch[]; state: MatchState }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="font-display text-lg font-bold text-foreground">
          {title} <span className="text-sm font-semibold text-muted-foreground">({items.length})</span>
        </h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((m) => <MatchCard key={m.id} m={m} state={state} />)}
      </div>
    </section>
  )
}

export function League({
  matches,
  week,
  all,
  exactReward,
  outcomeReward,
  meId,
}: {
  matches: LeagueMatch[]
  week: LeagueRow[]
  all: LeagueRow[]
  exactReward: number
  outcomeReward: number
  meId: string | null
}) {
  const [scope, setScope] = useState<'week' | 'all'>('week')
  const [now] = useState(() => Date.now())
  const table = scope === 'week' ? week : all
  const open = matches.filter((m) => matchState(m, now) === 'open')
  const locked = matches.filter((m) => matchState(m, now) === 'locked')
  const done = matches.filter((m) => m.settled)
  const myIndex = meId ? week.findIndex((r) => r.userId === meId) : -1
  const myRow = myIndex >= 0 ? week[myIndex] : null
  const myPicks = matches.filter((m) => m.myPick).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        <dl className="grid grid-cols-3 divide-x divide-border">
          {[
            ['Bu hafta puanın', String(myRow?.points ?? 0)],
            ['Sıran', myRow ? `#${myIndex + 1}` : '–'],
            ['Tahminlerin', `${myPicks}/${matches.length}`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 p-3 text-center">
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          <span>Tam skor <b className="text-primary">+{exactReward} KC</b></span>
          <span aria-hidden>·</span>
          <span>Doğru taraf <b className="text-primary">+{outcomeReward} KC</b></span>
          <span aria-hidden>·</span>
          <span>Maç başında kapanır</span>
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {open.length > 0 ? (
            <MatchSection id="acik-maclar" title="Tahmine açık" items={open} state="open" />
          ) : (
            <section aria-labelledby="acik-maclar" className="flex flex-col gap-3">
              <h2 id="acik-maclar" className="font-display text-lg font-bold text-foreground">Tahmine açık</h2>
              <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden />
                Yeni maçlar yakında eklenecek.
              </p>
            </section>
          )}
          {locked.length > 0 && <MatchSection id="kilitli" title="Sonuç bekleniyor" hint="Tahminler kilitlendi" items={locked} state="locked" />}
          {done.length > 0 && <MatchSection id="biten" title="Sonuçlanan" items={done} state="settled" />}
        </div>

        <aside aria-labelledby="lig-tablosu" className="panel-gold flex flex-col gap-3 self-start rounded-xl p-4 xl:sticky xl:top-20">
          <h2 id="lig-tablosu" className="font-display text-lg font-bold text-foreground">Lig tablosu</h2>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
            {(['week', 'all'] as const).map((s) => (
              <button key={s} role="tab" aria-selected={scope === s} onClick={() => setScope(s)} className={cn('h-9 rounded-md text-xs font-bold', scope === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                {s === 'week' ? 'Bu hafta' : 'Tüm zamanlar'}
              </button>
            ))}
          </div>
          {table.length ? (
            <ol className="flex flex-col">
              {table.map((r, i) => (
                <li key={r.userId} className={cn('flex items-center gap-3 border-b border-border py-2 text-sm last:border-0', r.userId === meId && 'font-bold')}>
                  <span className="w-5 text-center font-display font-bold tabular-nums text-muted-foreground">{i === 0 ? <Crown className="size-4 text-primary" aria-label="Lider" /> : i + 1}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-foreground">{r.name.split(' ')[0]}</span>
                    <MemberRank userId={r.userId} />
                  </span>
                  <span className="text-xs text-muted-foreground">{r.exact} tam</span>
                  <span className="w-10 text-right font-display font-bold tabular-nums text-primary">{r.points}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">İlk maçlar sonuçlanınca tablo burada oluşur. Tam skor bilen zirveye oturur.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
