'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, ChevronDown, Coins, Crown, Gamepad2, Medal, ScrollText, Trophy, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META } from '@/lib/arena'
import { STATUS_LABEL, type Tournament } from '@/lib/tournaments-shared'
import { enterTournament, exitTournament } from '@/app/actions/arena'
import { formatAC, usePoints } from '../points-context'
import { BracketView } from './bracket-view'
import { LeagueView } from './league-view'

export function formatTR(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function formatShortTR(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function tournamentRules(t: Tournament, gameTitle: string) {
  const isLeague = t.format === 'lig'
  return [
    isLeague
      ? 'Lig usulü: herkes herkesle oynar. Galibiyet puan kazandırır, sezon sonunda en çok puanı toplayan şampiyon olur.'
      : 'Eleme usulü: kaybeden elenir, kazanan bir sonraki tura geçer. Final kazananı şampiyon olur.',
    `Kontenjan ${t.maxPlayers} oyuncu. Kayıtlar başlangıç saatine kadar açık, istediğin zaman kaydını iptal edebilirsin.`,
    'Başlangıç saatinde tüm kayıtlı oyuncular otomatik eşleşir. Maçın hazır olunca sayfada "oyuna gir" butonu çıkar.',
    `Maçlar ${gameTitle.toLowerCase()} masasında standart kurallarla oynanır. Sıranı uzun süre oynamazsan hükmen mağlup sayılırsın.`,
    t.entryFee
      ? `Katılım ${formatAC(t.entryFee)} KC; kayıt iptalinde iade edilir. Ödüller turnuva bitince Kanka Coin olarak hesabına yüklenir.`
      : 'Katılım ücretsiz. Ödüller turnuva bitince Kanka Coin olarak hesabına otomatik yüklenir.',
    'Birden fazla hesapla katılmak, maç ayarlamak veya hile tespit edilirse oyuncu diskalifiye edilir ve ödülü iptal olur.',
  ]
}

const STATUS_STYLE = {
  kayit: 'bg-primary text-primary-foreground',
  basladi: 'bg-destructive text-destructive-foreground',
  bitti: 'bg-secondary text-foreground',
  iptal: 'bg-muted text-muted-foreground',
} as const

export function TournamentCard({ t }: { t: Tournament }) {
  const meta = ARENA_META[t.game]
  const { points, member, refresh, requireLogin } = usePoints()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const full = t.entries.length >= t.maxPlayers
  const canAfford = points >= t.entryFee
  const fill = Math.min(100, Math.round((t.entries.length / t.maxPlayers) * 100))
  const joined = member != null && t.entries.some((e) => e.userId === member.id)
  const myMatch = member ? t.liveMatches.find((m) => m.players.includes(member.id)) : undefined

  const toggle = () => {
    if (!requireLogin()) return
    setError(null)
    startTransition(async () => {
      const r = joined ? await exitTournament(t.id) : await enterTournament(t.id)
      if (!r.ok) setError(r.error ?? 'İşlem başarısız.')
      refresh()
      router.refresh()
    })
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="relative h-32 sm:h-44 md:h-auto md:min-h-full">
          <Image src={meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-card" />
          <span className={cn('absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider md:left-4 md:top-4 md:px-2.5 md:py-1 md:text-xs', STATUS_STYLE[t.status])}>{STATUS_LABEL[t.status]}</span>
        </div>

        <div className="flex flex-col gap-4 p-4 md:gap-5 md:p-7">
          <div className="flex flex-col gap-1.5 md:gap-2">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary md:text-xs">
              <Gamepad2 className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{meta.title} turnuvası · {meta.players}</span>
            </span>
            <h2 className="font-display text-2xl font-bold uppercase leading-none text-foreground text-balance md:text-3xl">{t.title}</h2>
            {t.description && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground text-pretty md:line-clamp-none">{t.description}</p>}
          </div>

          <dl className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-secondary p-2.5 md:p-3">
              <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:gap-1.5 md:text-[11px]">
                <Trophy className="size-3.5 shrink-0" aria-hidden="true" /> Ödül
              </dt>
              <dd className="truncate font-display text-base font-bold text-primary md:text-xl">{formatAC(t.prizePool)} KC</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-secondary p-2.5 md:p-3">
              <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:gap-1.5 md:text-[11px]">
                <Coins className="size-3.5 shrink-0" aria-hidden="true" /> Katılım
              </dt>
              <dd className="truncate font-display text-base font-bold text-foreground md:text-xl">{t.entryFee ? `${formatAC(t.entryFee)} KC` : 'Ücretsiz'}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-secondary p-2.5 md:p-3">
              <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:gap-1.5 md:text-[11px]">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" /> Başlangıç
              </dt>
              <dd className="text-sm font-semibold capitalize leading-tight text-foreground">
                <span className="md:hidden">{formatShortTR(t.startsAt)}</span>
                <span className="hidden md:inline">{formatTR(t.startsAt)}</span>
              </dd>
            </div>
          </dl>
          {t.prizeNote && (
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Medal className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {t.prizeNote}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" /> Kayıtlı oyuncu
              </span>
              <span className="text-foreground">
                {t.entries.length} / {t.maxPlayers}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-label="Kontenjan doluluğu">
              <div className="h-full rounded-full bg-primary" style={{ width: `${fill}%` }} />
            </div>
          </div>

          {t.status === 'bitti' && t.winner && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 p-4">
              <Crown className="size-7 text-primary" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Şampiyon</span>
                <span className="font-display text-2xl font-bold uppercase text-foreground">{t.winner}</span>
              </div>
            </div>
          )}

          {t.status === 'basladi' && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary p-4 text-sm">
              <p className="font-semibold text-foreground">
                {t.currentRound ? `${t.currentRound}. tur oynanıyor` : 'Turnuva sürüyor'} · {t.liveMatches.filter((m) => m.status === 'oynaniyor').length} maç aynı anda devam ediyor
              </p>
              <p className="leading-relaxed text-muted-foreground">
                Turdaki tüm maçlar bitince kazananlar otomatik olarak bir sonraki tura eşleşir, finale kadar böyle devam eder.
              </p>
              {myMatch && myMatch.status === 'oynaniyor' && (
                <Link href={`/oyunlar/${t.game}`} className="mt-1 rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground">
                  Maçın hazır, oyuna gir
                </Link>
              )}
            </div>
          )}

          {t.status === 'kayit' && (
            <div className="flex flex-col gap-3">
              {joined && (
                <p className="rounded-xl border border-primary/50 bg-primary/10 p-3 text-sm font-semibold text-foreground" role="status">
                  Kaydın alındı. Turnuva başlayınca tüm oyuncular aynı anda eşleşir.
                </p>
              )}
              {error && (
                <p className="text-sm font-semibold text-destructive" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={toggle}
                disabled={pending || (!joined && member != null && (full || !canAfford))}
                className={cn(
                  'rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50',
                  joined ? 'border border-border text-foreground hover:bg-secondary' : 'bg-primary text-primary-foreground hover:brightness-110',
                )}
              >
                {pending
                  ? 'İşleniyor...'
                  : joined
                    ? 'Kaydımı iptal et'
                    : !member
                      ? 'Katılmak için giriş yap'
                      : full
                        ? 'Kontenjan doldu'
                        : !canAfford
                          ? `Bakiye yetersiz (${formatAC(t.entryFee)} KC gerekli)`
                          : t.entryFee
                            ? `${formatAC(t.entryFee)} KC ile katıl`
                            : 'Ücretsiz katıl'}
              </button>
              <Link href={`/oyunlar/${t.game}`} className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
                Turnuvadan önce {meta.title.toLowerCase()} masasında ısın
              </Link>
            </div>
          )}

          <details className="group rounded-xl border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <ScrollText className="size-4 text-primary" aria-hidden="true" />
                Kurallar ve detaylar
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              {tournamentRules(t, meta.title).map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-pretty">{rule}</span>
                </li>
              ))}
            </ul>
          </details>

          {t.entries.length > 0 && !t.bracket && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Katılımcılar">
              {t.entries.map((e) => (
                <li key={e.id} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground">
                  {e.nickname}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {t.bracket && (
        <div className="flex flex-col gap-3 border-t border-border p-5 md:p-7">
          <h3 className="font-display text-lg font-bold uppercase text-foreground">{t.format === 'lig' ? 'Puan durumu ve fikstür' : 'Eşleşmeler'}</h3>
          {t.format === 'lig' ? (
            <LeagueView bracket={t.bracket} names={t.names} order={t.entries.map((e) => e.userId ?? `misafir:${e.nickname}`)} />
          ) : (
            <BracketView bracket={t.bracket} />
          )}
        </div>
      )}
    </article>
  )
}
