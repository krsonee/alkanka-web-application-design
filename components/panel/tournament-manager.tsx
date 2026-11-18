'use client'

import { HideButton } from '@/components/panel/hide-button'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { useActionState, useState, type ReactNode } from 'react'
import { BookmarkPlus, Loader2, Play, Plus, Trash2, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TournamentGuide } from '@/components/panel/area-guides'
import { ARENA_GAMES, ARENA_META, type ArenaGame } from '@/lib/arena'
import {
  DEFAULT_JOIN_MINUTES,
  DEFAULT_LEAGUE,
  DEFAULT_POINTS_MINUTES,
  DEFAULT_TOURNAMENT_MINUTES,
  FINISH_LABEL,
  FORMAT_LABEL,
  FORMAT_SHORT,
  JOIN_MINUTES,
  LEAGUE_PACES,
  MIN_TOURNAMENT_MINUTES,
  PACE_LABEL,
  PACE_MS,
  PACE_SHORT,
  POINT_GAME_CAPS,
  POINT_SOURCES,
  SOURCE_LABEL,
  STATUS_LABEL,
  TABLE_PASS,
  canHostTournament,
  cleanMatchLength,
  earliestLeagueEnd,
  entrantsNeeded,
  formatsFor,
  leagueRounds,
  matchLengthOf,
  matchLengths,
  roundOpensAt,
  tournamentSeats,
  type LeaguePace,
  type LeagueSettings,
  type PointSource,
  type Tournament,
  type TournamentFormat,
  type TournamentTemplate,
} from '@/lib/tournaments-shared'
import { MAX_PRIZE_KC, MAX_PRIZE_POOL_KC, effectivePrizes, isPlayerCount, playerOptions, prizePlaces, prizeTotal, snapPlayers } from '@/lib/tournament-prizes'
import { PrizeList } from '@/components/alkanka/arena/prize-list'
import { MAX_LEAGUE_PLAYERS } from '@/lib/league'
import { LeagueView } from '@/components/alkanka/arena/league-view'
import { PointsView } from '@/components/alkanka/arena/points-view'
import { beginTournament, dropTournamentTemplate, keepTournamentTemplate, kickEntry, pickMatchWinner, removeTournament, saveTournament, stopTournament } from '@/app/panel/arena-actions'
import type { ActionState } from '@/app/panel/actions'
import { BracketView } from '@/components/alkanka/arena/bracket-view'
import { PlayerStats } from '@/components/alkanka/arena/player-stats'
import { TournamentMatches } from '@/components/panel/tournament-matches'
import { isDecided, isRealMatch, openRound, type Match } from '@/lib/bracket'
import { formatTR } from '@/components/alkanka/arena/tournament-card'
import { Flash } from '@/components/panel/flash'

const ISTANBUL_OFFSET = -180
const MINUTE = 60_000
const QUARTER = 15 * MINUTE
/** How long a new tournament runs unless the end time is changed. */
const DEFAULT_LENGTH = DEFAULT_TOURNAMENT_MINUTES * MINUTE

/** A moment as the text a `datetime-local` field shows for Istanbul. */
const toIstanbulInput = (ms: number) => new Date(ms + 3 * 3600000).toISOString().slice(0, 16)
const inputMs = (value: string) => Date.parse(`${value}:00Z`)
const shiftInput = (value: string, ms: number) => (Number.isNaN(inputMs(value)) ? value : new Date(inputMs(value) + ms).toISOString().slice(0, 16))

/** A new tournament starts on the next quarter hour that is at least an hour away, not a day later. */
const defaultStart = () => Math.ceil((Date.now() + 3600000) / QUARTER) * QUARTER

/** The text a `datetime-local` field holds, read as a moment in the form's own frame and written back the same way. */
const fromInputMs = (ms: number) => new Date(ms).toISOString().slice(0, 16)
const inputDayText = (ms: number) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))

/** Hours a paced league stays open after its last round opens when the form sets the end itself. */
const LAST_ROUND_ROOM = 3 * 3600000
const DAY = 24 * 3600000

/**
 * The end time after the format, the field or the league's pace changed. A league that opens a round a
 * day or a week gets room for its last round, a points league a week, and a format played in one
 * sitting loses an end that was left days away by one of those. Only called for such a change, so an
 * end typed by hand stays until the next one.
 */
function fitEnd(times: { start: string; end: string }, format: TournamentFormat, players: number, league: LeagueSettings) {
  const start = inputMs(times.start)
  const span = inputMs(times.end) - start
  if (Number.isNaN(start)) return times
  if (format === 'lig' && PACE_MS[league.pace]) {
    const lastRound = roundOpensAt(new Date(start), Math.max(0, leagueRounds(players, league.legs) - 1), league.pace).getTime()
    return { ...times, end: fromInputMs(lastRound + LAST_ROUND_ROOM) }
  }
  if (format === 'puan') return { ...times, end: fromInputMs(start + DEFAULT_POINTS_MINUTES * MINUTE) }
  return span > 2 * DAY ? { ...times, end: fromInputMs(start + DEFAULT_LENGTH) } : times
}

function lengthText(minutes: number) {
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = Math.round(minutes % 60)
  return [days && `${days} gün`, hours && `${hours} saat`, rest && `${rest} dakika`].filter(Boolean).join(' ')
}

const field = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const labelCls = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'

function Feedback({ state }: { state: ActionState }) {
  return <Flash ok={state.ok} text={state.message} token={state} className="font-semibold" />
}

