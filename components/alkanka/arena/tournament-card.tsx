'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useId, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META } from '@/lib/arena'
import { STATUS_LABEL, matchHref, type Tournament } from '@/lib/tournaments-shared'
import { enterTournament, exitTournament } from '@/app/actions/arena'
import { formatAC, usePoints } from '../points-context'
import { Countdown, useSecondsLeft } from './tournament-countdown'
import { TournamentDetails, type TournamentView } from './tournament-details'
import { formatLine, formatShortTR, runningLine } from './tournament-text'

export { formatTR } from './tournament-text'

const STATUS_STYLE = {
  kayit: 'bg-primary text-primary-foreground',
  basladi: 'bg-destructive text-destructive-foreground',
  bitti: 'bg-secondary text-foreground',
  iptal: 'bg-muted text-muted-foreground',
} as const

function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-baseline gap-1.5 @2xl:flex-col @2xl:items-stretch @2xl:gap-0.5 @2xl:rounded-lg @2xl:bg-secondary @2xl:px-2.5 @2xl:py-1.5 @6xl:bg-transparent @6xl:p-0',
        className,
      )}
    >
      <dt className="shrink-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-bold text-foreground @6xl:text-[15px]">{children}</dd>
    </div>
  )
}

const primaryAction = 'flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-50 @2xl:flex-none'

/**
 * One tournament as a summary row: what it is, what it pays, when, how full, and the one thing the
 * viewer can do about it. Everything else opens underneath. `defaultOpen` is for a page with a single
 * tournament to show; a row the viewer has a match waiting in opens by itself.
 *
 * The row is laid out by its own width, not the window's: with the chat rail open the page column is
 * far narrower than the screen.
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

  const when =
    t.status === 'kayit'
      ? { label: 'Başlangıç', at: t.startsAt }
      : t.status === 'basladi'
        ? t.nextRoundAt
          ? { label: 'Sıradaki tur', at: t.nextRoundAt }
          : t.endsAt
            ? { label: t.format === 'puan' ? 'Bitiş' : 'En geç bitiş', at: t.endsAt }
            : { label: 'Başladı', at: t.startsAt }
        : { label: 'Bitti', at: t.finishedAt ?? t.endsAt ?? t.startsAt }

  const place = t.format === 'puan' && myId && t.points ? t.points.findIndex((p) => p.key === myId) : -1
  const subline =
    t.status === 'basladi'
      ? place >= 0 && t.points![place].played > 0
        ? `Sıran ${place + 1}. · ${t.points![place].points} puan`
        : runningLine(t)
      : t.status === 'kayit'
        ? t.description || 'Kayıtlar başlangıç saatinde kapanır.'
        : t.winner
          ? null
          : 'Şampiyon çıkmadı'

  const view: TournamentView = { myId, joined, myMatch, joinLeft, pending, error, canJoin, joinLabel, toggleEntry }

  return (
    <article className={cn('@container overflow-hidden rounded-2xl border bg-card', myMatch ? 'border-primary' : joined && t.status !== 'bitti' ? 'border-primary/50' : 'border-border')}>
      <div className="flex flex-wrap items-center gap-3 p-3 @2xl:p-4 @6xl:flex-nowrap @6xl:gap-6">
        <div className="flex min-w-0 basis-full items-center gap-3 @2xl:flex-1 @2xl:basis-0 @6xl:w-[22rem] @6xl:flex-none @7xl:w-[26rem]">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-secondary @2xl:size-16">
            <Image src={meta.image || '/placeholder.svg'} alt="" fill sizes="64px" className="object-cover object-[center_35%]" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', STATUS_STYLE[t.status])}>{STATUS_LABEL[t.status]}</span>
              <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-primary">
                {meta.title} · {formatLine(t)}
              </span>
            </div>
            <h3 className="truncate font-display text-lg font-bold uppercase leading-tight text-foreground @2xl:text-xl">{t.title}</h3>
            {subline ? (
              <p className="truncate text-xs leading-5 text-muted-foreground">{subline}</p>
            ) : (
              <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-5 text-foreground">
                <Crown className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">Şampiyon: {t.winner}</span>
              </p>
            )}
          </div>
        </div>

        <dl className="order-2 flex basis-full flex-wrap gap-x-4 gap-y-1 @2xl:order-3 @2xl:grid @2xl:grid-cols-4 @2xl:gap-2 @6xl:order-2 @6xl:flex-1 @6xl:basis-0 @6xl:gap-4">
          <Stat label="Ödül">
            <span className="text-primary">{formatAC(t.prizePool)} KC</span>
          </Stat>
          <Stat label="Katılım">{t.entryFee ? `${formatAC(t.entryFee)} KC` : 'Ücretsiz'}</Stat>
          <Stat label={when.label}>{formatShortTR(when.at)}</Stat>
          <Stat label="Oyuncu">
            <span className="flex items-center gap-2">
              <span className="tabular-nums">
                {t.entries.length} / {t.maxPlayers}
              </span>
              {t.status === 'kayit' && (
                <span className="hidden h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-background @2xl:block @6xl:bg-secondary" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-label="Kontenjan doluluğu">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${fill}%` }} />
                </span>
              )}
            </span>
          </Stat>
        </dl>

        <div className="order-3 flex basis-full items-center gap-2 @2xl:order-2 @2xl:basis-auto @6xl:order-3 @6xl:w-60 @6xl:flex-none @6xl:justify-end">
          {t.status === 'kayit' &&
            (joined ? (
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2.5 text-sm font-bold text-foreground @2xl:flex-none">
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
              Oyna, puan topla
            </Link>
          )}
          <button
            type="button"
            onClick={() => setPicked(!open)}
            aria-expanded={open}
            aria-controls={panelId}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-bold text-foreground hover:bg-secondary [&:only-child]:flex-1 @2xl:[&:only-child]:flex-none"
          >
            {t.status === 'bitti' ? 'Sonuçlar' : 'Detaylar'}
            <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
            <span className="sr-only">: {t.title}</span>
          </button>
        </div>
      </div>

      {error && !open && (
        <p className="border-t border-border px-4 py-2.5 text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
      {open && <TournamentDetails t={t} id={panelId} view={view} />}
    </article>
  )
}
