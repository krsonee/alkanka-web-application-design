import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, Users } from 'lucide-react'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { hasOwn } from '@/lib/has-own'
import type { HomeTournament } from '@/lib/home-events'
import type { LeagueMatch } from '@/lib/predictions'
import { recordPath } from '@/lib/record-links'
import { TR_TZ, trDay } from '@/lib/tr-time'
import { TeamLogo } from '../../logo-context'
import { SectionHead } from './sections'

const DAY_MS = 86_400_000
const clock = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TR_TZ })
const shortDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: TR_TZ })
const fmt = (n: number) => n.toLocaleString('tr-TR')

function dayWord(iso: string, now: number) {
  const day = trDay(new Date(iso))
  if (day === trDay(now)) return 'Bugün'
  if (day === trDay(now + DAY_MS)) return 'Yarın'
  return shortDate.format(new Date(iso))
}

function Crest({ name, src }: { name: string; src: string | null }) {
  if (!src) return <TeamLogo name={name} className="size-6 border-0" />
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- crests come from the fixture feed's image host */}
      <img src={src} alt="" width={24} height={24} loading="lazy" className="size-6 object-contain" />
    </span>
  )
}

function When({ iso, now }: { iso: string; now: number }) {
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className="text-xs font-semibold text-muted-foreground">{dayWord(iso, now)}</span>
      <span className="font-display text-lg font-bold leading-tight tabular-nums text-foreground">{clock.format(new Date(iso))}</span>
    </span>
  )
}

const CARD =
  'flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-[scale,border-color] hover:border-primary/40 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function MatchCard({ match, now }: { match: LeagueMatch; now: number }) {
  return (
    <Link href={recordPath('tahmin', match.id)} className={CARD}>
      <span className="truncate text-xs font-semibold text-primary">Sıradaki maç · {match.league}</span>
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-2">
          {[
            { name: match.home, logo: match.homeLogo },
            { name: match.away, logo: match.awayLogo },
          ].map((team) => (
            <span key={team.name} className="flex min-w-0 items-center gap-2.5">
              <Crest name={team.name} src={team.logo} />
              <span className="truncate text-base font-semibold text-foreground">{team.name}</span>
            </span>
          ))}
        </span>
        <When iso={match.kickoff} now={now} />
      </span>
      <span className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm font-semibold">
        {match.myPick ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Check className="size-4 text-primary" aria-hidden="true" />
            Tahminin yazıldı
          </span>
        ) : (
          <span className="text-foreground">Tahminini yaz, puanı kap</span>
        )}
        <span className="flex items-center gap-1 text-primary">
          {match.myPick ? 'Maça bak' : 'Tahmin yap'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </span>
    </Link>
  )
}

function TournamentCard({ t, now }: { t: HomeTournament; now: number }) {
  const meta = hasOwn(ARENA_META, t.game) ? ARENA_META[t.game as ArenaGame] : null
  return (
    <Link href={recordPath('turnuva', t.id)} className={CARD}>
      <span className="flex items-center gap-3">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl outline outline-1 -outline-offset-1 outline-foreground/10">
          <Image src={meta?.image ?? '/images/tile-market.png'} alt="" fill sizes="56px" className="object-cover" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs font-semibold text-primary">
            {t.running ? 'Turnuva oynanıyor' : 'Turnuva kaydı açık'}
            {meta ? ` · ${meta.title}` : ''}
          </span>
          <span className="line-clamp-2 text-pretty text-base font-semibold leading-snug text-foreground">{t.title}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
            <Users className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t.players}/{t.maxPlayers}
              <span className="sr-only"> oyuncu</span> · {t.entryFee > 0 ? `giriş ${fmt(t.entryFee)} KC` : 'giriş ücretsiz'}
            </span>
          </span>
        </span>
        {!t.running && <When iso={t.startsAt} now={now} />}
      </span>
      <span className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm font-semibold">
        <span className="tabular-nums text-foreground">{fmt(t.prizePool)} KC ödül</span>
        <span className="flex shrink-0 items-center gap-1 text-primary">
          {t.running ? 'Turnuvaya git' : 'Katıl'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </span>
    </Link>
  )
}

export function UpNext({ match, tournaments }: { match: LeagueMatch | null; tournaments: HomeTournament[] }) {
  if (!match && tournaments.length === 0) return null
  const now = Date.now()
  return (
    <section className="flex flex-col gap-4">
      <SectionHead title="Sırada ne var" sub="Saatler Türkiye saatiyle." />
      <div className="flex flex-col gap-2.5">
        {match && <MatchCard match={match} now={now} />}
        {tournaments.map((t) => (
          <TournamentCard key={t.id} t={t} now={now} />
        ))}
      </div>
    </section>
  )
}