function ActionButton({
  act,
  fields,
  children,
  variant = 'ghost',
  confirm,
}: {
  act: (s: ActionState, f: FormData) => Promise<ActionState>
  fields: Record<string, string | number>
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  confirm?: string
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(act, {})
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const form = e.currentTarget
        if (!confirm || form.dataset.confirmed === '1') {
          delete form.dataset.confirmed
          return
        }
        e.preventDefault()
        void askConfirm(confirm).then((ok) => {
          if (!ok) return
          form.dataset.confirmed = '1'
          form.requestSubmit()
        })
      }}
      className="flex flex-col gap-1"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-60',
          variant === 'primary' && 'bg-primary text-primary-foreground',
          variant === 'ghost' && 'border border-border text-foreground hover:bg-secondary',
          variant === 'danger' && 'border border-destructive/50 text-destructive hover:bg-destructive/10',
        )}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {children}
      </button>
      <Flash ok={false} text={state.ok ? null : state.message} token={state} className="text-xs" />
    </form>
  )
}

/** Prize rows a form opens with; more are added one place at a time. */
const START_PRIZE_ROWS = 3

/** Tomorrow in Istanbul at the template's hour, so a weekly cup reopens with one date change at most. */
function tomorrowAt(time: string) {
  return `${new Date(Date.now() + 27 * 3600000).toISOString().slice(0, 10)}T${time}`
}

