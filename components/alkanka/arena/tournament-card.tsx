'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useId, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META } from '@/lib/arena'
import { effectivePrizes } from '@/lib/tournament-prizes'
import { STATUS_LABEL, matchHref, type Tournament, type TournamentStatus } from '@/lib/tournaments-shared'
import { enterTournament, exitTournament } from '@/app/actions/arena'
import { formatAC, usePoints } from '../points-context'
import { Countdown, spanText, useSecondsLeft } from './tournament-countdown'
import { TournamentDetails, type TournamentView } from './tournament-details'
import { formatDayTR, formatLine, formatPitch, formatShortTR, runningLine } from './tournament-text'

export { formatTR } from './tournament-text'

const STATUS_TONE: Record<TournamentStatus, string> = {
  kayit: 'text-primary',
  basladi: 'text-live',
  bitti: 'text-muted-foreground',
  iptal: 'text-muted-foreground',
}

function StatusPill({ status, className }: { status: TournamentStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur',
        STATUS_TONE[status],
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full bg-current', status === 'basladi' && 'motion-safe:animate-pulse')} />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** One figure of the card. Every tile carries a second line, so the four of them stay the same height. */
function Stat({ label, note, children }: { label: string; note: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-card px-3 py-2.5 @4xl:px-4 @4xl:py-3">
      <dt className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-display text-base font-bold text-foreground @4xl:text-lg">{children}</span>
        <span className="flex h-4 min-w-0 items-center truncate text-xs text-muted-foreground">{note}</span>
      </dd>
    </div>
  )
}

const primaryAction =
  'flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-50 @2xl:flex-none'

/**
 * One tournament on the list. A tournament that can still be joined or is being played is a full
 * card: what it is, how it is played, the four figures that matter and the one thing the viewer can
 * do about it. A finished one is a single quiet line. Everything else opens underneath.
 * `defaultOpen` is for a page with a single tournament to show; a card the viewer has a match
 * waiting in opens by itself.
 *
 * The card is laid out by its own width, not the window's: with the chat rail open the page column
 * is far narrower than the screen.
 */
export function TournamentCard({ t, onChanged, defaultOpen = false }: { t: Tournament; onChanged?: () => void; defaultOpen?: boolean }) {
  const meta = ARENA_META[t.game]
  const { points, member, refresh, requireLogin, matches } = usePoints()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<boolean | null>(null)
  const panelId = useId()
  const myId = member?.id ?? null
  const joined = myId != null && t.entries.some((e) => e.userId === myId)
  const myMatch = myId ? t.liveMatches.find((m) => m.status === 'oynaniyor' && m.players.includes(myId)) : undefined
  const joinLeft = useSecondsLeft(myMatch ? matches.find((m) => m.tableId === myMatch.tableId)?.joinBy : null)
  const open = picked ?? (defaultOpen || Boolean(myMatch))
  const full = t.entries.length >= t.maxPlayers
  const canAfford = points >= t.entryFee
  const fill = Math.min(100, Math.round((t.entries.length / t.maxPlayers) * 100))
  const canJoin = member == null || (!full && canAfford)
  const joinLabel = !member
    ? 'Giriş yap ve katıl'
    : full
      ? 'Kontenjan doldu'
      : !canAfford
        ? `Bakiye yetersiz (${formatAC(t.entryFee)} KC)`
        : t.entryFee
          ? `${formatAC(t.entryFee)} KC ile katıl`
          : 'Ücretsiz katıl'

  const toggleEntry = () => {
    if (!requireLogin()) return
    setError(null)
    startTransition(async () => {
      const r = joined ? await exitTournament(t.id) : await enterTournament(t.id)
      if (!r.ok) setError(r.error ?? 'İşlem başarısız.')
      refresh()
      router.refresh()
      onChanged?.()
    })
  }

  const active = t.status === 'kayit' || t.status === 'basladi'
  const when =
    t.status === 'kayit'
      ? { label: 'Başlangıç', at: t.startsAt, tail: 'sonra', due: 'başlamak üzere' }
      : t.nextRoundAt
        ? { label: 'Sıradaki tur', at: t.nextRoundAt, tail: 'sonra', due: 'açılmak üzere' }
        : t.endsAt
          ? { label: t.format === 'puan' ? 'Bitiş' : 'En geç bitiş', at: t.endsAt, tail: 'kaldı', due: 'bitmek üzere' }
          : { label: 'Başladı', at: t.startsAt, tail: '', due: '' }
  // Half a minute is fine for "2 gün 4 sa sonra"; the match countdown above keeps its own second-by-second clock.
  const left = useSecondsLeft(active && when.tail ? when.at : null, 30_000)

  const place = t.format === 'puan' && myId && t.points ? t.points.findIndex((p) => p.key === myId) : -1
  const lead =
    t.status === 'basladi'
      ? place >= 0 && t.points![place].played > 0
        ? `Sıran ${place + 1}. · ${t.points![place].points} puan`
        : runningLine(t)
      : formatPitch(t, meta.title)
  const paidPlaces = effectivePrizes(t).filter((amount) => amount > 0).length

  const view: TournamentView = { myId, joined, myMatch, joinLeft, pending, error, canJoin, joinLabel, toggleEntry }

  const toggle = (
    <button
      type="button"
      onClick={() => setPicked(!open)}
      aria-expanded={open}
      aria-controls={panelId}
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary [&:only-child]:flex-1 @2xl:[&:only-child]:flex-none"
    >
      {active ? 'Detaylar' : 'Sonuçlar'}
      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      <span className="sr-only">: {t.title}</span>
    </button>
  )

  const below = (
    <>
      {error && !open && (
        <p className="border-t border-border px-4 py-2.5 text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
      {open && <TournamentDetails t={t} id={panelId} view={view} />}
    </>
  )

  if (!active) {
    return (
      <article className="@container overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-3 @2xl:flex-nowrap @2xl:p-4">
          <div className="flex min-w-0 basis-full items-center gap-3 @2xl:flex-1 @2xl:basis-0">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
              <Image src={meta.image || '/placeholder.svg'} alt="" fill sizes="48px" className="object-cover object-[center_35%]" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {meta.title} · {formatLine(t)}
              </p>
              <h3 className="truncate font-display text-base font-bold uppercase leading-tight text-foreground @2xl:text-lg">{t.title}</h3>
              {t.status === 'iptal' ? (
                <p className="truncate text-sm text-muted-foreground">İptal edildi</p>
              ) : t.winner ? (
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Crown className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">Şampiyon: {t.winner}</span>
                </p>
              ) : (
                <p className="truncate text-sm text-muted-foreground">Şampiyon çıkmadı</p>
              )}
            </div>
          </div>
          <dl className="flex flex-1 items-center gap-5 whitespace-nowrap @2xl:flex-none @2xl:gap-6">
            <div className="flex flex-col">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ödül</dt>
              <dd className="font-display text-sm font-bold text-foreground">{formatAC(t.prizePool)} KC</dd>
            </div>
            <div className="hidden flex-col @md:flex">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oyuncu</dt>
              <dd className="font-display text-sm font-bold tabular-nums text-foreground">{t.entries.length}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.status === 'iptal' ? 'Tarih' : 'Bitti'}</dt>
              <dd className="font-display text-sm font-bold text-foreground">{formatDayTR(t.finishedAt ?? t.endsAt ?? t.startsAt)}</dd>
            </div>
          </dl>
          {toggle}
        </div>
        {below}
      </article>
    )
  }

  return (
    <article className={cn('@container overflow-hidden rounded-2xl border bg-card', myMatch ? 'border-primary' : joined ? 'border-primary/50' : 'border-border')}>
      <div className="flex flex-col @3xl:flex-row">
        <div className="relative h-28 shrink-0 bg-secondary @3xl:h-auto @3xl:w-48">
          <Image src={meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 192px, 100vw" className="object-cover object-[center_30%]" />
          <StatusPill status={t.status} className="absolute left-3 top-3" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 @3xl:p-5">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {meta.title} · {formatLine(t)}
            </p>
            <h3 className="font-display text-xl font-bold uppercase leading-tight text-foreground text-balance @2xl:text-2xl">{t.title}</h3>
            <p className={cn('text-sm leading-relaxed text-pretty', t.status === 'basladi' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{lead}</p>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border @2xl:grid-cols-4">
            <Stat label="Ödül havuzu" note={paidPlaces > 1 ? `${paidPlaces} sıraya dağıtılır` : 'tamamı şampiyona'}>
              <span className="text-primary">{formatAC(t.prizePool)} KC</span>
            </Stat>
            <Stat label="Katılım" note={t.entryFee ? 'kayıtta bir kez kesilir' : 'ücret kesilmez'}>
              {t.entryFee ? `${formatAC(t.entryFee)} KC` : 'Ücretsiz'}
            </Stat>
            <Stat label={when.label} note={left == null ? '' : left > 60 ? `${spanText(left)} ${when.tail}` : when.due}>
              {formatShortTR(when.at)}
            </Stat>
            <Stat
              label="Oyuncu"
              note={
                t.status === 'kayit' ? (
                  <span className="block h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-label="Kontenjan doluluğu">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${fill}%` }} />
                  </span>
                ) : (
                  'kayıtlı oyuncu'
                )
              }
            >
              <span className="tabular-nums">
                {t.entries.length} / {t.maxPlayers}
              </span>
            </Stat>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            {t.status === 'kayit' &&
              (joined ? (
                <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-sm font-bold text-foreground @2xl:flex-none">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  Kayıtlısın
                </span>
              ) : (
                <button type="button" onClick={toggleEntry} disabled={pending || !canJoin} className={primaryAction}>
                  {pending ? 'İşleniyor...' : joinLabel}
                </button>
              ))}
            {t.status === 'basladi' && myMatch && (
              <Link href={matchHref({ game: t.game, tableId: myMatch.tableId })} className={primaryAction}>
                Masaya gir
                {joinLeft != null && joinLeft > 0 && <Countdown seconds={joinLeft} label="Masaya girmek için kalan süre" className="font-mono font-bold tabular-nums" />}
              </Link>
            )}
            {t.status === 'basladi' && !myMatch && t.format === 'puan' && joined && (
              <Link href={`/oyunlar/${t.game}`} className={primaryAction}>
                {meta.title} oyna, puan topla
              </Link>
            )}
            {toggle}
          </div>
        </div>
      </div>
      {below}
    </article>
  )
}
