'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronDown, Crown, ScrollText, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META } from '@/lib/arena'
import { isDecided, isRealMatch, passedOn } from '@/lib/bracket'
import { FORMAT_SHORT, PACE_MS, SOURCE_LABEL, TABLE_PASS, leagueRounds, matchHref, matchLengthOf, type LiveMatch, type Tournament } from '@/lib/tournaments-shared'
import { BracketView } from './bracket-view'
import { LeagueView } from './league-view'
import { PlayerStats } from './player-stats'
import { PointsView } from './points-view'
import { PrizeList } from './prize-list'
import { Countdown } from './tournament-countdown'
import { closeNote, formatTR, runningLine, tournamentRules, tournamentSteps } from './tournament-text'

/** What the card already worked out about the viewer, so the details ask for nothing twice. */
export type TournamentView = {
  myId: string | null
  joined: boolean
  myMatch: LiveMatch | undefined
  joinLeft: number | null
  pending: boolean
  error: string | null
  canJoin: boolean
  joinLabel: string
  toggleEntry: () => void
}

/** Entrant names shown before the list is cut short: a big field would fill the screen with names. */
const NAME_LIMIT = 48

const keyOf = (e: Tournament['entries'][number]) => e.userId ?? `misafir:${e.nickname}`

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <dt className="shrink-0 text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-semibold text-foreground text-pretty">{children}</dd>
    </div>
  )
}

const sectionTitle = 'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'