function TournamentForm({ t, preset, onCreated }: { t?: Tournament; preset?: TournamentTemplate; onCreated?: (state: ActionState) => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const next = await saveTournament(prev, form)
    if (next.ok && preset) onCreated?.(next)
    return next
  }, {})
  const from = t ?? preset
  const [game, setGame] = useState<ArenaGame>(from?.game ?? 'tavla')
  // A game played at shared tables has no league and fills whole tables, so the game decides the other choices.
  const seats = tournamentSeats(game) ?? 2
  const shared = seats > 2
  const formats = formatsFor(game)
  const startFormat = (g: ArenaGame, f: TournamentFormat): TournamentFormat => (formatsFor(g).includes(f) ? f : 'eleme')
  const [format, setFormat] = useState<TournamentFormat>(() => startFormat(from?.game ?? 'tavla', from?.format ?? 'eleme'))
  const [maxPlayers, setMaxPlayers] = useState(() => snapPlayers(startFormat(from?.game ?? 'tavla', from?.format ?? 'eleme'), from?.maxPlayers ?? 16, tournamentSeats(from?.game ?? 'tavla') ?? 2))
  const [prizes, setPrizes] = useState<string[]>(() => {
    const saved = (from ? effectivePrizes(from) : [5000]).map(String)
    return Array.from({ length: Math.max(saved.length, START_PRIZE_ROWS) }, (_, i) => saved[i] ?? '0')
  })
  const places = prizePlaces(format, maxPlayers, seats)
  // A row is a place a prize was added for; a smaller field or another format has fewer places to offer.
  const rows = prizes.slice(0, places.length)
  const amounts = rows.map((v) => Math.max(0, Math.round(Number(v) || 0)))
  const total = prizeTotal(format, maxPlayers, amounts, seats)
  const nextPlace = places[rows.length]
  const legacySize = Boolean(from && !isPlayerCount(format, from.maxPlayers, seats))
  const legacyFormat = Boolean(from && from.format !== format && from.game === game)
  const [times, setTimes] = useState(() => {
    const start = preset ? tomorrowAt(preset.startTime) : toIstanbulInput(t ? Date.parse(t.startsAt) : defaultStart())
    return { start, end: t?.endsAt ? toIstanbulInput(Date.parse(t.endsAt)) : shiftInput(start, preset ? preset.lengthMinutes * MINUTE : DEFAULT_LENGTH) }
  })
  const length = (inputMs(times.end) - inputMs(times.start)) / MINUTE
  const [matchLength, setMatchLength] = useState(() => cleanMatchLength(from?.game ?? 'tavla', from?.matchLength))
  const lengthChoices = matchLengths(game)
  const games = ARENA_GAMES.filter((g) => canHostTournament(g) || g === from?.game)
  const [league, setLeague] = useState<LeagueSettings>(() => from?.league ?? DEFAULT_LEAGUE)
  const fixtures = format === 'lig'
  const pointsLeague = format === 'puan'
  const paced = fixtures && PACE_MS[league.pace] > 0
  const rounds = leagueRounds(maxPlayers, league.legs)
  // The form's times are plain text in Istanbul's clock; the same frame is used for the round dates worked out from them.
  const startMs = inputMs(times.start)
  const lastRoundMs = paced && !Number.isNaN(startMs) ? roundOpensAt(new Date(startMs), Math.max(0, rounds - 1), league.pace).getTime() : null
  const earliestEnd = paced && !Number.isNaN(startMs) ? earliestLeagueEnd(new Date(startMs), maxPlayers, league) : null
  const tooShort = earliestEnd != null && inputMs(times.end) < earliestEnd.getTime()
  /** One change to the format, the field or the league, with the end time moved to fit it. */
  const reshape = (next: { format?: TournamentFormat; players?: number; league?: LeagueSettings }) => {
    const f = next.format ?? format
    const n = next.players ?? maxPlayers
    const l = next.league ?? league
    if (next.format) setFormat(f)
    if (next.players) setMaxPlayers(n)
    if (next.league) setLeague(l)
    // A new field size alone moves the end only where the number of rounds decides it.
    const refit = f !== format || Boolean(next.league) || (f === 'lig' && PACE_MS[l.pace] > 0)
    if (refit) setTimes((now) => fitEnd(now, f, n, l))
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={t?.id ?? 0} />
      <input type="hidden" name="tz" value={ISTANBUL_OFFSET} />
      <input type="hidden" name="rules" value={from?.rules ?? ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Oyun
          <select
            name="game"
            value={game}
            onChange={(e) => {
              const next = e.target.value as ArenaGame
              const nextFormat = startFormat(next, format)
              setGame(next)
              reshape({ format: nextFormat, players: snapPlayers(nextFormat, maxPlayers, tournamentSeats(next) ?? 2) })
              setMatchLength(cleanMatchLength(next, next === from?.game ? from.matchLength : null))
            }}
            className={field}
          >
            {games.map((g) => (
              <option key={g} value={g}>
                {ARENA_META[g].title} · {(tournamentSeats(g) ?? 2) > 2 ? `${tournamentSeats(g)} kişilik masa` : 'birebir'}
              </option>
            ))}
          </select>
          <span className={cn('font-normal', !canHostTournament(game) && 'text-destructive')}>
            {!canHostTournament(game)
              ? 'Bu oyunda artık turnuva açılmıyor. Listeden başka bir oyun seç.'
              : pointsLeague
                ? `Puan liginde turnuva masası açılmaz: oyuncular ${ARENA_META[game].title} oyunlarını her zamanki gibi oynar, sonuçlar puan tablosuna yazılır.`
                : shared
                  ? `${ARENA_META[game].title} turnuvası ${seats} kişilik ortak masalarda oynanır: her masanın ilk ${TABLE_PASS} oyuncusu tur atlar, final masasının birincisi şampiyon olur.`
                  : `${ARENA_META[game].title} turnuvasında maçlar birebir oynanır.`}
          </span>
        </label>
        <label className={labelCls}>
          Format
          <select
            name="format"
            value={format}
            onChange={(e) => {
              const next = e.target.value as TournamentFormat
              reshape({ format: next, players: snapPlayers(next, maxPlayers, seats) })
            }}
            className={field}
          >
            {formats.map((f) => (
              <option key={f} value={f}>
                {f === 'eleme' && shared ? `Eleme (${seats} kişilik masalar, ilk ${TABLE_PASS} tur atlar)` : FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
          <span className="font-normal">
            {format === 'eleme'
              ? 'Kaybeden elenir, tur tur finale gidilir. Kısa sürede biten, tek oturumluk turnuva.'
              : fixtures
                ? `Herkes herkesle oynar, galibiyet 3 puan; en çok puanı toplayan şampiyon olur. En fazla ${MAX_LEAGUE_PLAYERS} oyuncu. Turların ne sıklıkla açılacağını aşağıdan seç.`
                : 'Eşleşme ve fikstür yok. Lig süresince kayıtlı oyuncuların kendi oynadığı oyunlar sayılır: galibiyet 3, beraberlik 1 puan. Bitiş saatinde ilk sıralar ödülü alır.'}
            {shared && ' Ortak masalarda oynanan oyunlarda fikstürlü lig yok.'}
            {legacyFormat && ' Bu kayıt lig düzenindeydi; bu oyunda fikstürlü lig olmadığı için eleme seçildi.'}
          </span>
        </label>
        {fixtures && (
          <>
            <label className={labelCls}>
              Tur aralığı
              <select name="pace" value={league.pace} onChange={(e) => reshape({ league: { ...league, pace: e.target.value as LeaguePace } })} className={field}>
                {LEAGUE_PACES.map((p) => (
                  <option key={p} value={p}>
                    {PACE_LABEL[p]}
                  </option>
                ))}
              </select>
              <span className="font-normal" aria-live="polite">
                {league.pace === 'ardarda'
                  ? 'Bir turun bütün maçları bitince sıradaki tur hemen açılır. Lig tek oturumda, birkaç saatte biter; oyuncuların o süre boyunca sitede olması gerekir.'
                  : `İlk tur başlangıç saatinde, sonraki her tur ${league.pace === 'gunluk' ? 'ertesi gün' : 'bir hafta sonra'} aynı saatte açılır. Oyuncunun ${league.pace === 'gunluk' ? 'günde' : 'haftada'} tek maçı olur; tur açılınca bildirim gider. Bir turda süren maç varsa sıradaki tur o maç bitince açılır.`}
              </span>
            </label>
            <label className={labelCls}>
              Devre
              <select name="legs" value={league.legs} onChange={(e) => reshape({ league: { ...league, legs: Number(e.target.value) === 2 ? 2 : 1 } })} className={field}>
                <option value={1}>Tek devre: herkes herkesle 1 kez</option>
                <option value={2}>Çift devre: herkes herkesle 2 kez</option>
              </select>
              <span className="font-normal" aria-live="polite">
                Kontenjan dolarsa {rounds} tur oynanır, her oyuncu {rounds} maç yapar. Daha az kayıt olursa tur sayısı da azalır.
                {lastRoundMs != null && (
                  <>
                    {' '}
                    Son tur en geç <span className="capitalize text-foreground">{inputDayText(lastRoundMs)}</span> açılır.
                  </>
                )}
              </span>
            </label>
          </>
        )}
        {pointsLeague && (
          <>
            <label className={labelCls}>
              Sayılan oyunlar
              <select name="source" value={league.source} onChange={(e) => setLeague({ ...league, source: e.target.value as PointSource })} className={field}>
                {POINT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
              <span className={cn('font-normal', league.source === 'hepsi' && 'text-destructive')} aria-live="polite">
                {league.source === 'pvp'
                  ? 'Üyelerin birbirine karşı oynadığı masalar sayılır; bu masaların sonucunu sunucu yazar. Bota karşı oyunlar ve turnuva maçları sayılmaz.'
                  : 'Bota karşı oyunlar da sayılır. Bot maçlarının bir kısmında sonucu oyuncunun tarayıcısı bildirir; ödüllü ligde bu seçenek hileye açıktır.'}
              </span>
            </label>
            <label className={labelCls}>
              Oyuncu başına sayılacak oyun
              <select name="maxGames" value={league.maxGames} onChange={(e) => setLeague({ ...league, maxGames: Number(e.target.value) })} className={field}>
                {POINT_GAME_CAPS.map((n) => (
                  <option key={n} value={n}>
                    {n ? `İlk ${n} oyun` : 'Sınır yok: bütün oyunlar sayılır'}
                  </option>
                ))}
              </select>
              <span className="font-normal" aria-live="polite">
                {league.maxGames
                  ? `Her oyuncunun lig başladıktan sonraki ilk ${league.maxGames} oyunu sayılır, sonrakiler puan getirmez. Herkes aynı sayıda oyunla yarışır.`
                  : 'Sınır yoksa çok oynayan öne geçer. İki hesabın birbirine oyun vermesini de sınırlamak istersen bir sınır seç.'}
              </span>
            </label>
          </>
        )}
        <label className={labelCls}>
          Turnuva adı
          <input name="title" required minLength={3} maxLength={80} defaultValue={from?.title} placeholder="Cuma Akşamı Tavla Kupası" className={field} />
        </label>
        <label className={cn(labelCls, 'sm:col-span-2')}>
          Açıklama
          <textarea name="description" rows={2} maxLength={400} defaultValue={from?.description} placeholder="Kurallar, format, yayın bilgisi..." className={field} />
        </label>
        <label className={labelCls}>
          Başlangıç (İstanbul saati)
          <input
            type="datetime-local"
            name="startsAt"
            required
            value={times.start}
            onChange={(e) => {
              const next = e.target.value
              // The end moves with the start, so the tournament keeps the length that was set.
              setTimes((now) => {
                const moved = inputMs(next) - inputMs(now.start)
                return { start: next, end: Number.isFinite(moved) ? shiftInput(now.end, moved) : now.end }
              })
            }}
            className={field}
          />
          <span className="font-normal">
            {preset ? 'Şablondaki saatle yarına ayarlandı, bitiş şablondaki süreye göre geldi. Tarihi kontrol et. ' : ''}
            Kayıtlar bu saatte kapanır ve {pointsLeague ? 'lig' : 'turnuva'} kendiliğinden başlar. {entrantsNeeded(format, seats)} kişiden az kayıt varsa iptal olur, ücretler iade edilir.
            {paced && ` Bu saat aynı zamanda her turun açılış saatidir: turlar ${league.pace === 'gunluk' ? 'her gün' : 'her hafta aynı gün'} bu saatte açılır.`}
          </span>
        </label>
        <label className={labelCls}>
          Bitiş (İstanbul saati)
          <input type="datetime-local" name="endsAt" required value={times.end} onChange={(e) => setTimes((now) => ({ ...now, end: e.target.value }))} className={field} />
          <span className={cn('font-normal', (length < MIN_TOURNAMENT_MINUTES || tooShort) && 'text-destructive')} aria-live="polite">
            {length < MIN_TOURNAMENT_MINUTES || Number.isNaN(length) ? (
              `Bitiş, başlangıçtan en az ${MIN_TOURNAMENT_MINUTES} dakika sonra olmalı.`
            ) : tooShort && earliestEnd ? (
              <>
                Bu lig {rounds} tur sürer. Bitiş en erken <span className="capitalize">{inputDayText(earliestEnd.getTime())}</span> olmalı; yoksa son turlar oynanmadan lig kapanır.
              </>
            ) : pointsLeague ? (
              `Lig ${lengthText(length)} sürer ve bu saatte kapanır: o ana kadar biten oyunlar sayılır, ödüller o anki sıralamaya göre dağıtılır. Puan ligi daha erken bitmez.`
            ) : paced ? (
              `Lig en fazla ${lengthText(length)} sürer. Bitiş, son tur açıldıktan sonraya kendiliğinden ayarlandı; son turun maçları için pay bırakmak istersen ileri al. Bütün maçlar daha önce biterse sonuç beklenmeden yazılır.`
            ) : (
              `Turnuva en fazla ${lengthText(length)} sürer. Maçlar daha önce biterse sonuç beklenmeden yazılır; bu saatte süren maçlar kapanır.`
            )}
          </span>
        </label>
        {!pointsLeague && lengthChoices.length > 0 && (
          <label className={labelCls}>
            Maç uzunluğu
            <select name="matchLength" value={matchLength ?? lengthChoices[0].value} onChange={(e) => setMatchLength(Number(e.target.value))} className={field}>
              {lengthChoices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="font-normal" aria-live="polite">
              {matchLengthOf(game, matchLength)?.hint} Uzun maç seçersen bitiş saatini de ona göre ileri al: bitiş saatinde süren maçlar kapanır.
            </span>
          </label>
        )}
        {!pointsLeague && (
          <label className={labelCls}>
            Maça giriş süresi
            <select name="joinMinutes" defaultValue={from?.joinMinutes ?? DEFAULT_JOIN_MINUTES} className={field}>
              {JOIN_MINUTES.map((n) => (
                <option key={n} value={n}>
                  {n} dakika
                </option>
              ))}
            </select>
            <span className="font-normal">
              {shared
                ? 'Masa açılınca oyuncunun masaya girmesi için tanınan süre. Girmeyen elenir, koltuğuna bot oturur ve masa onsuz oynanır; kimse girmezse masa herkes için kayıp sayılır.'
                : 'Maç açılınca oyuncunun masaya girmesi için tanınan süre. Girmeyen maçı hükmen kaybeder; ikisi de girmezse ikisi de kaybeder.'}
              {paced && ' Günlük ve haftalık ligde oyuncu maçını bildirimle öğrenir; kısa süre çok hükmen sonuç çıkarır, 30 ya da 60 dakika seçmeni öneririz.'}
            </span>
          </label>
        )}
        <label className={labelCls}>
          Kontenjan (oyuncu)
          <select name="maxPlayers" value={maxPlayers} onChange={(e) => reshape({ players: Number(e.target.value) })} className={field}>
            {playerOptions(format, seats).map((n) => (
              <option key={n} value={n}>
                {n} oyuncu{shared && format === 'eleme' ? ` · ${n / seats} masa` : ''}
              </option>
            ))}
          </select>
          <span className="font-normal">
            {pointsLeague
              ? 'Puan liginde eşleşme yok; kontenjan sadece kaç kişinin kaydolabileceğini belirler. Sıralama ödülleri bu sayıya kadar yazılabilir.'
              : shared
                ? `Kontenjan dolarsa her masada ${seats} gerçek oyuncu olur. Dolmazsa oyuncular masalara eşit dağıtılır: ${TABLE_PASS} ya da daha az oyuncusu olan masa oynanmaz, oyuncuları tur atlar; 3 oyunculu masada boş koltuğa bot oturur. Bot tur atlayamaz, ödül alamaz.`
                : format === 'eleme'
                  ? 'Eleme tablosu boş maç kalmadan dolsun diye 2 ve katları seçilir.'
                  : `Ligde kimse tur boş geçmesin diye çift sayı seçilir. Kontenjan büyüdükçe tur sayısı artar: ${maxPlayers} oyuncuda ${rounds} tur${paced ? `, yani ${rounds} ${league.pace === 'gunluk' ? 'gün' : 'hafta'}` : ''}.`}
            {legacySize && ` Bu kayıt eski kuralla ${from?.maxPlayers} kişilikti; en yakın uygun sayıya çekildi.`}
          </span>
        </label>
        <label className={labelCls}>
          Katılım ücreti (KC, 0 = ücretsiz)
          <input type="number" name="entryFee" min={0} max={100000} required defaultValue={from?.entryFee ?? 100} className={field} />
        </label>
        <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:col-span-2">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Sıralama ödülleri (KC)</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((value, i) => {
              const place = places[i]
              return (
                <label key={`${format}-${seats}-${i}`} className={labelCls}>
                  <span>
                    <span className="text-foreground">{place.label}</span> {place.hint}
                  </span>
                  <input
                    type="number"
                    name={`prize${i}`}
                    min={0}
                    max={MAX_PRIZE_KC}
                    required
                    value={value}
                    onChange={(e) => setPrizes(rows.map((v, j) => (j === i ? e.target.value : v)))}
                    className={field}
                  />
                  {place.count > 1 && (
                    <span className="font-normal">
                      {`En fazla ${place.count} oyuncu · bu sıraya toplam ${(amounts[i] * place.count).toLocaleString('tr-TR')} KC`}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextPlace && (
              <button
                type="button"
                onClick={() => setPrizes([...rows, '0'])}
                className="flex items-center gap-1.5 rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-foreground hover:bg-primary/10"
              >
                <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                {`Kazanan sıra ekle: ${nextPlace.label} ${nextPlace.hint.replace(', kişi başı', '')}`}
              </button>
            )}
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setPrizes(rows.slice(0, -1))}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary"
              >
                <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                {`Son sırayı kaldır (${places[rows.length - 1].label})`}
              </button>
            )}
            {!nextPlace && <span className="text-xs text-muted-foreground">Bu kontenjanda ödül yazılabilecek bütün sıralar eklendi.</span>}
          </div>
          <p className={cn('text-xs leading-relaxed text-muted-foreground', total > MAX_PRIZE_POOL_KC && 'text-destructive')} aria-live="polite">
            Toplam ödül havuzu: <span className={cn('font-bold', total > MAX_PRIZE_POOL_KC ? 'text-destructive' : 'text-foreground')}>{total.toLocaleString('tr-TR')} KC</span>.{' '}
            {total > MAX_PRIZE_POOL_KC
              ? `Havuz en fazla ${MAX_PRIZE_POOL_KC.toLocaleString('tr-TR')} KC olabilir; kişi başı yazılan sıraların tutarını düşür.`
              : 'Sitede bu toplam gösterilir. Turnuva bitince her sıranın ödülü o oyuncunun hesabına kendiliğinden yüklenir. İstediğin kadar kazanan sıra ekleyebilirsin; ödül vermek istemediğin sırayı 0 bırak.'}
            {pointsLeague
              ? ' Puan liginde her sıra tek oyuncudur, bitiş saatindeki puan tablosuna göre belirlenir. Sayılan bir oyunu olmayan oyuncu ödül alamaz; o sıranın ödülü ödenmez.'
              : shared
                ? ` Final masası tek tek sıralanır (1. - ${seats}.); daha önceki turda elenenler aynı ödülü alır.`
                : format === 'eleme'
                  ? ' Elemede üçüncülük maçı oynanmaz: aynı turda elenenler aynı ödülü alır, tutar kişi başıdır.'
                  : ' Ligde her sıra tek oyuncudur, puan durumuna göre belirlenir.'}
          </p>
        </fieldset>
        <label className={cn(labelCls, 'sm:col-span-2')}>
          Ödül notu (isteğe bağlı)
          <input name="prizeNote" maxLength={120} defaultValue={from?.prizeNote} placeholder="1. 3.000 KC · 2. 1.500 KC · 3. 500 KC" className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {t ? 'Değişiklikleri kaydet' : 'Turnuvayı oluştur'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

/** Players are paired and fees are paid: only the end time and the two texts can still change. */
function RunningForm({ t }: { t: Tournament }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTournament, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="tz" value={ISTANBUL_OFFSET} />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Turnuva başladı: oyun, format, lig ayarları, kontenjan, ücret, ödüller, maç uzunluğu ve maça giriş süresi artık değişmez. Bitiş saatini, açıklamayı ve ödül notunu değiştirebilirsin.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Bitiş (İstanbul saati)
          <input
            type="datetime-local"
            name="endsAt"
            required
            defaultValue={toIstanbulInput(t.endsAt ? Date.parse(t.endsAt) : Math.ceil((Date.now() + DEFAULT_LENGTH) / QUARTER) * QUARTER)}
            className={field}
          />
          <span className="font-normal">
            {t.format === 'puan'
              ? `Değiştirirsen şu andan en az ${MIN_TOURNAMENT_MINUTES} dakika sonrası olmalı. Lig bu saatte kapanır ve ödüller o anki puan tablosuna göre ödenir.`
              : t.endsAt
                ? `Değiştirirsen şu andan en az ${MIN_TOURNAMENT_MINUTES} dakika sonrası olmalı. Bu saatte süren maçlar kapanır ve sonuç yazılır.${
                    t.format === 'lig' && PACE_MS[t.league.pace] ? ' Günlük ya da haftalık ligde bitişi öne alırsan açılmamış turlar oynanmaz; o anki puan durumu geçerli olur.' : ''
                  }`
                : 'Bu turnuvanın bitiş saati yoktu. Kaydedersen bu saatte kapanır. Şu an açık olan eski maçlarda giriş süresi işlemez; bundan sonra açılan maçlarda işler.'}
          </span>
        </label>
        <label className={labelCls}>
          Ödül notu (isteğe bağlı)
          <input name="prizeNote" maxLength={120} defaultValue={t.prizeNote} className={field} />
        </label>
        <label className={cn(labelCls, 'sm:col-span-2')}>
          Açıklama
          <textarea name="description" rows={2} maxLength={400} defaultValue={t.description} className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Değişiklikleri kaydet
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

function WinnerPicker({ t, round, match, players, winner }: { t: Tournament; round: number; match: number; players: (string | null)[]; winner: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(pickMatchWinner, {})
  const real = players.filter((p): p is string => Boolean(p))
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="match" value={match} />
      <label className="sr-only" htmlFor={`w-${t.id}-${round}-${match}`}>
        Kazanan
      </label>
      <select
        id={`w-${t.id}-${round}-${match}`}
        name="winner"
        key={winner ?? ''}
        defaultValue={winner ?? ''}
        disabled={pending || real.length < 2}
        onChange={(e) => {
          const select = e.currentTarget
          const picked = select.value
          if (!picked) {
            select.value = winner ?? ''
            return
          }
          void askConfirm(
            t.tableSize > 2
              ? `"${t.names[picked] ?? picked}" bu masanın birincisi olarak işaretlensin mi? Masa kapanır; diğer oyuncular oyunun o anki durumuna göre sıralanır ve tur atlayanlar buna göre belirlenir. Bu final masasıysa turnuva biter ve ödüller hemen ödenir; geri alınamaz.`
              : `"${t.names[picked] ?? picked}" bu maçın kazananı olarak işaretlensin mi? Bu son maçsa turnuva biter ve ödül havuzu hemen ödenir; geri alınamaz.`,
          ).then((ok) => {
            if (ok) select.form?.requestSubmit()
            else select.value = winner ?? ''
          })
        }}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
      >
        <option value="">{t.tableSize > 2 ? 'Masa birincisini seç' : 'Kazanan seç'}</option>
        {real.map((p, i) => (
          <option key={`${i}-${p}`} value={p}>
            {t.names[p] ?? p}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />}
      {!state.ok && state.message && (
        <span role="alert" className="text-xs font-semibold text-destructive">
          {state.message}
        </span>
      )}
    </form>
  )
}

function TournamentRow({ t, hidden }: { t: Tournament; hidden: boolean }) {
  const running = t.status === 'basladi'
  const order = t.entries.map((e) => e.userId ?? `misafir:${e.nickname}`)
  const playing = running && t.bracket ? openRound(t.bracket) : -1
  /** A result can be named only for a match of the round being played: a written one never changes. */
  const canPick = (round: number, m: Match) => round === playing && isRealMatch(m) && !isDecided(m)
  const points = t.format === 'puan'
  const shape = points
    ? `${SOURCE_LABEL[t.league.source].toLocaleLowerCase('tr')} · ${t.league.maxGames ? `ilk ${t.league.maxGames} oyun` : 'oyun sınırı yok'}`
    : t.format === 'lig'
      ? `${PACE_SHORT[t.league.pace]} · ${t.league.legs === 2 ? 'çift devre' : 'tek devre'}`
      : t.tableSize > 2
        ? `${t.tableSize} kişilik masa`
        : 'birebir'
  return (
    <article data-find={`tournament-${t.id}`} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {ARENA_META[t.game].title} · {FORMAT_SHORT[t.format]} · {shape} · {STATUS_LABEL[t.status]}
          </span>
          <h3 className="font-display text-xl font-bold uppercase text-foreground">{t.title}</h3>
          <p className="text-xs capitalize text-muted-foreground">
            {formatTR(t.startsAt)} · {t.entries.length}/{t.maxPlayers} oyuncu · {t.entryFee} KC giriş · {t.prizePool} KC ödül
          </p>
          <p className="text-xs text-muted-foreground">
            {t.endsAt ? (
              <>
                Bitiş: <span className="capitalize">{formatTR(t.endsAt)}</span>
              </>
            ) : (
              'Bitiş saati yok (eski turnuva): kendiliğinden kapanmaz'
            )}
            {!points && ` · maça giriş ${t.joinMinutes} dk`}
            {!points && matchLengthOf(t.game, t.matchLength) && ` · maç: ${matchLengthOf(t.game, t.matchLength)?.label.toLocaleLowerCase('tr')}`}
          </p>
          {running && t.nextRoundAt && (
            <p className="text-xs font-semibold text-foreground">
              Sıradaki tur: <span className="capitalize">{formatTR(t.nextRoundAt)}</span>
            </p>
          )}
          {t.finishReason && (
            <p className="text-xs font-semibold text-foreground">
              {t.status === 'iptal' ? 'İptal nedeni' : 'Kapanış'}: {FINISH_LABEL[t.finishReason]}
              {t.finishedAt && <span className="font-normal capitalize text-muted-foreground"> · {formatTR(t.finishedAt)}</span>}
            </p>
          )}
          {t.winner && <p className="text-sm font-bold text-primary">Şampiyon: {t.winner}</p>}
          <PrizeList t={t} className="mt-1" />
        </div>
        <div className="flex flex-wrap gap-2">
          {t.status === 'kayit' && (
            <ActionButton
              act={beginTournament}
              fields={{ id: t.id }}
              variant="primary"
              confirm={
                points
                  ? 'Başlangıç saati beklenmeden kayıtlar kapanacak ve puan ligi hemen başlayacak. Bu andan sonra biten oyunlar sayılır.'
                  : t.format === 'lig' && PACE_MS[t.league.pace]
                    ? `Başlangıç saati beklenmeden kayıtlar kapanacak ve ilk tur hemen açılacak. Sonraki turlar yine kayıtlı başlangıç saatine göre açılır. Oyuncuların masaya girmek için ${t.joinMinutes} dakikası olur.`
                    : `Başlangıç saati beklenmeden kayıtlar kapanacak ve tüm oyuncular hemen eşleşecek. Oyuncuların masaya girmek için ${t.joinMinutes} dakikası olur.`
              }
            >
              <Play className="size-3.5" aria-hidden="true" />
              Kayıtları kapat ve başlat
            </ActionButton>
          )}
          {(t.status === 'kayit' || t.status === 'basladi') && (
            <ActionButton act={stopTournament} fields={{ id: t.id }} variant="danger" confirm="Turnuva iptal edilecek, açık maçlar kapanacak ve kayıt ücretleri iade edilecek.">
              İptal et
            </ActionButton>
          )}
          <HideButton kind="tournament" id={t.id} hidden={hidden} label={t.title} className="px-3 py-2" />
          <ActionButton act={removeTournament} fields={{ id: t.id }} variant="danger" confirm="Turnuva ve tüm kayıtlar silinecek.">
            <Trash2 className="size-3.5" aria-hidden="true" />
            Sil
          </ActionButton>
        </div>
      </div>

      {t.bracket && t.format === 'lig' && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-bold text-foreground">
            {running ? 'Puan durumu ve fikstür (açık bir maçta kazananı elle seçebilirsin; tur bitince sonraki tur açılır)' : 'Puan durumu ve fikstür'}
          </h4>
          <LeagueView
            bracket={t.bracket}
            names={t.names}
            order={order}
            schedule={{ startsAt: t.startsAt, pace: t.league.pace }}
            renderPick={(r, m, match) => (canPick(r, match) ? <WinnerPicker t={t} round={r} match={m} players={match.players} winner={null} /> : null)}
          />
        </div>
      )}
      {points && t.points && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-bold text-foreground">
            {running ? 'Puan durumu (oyuncuların kendi oyunlarından; lig bitiş saatinde kapanır ve ödüller bu sıraya göre ödenir)' : 'Puan durumu'}
          </h4>
          <PointsView rows={t.points} names={t.names} maxGames={t.league.maxGames} closed={!running} />
        </div>
      )}
      {t.bracket && t.format === 'eleme' && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-bold text-foreground">
            {!running
              ? t.tableSize > 2
                ? 'Masalar'
                : 'Eşleşmeler'
              : t.tableSize > 2
                ? `Masalar (her masanın ilk ${t.bracket.pass ?? TABLE_PASS} oyuncusu tur atlar; açık bir masada birinciyi elle seçebilirsin)`
                : 'Eşleşmeler (açık bir maçta kazananı elle seçebilirsin; kazanan bir üst tura geçer)'}
          </h4>
          <BracketView
            bracket={t.bracket}
            names={t.names}
            closed={!running}
            renderPick={(r, m, match) => {
              if (!canPick(r, match)) return null
              if (t.tableSize <= 2) return <WinnerPicker t={t} round={r} match={m} players={match.players} winner={null} />
              // A shared table's result is read from the open table, so only the players still seated at it can be named.
              const open = t.liveMatches.find((live) => live.round === r && live.match === m && live.status === 'oynaniyor')
              return open ? <WinnerPicker t={t} round={r} match={m} players={open.players} winner={null} /> : null
            }}
          />
          <h4 className="mt-2 text-sm font-bold text-foreground">Oyuncu durumu</h4>
          <PlayerStats bracket={t.bracket} names={t.names} order={order} closed={!running} />
        </div>
      )}

      {t.bracket && !points && <TournamentMatches id={t.id} running={running} />}

      <details className="group rounded-xl border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Katılımcılar ({t.entries.length})</summary>
        {t.entries.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Henüz kayıt yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {t.entries.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="font-semibold text-foreground">{e.nickname}</span>
                  <span className="text-muted-foreground">{e.telegram}</span>
                </span>
                {t.status === 'kayit' && (
                  <ActionButton act={kickEntry} fields={{ entryId: e.id }} variant="danger" confirm={`${e.nickname} turnuvadan çıkarılsın mı? Katılım ücreti iade edilir.`}>
                    <UserX className="size-3.5" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Çıkar</span>
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>

      {t.status === 'kayit' && (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Bilgileri düzenle</summary>
          <div className="border-t border-border p-4">
            <TournamentForm t={t} />
          </div>
        </details>
      )}
      {t.status === 'basladi' && (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Bitiş saatini ve yazıları düzenle</summary>
          <div className="border-t border-border p-4">
            <RunningForm t={t} />
          </div>
        </details>
      )}

      <details className="rounded-xl border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Şablon olarak kaydet</summary>
        <div className="border-t border-border p-4">
          <TemplateSaver t={t} />
        </div>
      </details>
    </article>
  )
}

function TemplateSaver({ t }: { t: Tournament }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(keepTournamentTemplate, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={t.id} />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Oyun, format, lig ayarları (tur aralığı, devre, sayılan oyunlar), ad, açıklama, kontenjan, ücret, ödül, başlangıç saati, turnuvanın süresi (başlangıçtan bitişe), maç uzunluğu ve maça giriş süresi saklanır. Tarih, oyuncular ve sonuçlar saklanmaz. Aynı adla kaydedersen eski şablonun üzerine yazılır.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className={cn(labelCls, 'min-w-0 flex-1 basis-60')}>
          Şablon adı
          <input name="name" required minLength={3} maxLength={60} defaultValue={t.title.slice(0, 60)} className={field} />
        </label>
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BookmarkPlus className="size-4" aria-hidden="true" />}
          Şablonu kaydet
        </button>
      </div>
      <Feedback state={state} />
    </form>
  )
}

function TemplatePicker({ templates, picked, onPick }: { templates: TournamentTemplate[]; picked: TournamentTemplate | null; onPick: (t: TournamentTemplate | null) => void }) {
  if (templates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Henüz şablon yok. Aşağıdaki bir turnuvada &quot;Şablon olarak kaydet&quot;e basarsan, aynı ayarlarla yenisini buradan tek tıkla açarsın.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
      <span className="text-xs font-semibold text-muted-foreground">Şablondan doldur (form dolar, tarihi kontrol edip oluştur)</span>
      <ul className="flex flex-wrap gap-2">
        {templates.map((tpl) => (
          <li key={tpl.id} className="flex items-stretch overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              aria-pressed={picked?.id === tpl.id}
              onClick={() => onPick(picked?.id === tpl.id ? null : tpl)}
              className={cn('flex flex-col items-start gap-0.5 px-3 py-2 text-left text-sm font-semibold', picked?.id === tpl.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary')}
            >
              {tpl.name}
              <span className={cn('text-xs font-normal', picked?.id === tpl.id ? 'text-primary-foreground' : 'text-muted-foreground')}>
                {ARENA_META[tpl.game].title} · {FORMAT_SHORT[tpl.format]} · {tpl.maxPlayers} kişi · {tpl.startTime} · {lengthText(tpl.lengthMinutes)}
              </span>
            </button>
            <TemplateRemover tpl={tpl} onDone={() => picked?.id === tpl.id && onPick(null)} />
          </li>
        ))}
      </ul>
      {picked && (
        <button type="button" onClick={() => onPick(null)} className="self-start text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Şablonu bırak, boş formla devam et
        </button>
      )}
    </div>
  )
}

function TemplateRemover({ tpl, onDone }: { tpl: TournamentTemplate; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const result = await dropTournamentTemplate(prev, form)
    if (result.ok) onDone()
    return result
  }, {})
  return (
    <form
      action={action}
      className="flex border-l border-border"
      onSubmit={(e) => {
        const form = e.currentTarget
        if (form.dataset.confirmed === '1') {
          delete form.dataset.confirmed
          return
        }
        e.preventDefault()
        void askConfirm(`"${tpl.name}" şablonu silinsin mi? Bu şablonla açılmış turnuvalar etkilenmez.`).then((ok) => {
          if (!ok) return
          form.dataset.confirmed = '1'
          form.requestSubmit()
        })
      }}
    >
      <input type="hidden" name="id" value={tpl.id} />
      <button type="submit" disabled={pending} aria-label={`${tpl.name} şablonunu sil`} className="flex w-10 items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
      </button>
      {!state.ok && state.message && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  )
}

export function TournamentManager({ tournaments, templates = [], hidden = [] }: { tournaments: Tournament[]; templates?: TournamentTemplate[]; hidden?: string[] }) {
  const [picked, setPicked] = useState<TournamentTemplate | null>(null)
  const [opened, setOpened] = useState<ActionState>({})
  const pick = (tpl: TournamentTemplate | null) => {
    setOpened({})
    setPicked(tpl)
  }
  return (
    <div className="flex flex-col gap-6">
      <TournamentGuide />
      <section className="flex flex-col gap-4 rounded-2xl border border-primary/40 bg-card p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Yeni turnuva oluştur</h2>
          <p className="text-sm text-muted-foreground">
            Oluşturduğun turnuva hemen /turnuvalar sayfasında kayda açılır. Başlangıç saatinde kendiliğinden başlar, bitiş saatinde kesin kapanır. Eşleşmeler kura ile çekilir. Okey, Tavla, Bilardo, Kafa Topu ve Kafa Basketbolu birebir; 101 Okey, Batak, Pişti ve Jakopoly 4 kişilik ortak masalarda oynanır.
          </p>
        </div>
        <TemplatePicker templates={templates} picked={picked} onPick={pick} />
        <TournamentForm
          key={picked ? `tpl-${picked.id}` : 'blank'}
          preset={picked ?? undefined}
          onCreated={(state) => {
            setPicked(null)
            setOpened(state)
          }}
        />
        <Feedback state={opened} />
      </section>
      {tournaments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz turnuva yok.</p>
      ) : (
        tournaments.map((t) => <TournamentRow key={t.id} t={t} hidden={hidden.includes(String(t.id))} />)
      )}
    </div>
  )
}
