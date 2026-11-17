'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import useSWR from 'swr'
import { Coins, Users } from 'lucide-react'
import { getEventBoard, getEventOverview, joinEventAction } from '@/app/actions/events'
import { RANK_SHORT, SCORE_UNIT, eventGameLabel, eventPhase, payoutRows, type EventBoard } from '@/lib/event-rules'
import { getPredictionState } from '@/app/actions/wallet'
import { predictionClosesAt } from '@/lib/catalog-shared'
import { cn } from '@/lib/utils'

const trDate = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
})
const formatTrDate = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? trDate.format(t) : ''
}
import type { EventItem } from './data'
import { useTelegramUrl } from './telegram-address'
import { useCatalog } from './catalog-context'
import { DetailButton, DetailModal } from './detail-modal'
import { JakoTip } from './jako'
import { Marquee } from './home/marquee'
import { TeamLogo } from './logo-context'
import { formatAC, usePoints } from './points-context'
import { SectionHeading } from './section-heading'
import { useTexts } from './texts-context'

function useNow(everyMs = 1000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

/** The event's real dates: a countdown to the start or the end, and what happened once it is over. */
function EventClock({ event, settled }: { event: EventItem; settled: boolean }) {
  const now = useNow()
  const range = [event.startsAt, event.endsAt].map((d) => (d ? formatTrDate(d) : '')).filter(Boolean).join(' - ')
  // Until the clock starts on the client a dated event counts as running, so the server and the first paint agree.
  const phase = now === null ? (event.endsAt ? 'live' : 'undated') : eventPhase(event, now)
  const target = phase === 'upcoming' ? Date.parse(event.startsAt ?? '') : Date.parse(event.endsAt ?? '')
  const total = now && Number.isFinite(target) ? Math.max(0, Math.floor((target - now) / 1000)) : null
  const parts =
    total === null
      ? null
      : [
          { v: Math.floor(total / 86400), l: 'Gün' },
          { v: Math.floor((total % 86400) / 3600), l: 'Saat' },
          { v: Math.floor((total % 3600) / 60), l: 'Dk' },
          { v: Math.floor(total % 60), l: 'Sn' },
        ]
  const over = settled || phase === 'ended'
  return (
    <div className="flex flex-col gap-1.5">
      {over || phase === 'undated' ? (
        <p className="flex min-h-12 items-center justify-center rounded-md bg-background px-3 text-center text-xs font-semibold text-muted-foreground">
          {settled ? 'Sonuçlandı, ödüller dağıtıldı' : phase === 'ended' ? 'Sona erdi' : 'Bitiş tarihi duyurulacak'}
        </p>
      ) : (
        <div className="grid min-h-12 grid-cols-4 gap-1.5" role="timer" aria-label={phase === 'upcoming' ? 'Başlamasına kalan süre' : 'Bitmesine kalan süre'}>
          {(parts ?? [{ l: 'Gün' }, { l: 'Saat' }, { l: 'Dk' }, { l: 'Sn' }]).map((p) => (
            <div key={p.l} className="flex flex-col items-center rounded-md bg-background py-1.5">
              <span className="font-display text-base font-bold text-foreground tabular-nums">{'v' in p ? String(p.v).padStart(2, '0') : '--'}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.l}</span>
            </div>
          ))}
        </div>
      )}
      {range && (
        <p className="text-center text-xs text-muted-foreground">
          {phase === 'upcoming' && !over ? 'Başlıyor: ' : ''}
          {range}
        </p>
      )}
    </div>
  )
}

function boardTable(board: EventBoard) {
  const unit = SCORE_UNIT[board.rank]
  const rows = board.top.map((r) => ({
    label: `${r.place}. ${r.name}${r.me ? ' (sen)' : ''}`,
    sub: r.prize > 0 ? `${board.settled ? 'Ödül' : 'Bu sırada kalırsa'}: ${formatAC(r.prize)} KC` : undefined,
    value: unit ? `${formatAC(r.score)} ${unit}` : board.settled ? 'Kazandı' : '',
  }))
  if (board.me && !board.top.some((r) => r.me)) {
    rows.push({
      label: `${board.me.place}. Sen`,
      sub: board.me.prize > 0 ? `${board.settled ? 'Ödül' : 'Bu sırada kalırsa'}: ${formatAC(board.me.prize)} KC` : undefined,
      value: unit ? `${formatAC(board.me.score)} ${unit}` : '',
    })
  }
  const title = board.settled ? (board.rank === 'draw' ? 'Çekiliş sonucu' : 'Final sıralaması') : 'Güncel sıralama'
  return rows.length ? { title, rows } : undefined
}

