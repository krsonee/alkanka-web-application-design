'use client'

import { useState } from 'react'
import { Crown, Lock, Minus, Plus } from 'lucide-react'
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
      <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} aria-label={`${label} azalt`} className="flex size-8 items-center justify-center rounded-md bg-background text-muted-foreground disabled:opacity-30">
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="w-8 text-center font-display text-2xl font-bold tabular-nums text-foreground" aria-live="polite">{value}</span>
      <button type="button" disabled={disabled || value >= 20} onClick={() => onChange(value + 1)} aria-label={`${label} artır`} className="flex size-8 items-center justify-center rounded-md bg-background text-muted-foreground disabled:opacity-30">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function Crest({ name, src }: { name: string; src: string | null }) {
  if (!src) return <TeamLogo name={name} />
  return (
    <span className="flex size-12 items-center justify-center rounded-full bg-secondary p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name} logosu`} width={32} height={32} loading="lazy" className="size-8 object-contain" />
    </span>
  )
}

function MatchCard({ m, now }: { m: LeagueMatch; now: number }) {
  const { requireLogin } = usePoints()
  const { pending, status, run } = useAction()
  const [home, setHome] = useState(m.myPick?.home ?? 0)
  const [away, setAway] = useState(m.myPick?.away ?? 0)
  const closed = m.settled || new Date(m.kickoff).getTime() <= now
  const kickoff = new Date(m.kickoff).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const changed = !m.myPick || m.myPick.home !== home || m.myPick.away !== away

  return (
    <article className="panel-gold flex flex-col gap-4 rounded-xl p-4">
      <header className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-primary">{m.league}</span>
        <span className="text-muted-foreground">{m.settled ? 'Bitti' : kickoff} · {m.picks} tahmin</span>
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <Crest name={m.home} src={m.homeLogo} />
          <span className="w-full truncate text-sm font-bold text-foreground">{m.home}</span>
          {!m.settled && <Stepper value={home} onChange={setHome} label={`${m.home} golü`} disabled={closed} />}
        </div>
        <span className="rounded bg-background px-2 py-1 font-display text-sm font-bold text-muted-foreground tabular-nums">
          {m.settled ? `${m.homeGoals} - ${m.awayGoals}` : 'VS'}
        </span>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <Crest name={m.away} src={m.awayLogo} />
          <span className="w-full truncate text-sm font-bold text-foreground">{m.away}</span>
          {!m.settled && <Stepper value={away} onChange={setAway} label={`${m.away} golü`} disabled={closed} />}
        </div>
      </div>
      {m.settled ? (
        <p className="rounded-lg bg-background p-2.5 text-center text-sm text-muted-foreground">
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
      ) : closed ? (
        <p className="flex items-center justify-center gap-1.5 rounded-lg bg-background p-2.5 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden />
          {m.myPick ? `Tahminin kilitlendi: ${m.myPick.home}-${m.myPick.away}` : 'Tahminler kapandı'}
        </p>
      ) : (
        <button
          disabled={pending || !changed}
          onClick={() => requireLogin() && run(() => savePickAction(m.id, home, away))}
          className="h-10 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-primary/15 disabled:text-primary"
        >
          {pending ? 'Kaydediliyor...' : m.myPick && !changed ? 'Tahmin kayıtlı' : m.myPick ? 'Tahmini güncelle' : 'Tahmini kaydet'}
        </button>
      )}
      <StatusLine status={status} />
    </article>
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
  const open = matches.filter((m) => !m.settled)
  const done = matches.filter((m) => m.settled)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Tam skor', `3 puan + ${exactReward} KC`],
          ['Doğru taraf', `1 puan + ${outcomeReward} KC`],
          ['Kapanış', 'Maç başlama saatinde'],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="font-display text-base font-bold text-foreground">{v}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="acik-maclar" className="flex flex-col gap-3">
            <h2 id="acik-maclar" className="font-display text-lg font-bold text-foreground">Tahmine açık maçlar</h2>
            {open.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {open.map((m) => <MatchCard key={m.id} m={m} now={now} />)}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Yeni maçlar yakında eklenecek.</p>
            )}
          </section>
          {done.length > 0 && (
            <section aria-labelledby="biten" className="flex flex-col gap-3">
              <h2 id="biten" className="font-display text-lg font-bold text-foreground">Sonuçlanan maçlar</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {done.map((m) => <MatchCard key={m.id} m={m} now={now} />)}
              </div>
            </section>
          )}
        </div>

        <aside aria-labelledby="lig-tablosu" className="panel-gold flex flex-col gap-3 self-start rounded-xl p-4 xl:sticky xl:top-20">
          <h2 id="lig-tablosu" className="font-display text-lg font-bold text-foreground">Lig tablosu</h2>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
            {(['week', 'all'] as const).map((s) => (
              <button key={s} role="tab" aria-selected={scope === s} onClick={() => setScope(s)} className={cn('h-8 rounded-md text-xs font-bold', scope === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
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
            <p className="text-sm text-muted-foreground">Sonuçlanan maç olunca tablo oluşur.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