/** The tournament in three steps. Shown while it can still be joined or is being played. */
function Steps({ t }: { t: Tournament }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className={sectionTitle}>Nasıl oynanır</h4>
      <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border @2xl:grid-cols-3">
        {tournamentSteps(t, ARENA_META[t.game].title).map((step, i) => (
          <li key={step.title} className="flex gap-3 bg-card p-3 @2xl:flex-col @2xl:gap-2.5 @2xl:p-4">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-bold text-foreground">{step.title}</span>
              <span className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** What the card above does not already say: prize, fee, start and field are on the card. */
function Facts({ t }: { t: Tournament }) {
  const meta = ARENA_META[t.game]
  const length = matchLengthOf(t.game, t.matchLength)
  const league = t.format === 'lig'
  const points = t.format === 'puan'
  const rounds = league ? (t.bracket?.rounds.length ?? leagueRounds(t.maxPlayers, t.league.legs)) : 0
  return (
    <dl className="flex flex-col divide-y divide-border rounded-xl border border-border">
      <Fact label="Düzen">
        {FORMAT_SHORT[t.format]}
        {t.format === 'eleme' && (t.tableSize > 2 ? ` · ${t.tableSize} kişilik masalar` : ' · birebir')}
        {league && ` · ${t.league.legs === 2 ? 'çift devre' : 'tek devre'}`}
      </Fact>
      {league && (
        <Fact label="Turlar">
          {t.bracket ? `${rounds} tur` : `en fazla ${rounds} tur`} ·{' '}
          {t.league.pace === 'gunluk' ? 'her gün 1 tur' : t.league.pace === 'haftalik' ? 'her hafta 1 tur' : 'art arda, aynı oturumda'}
        </Fact>
      )}
      {points && <Fact label="Sayılan oyun">Sadece {meta.title}; masa kaç kişilik olursa olsun</Fact>}
      {points && <Fact label="Sayılan masalar">{SOURCE_LABEL[t.league.source]}</Fact>}
      {points && <Fact label="Oyun sınırı">{t.league.maxGames ? `Oyuncu başına ilk ${t.league.maxGames} ${meta.title} oyunu` : 'Sınır yok'}</Fact>}
      <Fact label="Başlangıç">
        <span className="capitalize">{formatTR(t.startsAt)}</span>
      </Fact>
      {t.endsAt && (
        <Fact label={points ? 'Bitiş' : 'En geç bitiş'}>
          <span className="capitalize">{formatTR(t.endsAt)}</span>
        </Fact>
      )}
      {!points && length && <Fact label="Maç uzunluğu">{length.label}</Fact>}
      {!points && <Fact label="Maça giriş süresi">{t.joinMinutes} dakika</Fact>}
    </dl>
  )
}

const noteBox = 'rounded-xl border border-border bg-card p-3 text-sm font-semibold leading-relaxed text-foreground'

function RunningBlock({ t, view }: { t: Tournament; view: TournamentView }) {
  const meta = ARENA_META[t.game]
  const { myId, joined, myMatch, joinLeft } = view
  const league = t.format === 'lig'
  const points = t.format === 'puan'
  const shared = t.tableSize > 2 && t.format === 'eleme'
  const pass = t.bracket?.pass ?? TABLE_PASS
  // Out of a shared table that is still being played: the bracket names the player, the open table no longer seats them.
  const dropped =
    myId != null && t.liveMatches.some((m) => m.status === 'oynaniyor' && !m.players.includes(myId) && (t.bracket?.rounds[m.round]?.[m.match]?.players.includes(myId) ?? false))
  const eliminated =
    myId != null &&
    t.format === 'eleme' &&
    (dropped || (t.bracket?.rounds.some((round) => round.some((m) => isRealMatch(m) && isDecided(m) && m.players.includes(myId) && !passedOn(m).includes(myId))) ?? false))
  const place = points && myId && t.points ? t.points.findIndex((p) => p.key === myId) : -1
  const mine = place >= 0 ? t.points![place] : null
  const waiting = waitingText()

  function waitingText() {
    if (eliminated) return `Bu turnuvada elendin. ${shared ? 'Masaları' : 'Eşleşmeleri'} aşağıdan izleyebilirsin.`
    if (t.nextRoundAt) return `Sıradaki maçın ${formatTR(t.nextRoundAt)} açılır. Açıldığında bildirim gelir ve düğmesi burada çıkar.`
    return shared ? 'Şu an açık masan yok. Sıradaki masan açılınca düğmesi burada çıkar.' : 'Şu an açık maçın yok. Sıradaki maçın açılınca düğmesi burada çıkar.'
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary p-4 text-sm">
      <p className="font-semibold text-foreground">{runningLine(t)}</p>
      <p className="leading-relaxed text-muted-foreground text-pretty">
        {points
          ? `Kayıtlı oyuncuların bitirdiği ${meta.title} oyunları puan tablosuna yazılıyor. Tablo yaklaşık yarım dakikada bir güncellenir; lig bitiş saatinde kapanır ve ödüller o anki sıralamaya göre dağıtılır.`
          : shared
            ? `Turdaki tüm masalar bitince her masanın ilk ${pass} oyuncusu bir sonraki turda yeni masalara oturur. Final masasının birincisi şampiyon olur. Bu sayfa kendiliğinden güncellenir.`
            : league
              ? PACE_MS[t.league.pace]
                ? `Bu ligde ${t.league.pace === 'gunluk' ? 'her gün' : 'her hafta'} bir tur açılır; turların tarihi fikstürde yazar. Herkes herkesle ${t.league.legs === 2 ? 'iki kez' : 'bir kez'} oynar.`
                : `Turdaki tüm maçlar bitince sıradaki tur açılır. Herkes herkesle ${t.league.legs === 2 ? 'iki kez' : 'bir kez'} oynar, bu sayfa kendiliğinden güncellenir.`
              : 'Turdaki tüm maçlar bitince kazananlar bir sonraki tura eşleşir, finale kadar böyle devam eder. Bu sayfa kendiliğinden güncellenir.'}
      </p>
      {points ? (
        joined && (
          <p className={cn(noteBox, 'mt-1')} role="status">
            {mine && mine.played > 0
              ? `Sıran ${place + 1}. · ${mine.points} puan · ${mine.played} oyun${t.league.maxGames ? ` (en fazla ${t.league.maxGames} sayılır)` : ''}`
              : `Henüz sayılan bir oyunun yok. İlk ${meta.title} oyununu bitirince tabloya girersin.`}
          </p>
        )
      ) : myMatch ? (
        <>
          <Link
            href={matchHref({ game: t.game, tableId: myMatch.tableId })}
            className="mt-1 rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground"
          >
            {shared ? 'Masan hazır, masaya gir' : 'Maçın hazır, masaya gir'}
          </Link>
          {joinLeft != null && joinLeft > 0 && (
            <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-sm font-semibold text-foreground">
              Masaya girmek için kalan süre
              <Countdown seconds={joinLeft} label="Masaya girmek için kalan süre" />
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {joinLeft != null && joinLeft > 0 ? (shared ? 'Süre dolmadan girmezsen elenirsin, masa sensiz oynanır. ' : 'Süre dolmadan girmezsen maçı hükmen kaybedersin. ') : ''}
            {t.entryFee ? 'Kayıt ücretin ödendi, masada ayrıca bahis yok.' : 'Turnuva masasında bahis yok.'}
          </p>
        </>
      ) : (
        joined && (
          <p className={cn(noteBox, 'mt-1')} role="status">
            {waiting}
          </p>
        )
      )}
    </div>
  )
}

function EntryBlock({ t, view }: { t: Tournament; view: TournamentView }) {
  const meta = ARENA_META[t.game]
  const { joined, pending, error, toggleEntry } = view
  const shared = t.tableSize > 2 && t.format === 'eleme'
  const left = Math.max(0, t.maxPlayers - t.entries.length)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary p-4">
      <p className="text-sm leading-relaxed text-foreground text-pretty" role={joined ? 'status' : undefined}>
        {joined ? (
          <span className="font-semibold">
            {t.format === 'puan'
              ? `Kaydın alındı. Lig başlayınca bitirdiğin ${meta.title} oyunları puan tablosuna yazılır.`
              : t.format === 'lig'
                ? 'Kaydın alındı. Lig başlayınca fikstür kura ile çekilir ve ilk turun maçları açılır.'
                : shared
                  ? `Kaydın alındı. Turnuva başlayınca oyuncular kura ile ${t.tableSize} kişilik masalara dağıtılır.`
                  : 'Kaydın alındı. Turnuva başlayınca tüm oyuncular aynı anda eşleşir.'}
          </span>
        ) : (
          <>
            Kayıtlar <span className="font-semibold capitalize">{formatTR(t.startsAt)}</span> kapanır.{' '}
            {left > 0 ? `${left} kişilik yer var.` : 'Kontenjan doldu; biri kaydını iptal ederse yer açılır.'}
          </>
        )}
      </p>
      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
        {/* The card above already carries the join button; down here only a registered member has something to do. */}
        {joined && (
          <button
            type="button"
            onClick={toggleEntry}
            disabled={pending}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground hover:bg-background disabled:opacity-50"
          >
            {pending ? 'İşleniyor...' : 'Kaydımı iptal et'}
          </button>
        )}
        <Link
          href={`/oyunlar/${t.game}`}
          className={cn('rounded-xl text-sm font-bold text-foreground hover:bg-background', joined ? 'px-3 py-2.5 text-center' : 'border border-border bg-card px-5 py-2.5 text-center')}
        >
          Turnuvadan önce {meta.title} masasında ısın
        </Link>
      </div>
    </div>
  )
}

function Rules({ t }: { t: Tournament }) {
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <ScrollText className="size-4 text-primary" aria-hidden="true" />
          Kurallar
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {tournamentRules(t, ARENA_META[t.game].title).map((rule) => (
          <li key={rule} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-pretty">{rule}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function Results({ t, myId }: { t: Tournament; myId: string | null }) {
  const order = t.entries.map(keyOf)
  const running = t.status === 'basladi'
  if (t.format === 'puan') {
    if (!t.points) return null
    return (
      <section className="flex flex-col gap-3">
        <h4 className="font-display text-base font-bold uppercase text-foreground">Puan durumu</h4>
        <PointsView rows={t.points} names={t.names} me={myId} maxGames={t.league.maxGames} closed={!running} />
      </section>
    )
  }
  if (!t.bracket) return null
  if (t.format === 'lig') {
    return (
      <section className="flex flex-col gap-3">
        <h4 className="font-display text-base font-bold uppercase text-foreground">Puan durumu ve fikstür</h4>
        <LeagueView bracket={t.bracket} names={t.names} order={order} schedule={{ startsAt: t.startsAt, pace: t.league.pace }} me={myId} />
      </section>
    )
  }
  return (
    <section className="flex flex-col gap-3">
      <h4 className="font-display text-base font-bold uppercase text-foreground">{(t.bracket.seats ?? 2) > 2 ? 'Masalar' : 'Eşleşmeler'}</h4>
      <BracketView bracket={t.bracket} names={t.names} closed={!running} />
      <details className="group rounded-xl border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Users className="size-4 text-primary" aria-hidden="true" />
            Oyuncu durumu
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-border p-3">
          <PlayerStats bracket={t.bracket} names={t.names} order={order} closed={!running} />
        </div>
      </details>
    </section>
  )
}

/** Everything about one tournament below its summary row. Rendered only while the row is open. */
export function TournamentDetails({ t, id, view }: { t: Tournament; id: string; view: TournamentView }) {
  const closed = closeNote(t)
  const started = Boolean(t.bracket)
  return (
    <div id={id} className="flex flex-col gap-5 border-t border-border p-3 @2xl:p-4 @6xl:p-5">
      {t.status === 'bitti' && t.winner && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 p-4">
          <Crown className="size-7 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Şampiyon</span>
            <span className="truncate font-display text-2xl font-bold uppercase text-foreground">{t.winner}</span>
          </div>
        </div>
      )}
      {closed && (
        <p className="rounded-xl border border-border bg-secondary p-3 text-sm leading-relaxed text-foreground text-pretty" role="note">
          {closed}
        </p>
      )}
      {t.status === 'basladi' && <RunningBlock t={t} view={view} />}
      {t.status === 'kayit' && <EntryBlock t={t} view={view} />}
      {t.description && <p className="text-sm leading-relaxed text-foreground text-pretty">{t.description}</p>}
      {(t.status === 'kayit' || t.status === 'basladi') && <Steps t={t} />}

      <div className="grid gap-5 @3xl:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h4 className={sectionTitle}>Turnuva bilgileri</h4>
          <Facts t={t} />
        </div>
        <div className="flex flex-col gap-4">
          {t.prizeNote && <p className="text-sm font-semibold text-foreground text-pretty">{t.prizeNote}</p>}
          <PrizeList t={t} />
          <Rules t={t} />
        </div>
      </div>

      <Results t={t} myId={view.myId} />

      {!started && t.entries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kayıtlı oyuncular ({t.entries.length})</h4>
          <ul className="flex flex-wrap gap-1.5">
            {t.entries.slice(0, NAME_LIMIT).map((e) => (
              <li key={e.id} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground">
                {e.nickname}
              </li>
            ))}
            {t.entries.length > NAME_LIMIT && (
              <li className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-semibold text-muted-foreground">+{t.entries.length - NAME_LIMIT} oyuncu</li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