function EventCards() {
  const { events: EVENTS } = useCatalog()
  const { member, requireLogin, setBalance } = usePoints()
  const t = useTexts()
  // The cards only need to know which side of a date they are on; each clock ticks on its own.
  const now = useNow(20_000)
  const { data: overview, mutate } = useSWR(['event-overview', member?.id ?? ''], () => getEventOverview(), { revalidateOnFocus: false })
  const joined: Record<string, boolean> = Object.fromEntries((overview?.joined ?? []).map((id) => [id, true]))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<EventItem | null>(null)
  const { data: board } = useSWR(detail && (detail.rank ?? 'none') !== 'none' ? ['event-board', detail.id, member?.id ?? ''] : null, () => (detail ? getEventBoard(detail.id) : null), {
    revalidateOnFocus: false,
  })

  const isSettled = (e: EventItem) => Boolean(overview?.settled.includes(e.id))
  const count = (e: EventItem) => e.participants + (overview?.counts[e.id] ?? (joined[e.id] ? 1 : 0))
  /** Why the join button is off, or null when the event can be joined right now. */
  const closed = (e: EventItem) => {
    if (joined[e.id]) return 'Katıldın'
    if (isSettled(e)) return 'Sonuçlandı'
    const phase = now ? eventPhase(e, now) : 'live'
    return phase === 'ended' ? 'Sona erdi' : phase === 'upcoming' ? 'Yakında başlıyor' : null
  }

  async function join(e: EventItem) {
    if (closed(e) || busy || !requireLogin()) return
    setBusy(e.id)
    setError(null)
    const r = await joinEventAction(e.id)
    setBusy(null)
    if (r.ok) {
      setBalance(r.balance)
      await mutate()
    } else {
      setError(r.error)
      await mutate()
    }
  }

  const card = (e: EventItem) => (
        <article key={e.id} className="panel-gold flex h-full flex-col overflow-hidden rounded-xl">
          <div className="relative h-28 overflow-hidden">
            <Image src={e.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 768px) 30vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            <span className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              {e.kind}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
            <div className="flex flex-col">
              <h3 className="font-display text-lg font-bold text-foreground">{t(`event.${e.id}.title`, e.title)}</h3>
              <p className="text-sm text-muted-foreground">{t(`event.${e.id}.subtitle`, e.subtitle)}</p>
            </div>
            <EventClock event={e} settled={isSettled(e)} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" />
                {formatAC(count(e))} katılımcı
              </span>
              <span className="text-primary">{t(`event.${e.id}.prize`, e.prize)}</span>
            </div>
            <div className="mt-auto flex items-stretch gap-2">
            <DetailButton onClick={() => setDetail(e)} label={(e.rank ?? 'none') === 'none' ? undefined : 'Sıralama & kurallar'} />
            <button
              type="button"
              onClick={() => join(e)}
              disabled={Boolean(closed(e)) || busy === e.id}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-primary/15 disabled:text-primary"
            >
              {closed(e) ?? (e.entry === 0 ? 'Ücretsiz katıl' : (
                <>
                  <Coins className="size-3.5" aria-hidden="true" />
                  {e.entry} KC ile katıl
                </>
              ))}
            </button>
            </div>
          </div>
        </article>
  )

  return (
    <>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <div className="-mx-4 md:hidden">
        <Marquee label="Etkinlikler" itemClassName="w-[64vw] max-w-[17.5rem]" duration={EVENTS.length * 16}>
          {EVENTS.map(card)}
        </Marquee>
      </div>
      <ul aria-label="Etkinlikler" className="hidden gap-3 md:grid md:grid-cols-3">
        {EVENTS.map((e) => (
          <li key={e.id}>{card(e)}</li>
        ))}
      </ul>
      <DetailModal
        onClose={() => setDetail(null)}
        content={
          detail && {
            eyebrow: `${detail.kind} etkinlik`,
            title: t(`event.${detail.id}.title`, detail.title),
            image: detail.image,
            description: detail.description,
            facts: [
              { label: 'Katılım', value: detail.entry === 0 ? 'Ücretsiz' : `${detail.entry} KC` },
              { label: 'Katılımcı', value: formatAC(count(detail)) },
              ...(detail.startsAt ? [{ label: 'Başlangıç', value: formatTrDate(detail.startsAt) }] : []),
              ...(detail.endsAt ? [{ label: 'Bitiş', value: formatTrDate(detail.endsAt) }] : []),
              ...((detail.rank ?? 'none') === 'none'
                ? []
                : [{ label: 'Sıralama', value: detail.rank === 'draw' ? RANK_SHORT.draw : `${RANK_SHORT[detail.rank ?? 'none']} · ${eventGameLabel(detail.game ?? '')}` }]),
            ],
            steps: detail.steps,
            table: board ? boardTable(board) : undefined,
            prizes: detail.payouts?.length ? payoutRows(detail.payouts) : detail.prizes,
            rules: detail.rules,
            note:
              (detail.rank ?? 'none') === 'none'
                ? undefined
                : board?.settled
                  ? 'Ödüller kazananların hesabına eklendi.'
                  : detail.rank === 'draw'
                    ? 'Kazananlar bitiş tarihinde katılanlar arasından rastgele çekilir ve ödüller hesaplara kendiliğinden eklenir.'
                    : 'Sadece etkinliğe katıldıktan sonra oynadıkların sayılır. Ödüller bitiş tarihinde hesaplara kendiliğinden eklenir.',
          }
        }
        action={
          detail && (
            <button
              type="button"
              onClick={() => join(detail)}
              disabled={Boolean(closed(detail)) || busy === detail.id}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-primary/15 disabled:text-primary"
            >
              {closed(detail) ?? (detail.entry === 0 ? 'Ücretsiz katıl' : `${detail.entry} KC ile katıl`)}
            </button>
          )
        }
      />
    </>
  )
}

function Predictions() {
  const { predictions: PREDICTIONS } = useCatalog()
  const { predict, requireLogin, member } = usePoints()
  const { data, mutate } = useSWR(['prediction-state', member?.id ?? ''], () => getPredictionState(), {
    revalidateOnFocus: false,
  })
  const [pending, setPending] = useState<Record<string, string>>({})
  const [now, setNow] = useState(() => Date.now())
  const picks = { ...(data?.mine ?? {}), ...pending }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  async function pick(matchId: string, optionId: string) {
    if (picks[matchId] || !requireLogin()) return
    setPending((p) => ({ ...p, [matchId]: optionId }))
    await predict(matchId, optionId)
    await mutate()
    setPending((p) => {
      const { [matchId]: _, ...rest } = p
      return rest
    })
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PREDICTIONS.map((m) => {
        const picked = picks[m.id]
        const closesAt = predictionClosesAt(m)
        const closed = closesAt !== null && now >= closesAt
        const realVotes = data?.votes[m.id] ?? {}
        const isPending = !!pending[m.id] && data?.mine[m.id] !== pending[m.id]
        const votesOf = (id: string) => m.options.find((o) => o.id === id)!.votes + (realVotes[id] ?? 0) + (isPending && picked === id ? 1 : 0)
        const total = Math.max(1, m.options.reduce((s, o) => s + votesOf(o.id), 0))
        const showResults = !!picked || closed
        return (
          <article key={m.id} className="panel-gold flex flex-col gap-4 rounded-xl p-4">
            <header className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-primary">{m.league}</span>
              <span className="text-muted-foreground">{m.kickoffAt ? formatTrDate(m.kickoffAt) : m.kickoff}</span>
            </header>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-bold text-foreground">
                <TeamLogo name={m.home} />
                <span className="truncate">{m.home}</span>
              </span>
              <span className="rounded bg-background px-2 py-1 text-xs font-bold text-muted-foreground">VS</span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right font-display text-base font-bold text-foreground">
                <span className="truncate">{m.away}</span>
                <TeamLogo name={m.away} />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={`${m.home} - ${m.away} tahmini`}>
              {m.options.map((o) => {
                const pct = Math.round((votesOf(o.id) / total) * 100)
                const isPicked = picked === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(m.id, o.id)}
                    disabled={!!picked || closed}
                    aria-pressed={isPicked}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 overflow-hidden rounded-lg border py-2.5 text-xs transition-colors',
                      isPicked ? 'border-primary text-primary' : 'border-border text-foreground',
                      !picked && !closed && 'hover:border-primary/50',
                      closed && !picked && 'opacity-70',
                    )}
                  >
                    {showResults && (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
                    )}
                    <span className="relative font-semibold">{o.label}</span>
                    {showResults && <span className="relative text-muted-foreground tabular-nums">%{pct}</span>}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {picked ? (
                <>
                  Tahminin kaydedildi. Doğru çıkarsa <span className="font-semibold text-primary">+{m.reward} KC</span>.
                </>
              ) : closed ? (
                <>Bu maç için tahminler kapandı.</>
              ) : (
                <>
                  Doğru tahmin: <span className="font-semibold text-primary">+{m.reward} KC</span>.
                  {closesAt !== null && <> Tahmin bitiş: <span className="font-semibold text-foreground">{formatTrDate(new Date(closesAt).toISOString())}</span>.</>}
                </>
              )}
            </p>
          </article>
        )
      })}
    </div>
  )
}

export function Events({ view }: { view: 'biletler' | 'tahminler' }) {
  const telegramUrl = useTelegramUrl()
  return (
    <section aria-label={view === 'biletler' ? 'Biletler' : 'Tahminler'} className="flex flex-col gap-5">
      {view === 'biletler' ? (
        <>
          <JakoTip pose="promo" title="Jako fısıldıyor">
            Özel oranlar ve promo kodlar önce Telegram&apos;a düşer, sonra biter kanka.{' '}
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary underline-offset-2 hover:underline"
            >
              Kanala katıl, kaçırma.
            </a>
          </JakoTip>
          <EventCards />
        </>
      ) : (
        <Predictions />
      )}
    </section>
  )
}
