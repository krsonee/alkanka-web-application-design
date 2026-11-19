'use client'

import { useActionState, useRef, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_GAMES, ARENA_META, type ArenaGame } from '@/lib/arena'
import {
  DEFAULT_JOIN_MINUTES,
  DEFAULT_LEAGUE,
  DEFAULT_POINTS_MINUTES,
  DEFAULT_TOURNAMENT_MINUTES,
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
import { MAX_LEAGUE_PLAYERS } from '@/lib/league'
import { saveTournament } from '@/app/panel/arena-actions'
import type { ActionState } from '@/app/panel/actions'
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

export function lengthText(minutes: number) {
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = Math.round(minutes % 60)
  return [days && `${days} gün`, hours && `${hours} saat`, rest && `${rest} dakika`].filter(Boolean).join(' ')
}

export const field = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
export const labelCls = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'

export function Feedback({ state }: { state: ActionState }) {
  return <Flash ok={state.ok} text={state.message} token={state} className="font-semibold" />
}

/** Prize rows a form opens with; more are added one place at a time. */
const START_PRIZE_ROWS = 3

/** Tomorrow in Istanbul at the template's hour, so a weekly cup reopens with one date change at most. */
function tomorrowAt(time: string) {
  return `${new Date(Date.now() + 27 * 3600000).toISOString().slice(0, 10)}T${time}`
}

const STEPS = ['Oyun ve düzen', 'Ad ve zaman', 'Kontenjan ve ödül', 'Özet']
const LAST_STEP = STEPS.length - 1

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
const firstInvalid = (root: ParentNode) => Array.from(root.querySelectorAll<FormField>('input, select, textarea')).find((el) => !el.checkValidity())

/**
 * One form in four steps. Every step stays in the page (hidden ones included), so nothing typed is
 * lost when moving between them and the whole form is sent at once. A new tournament is created from
 * the last step, after the summary; an existing one can be saved from any step.
 */
export function TournamentForm({
  t,
  preset,
  onCreated,
  onSaved,
}: {
  t?: Tournament
  preset?: TournamentTemplate
  onCreated?: (state: ActionState) => void
  onSaved?: () => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const next = await saveTournament(prev, form)
    if (next.ok) {
      if (t) onSaved?.()
      else onCreated?.(next)
    }
    return next
  }, {})
  const from = t ?? preset
  const formRef = useRef<HTMLFormElement>(null)
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState(from?.title ?? '')
  const [entryFee, setEntryFee] = useState(String(from?.entryFee ?? 100))
  const [joinMinutes, setJoinMinutes] = useState(from?.joinMinutes ?? DEFAULT_JOIN_MINUTES)
  /** Opens the step a field sits in and lets the browser say what is wrong with it. */
  const showInvalid = (el: FormField) => {
    setStep(Number(el.closest<HTMLElement>('[data-step]')?.dataset.step ?? step))
    // A hidden field cannot show its message; wait for its step to be on screen.
    window.setTimeout(() => el.reportValidity(), 60)
  }
  const goNext = () => {
    const here = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`)
    const bad = here ? firstInvalid(here) : undefined
    if (bad) return void bad.reportValidity()
    setStep(Math.min(LAST_STEP, step + 1))
  }
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Enter in a field of an earlier step moves on; a new tournament is only created from the summary.
    if (!t && step < LAST_STEP) {
      e.preventDefault()
      goNext()
      return
    }
    const bad = firstInvalid(e.currentTarget)
    if (bad) {
      e.preventDefault()
      showInvalid(bad)
    }
  }
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
    <form ref={formRef} action={action} noValidate data-no-guard onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={t?.id ?? 0} />
      <input type="hidden" name="tz" value={ISTANBUL_OFFSET} />
      <input type="hidden" name="rules" value={from?.rules ?? ''} />
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="Form adımları">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
              className={cn(
                'flex h-full w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                i === step ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary',
              )}
            >
              <span className="text-xs font-semibold text-muted-foreground">{`Adım ${i + 1}`}</span>
              <span className="text-xs font-bold leading-tight text-foreground">{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div data-step={0} className={cn('grid gap-4 sm:grid-cols-2', step !== 0 && 'hidden')}>
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
                {ARENA_META[g].title}
                {/* A points league seats nobody, so the table size says nothing there. */}
                {pointsLeague ? '' : ` · ${(tournamentSeats(g) ?? 2) > 2 ? `${tournamentSeats(g)} kişilik masa` : 'birebir'}`}
              </option>
            ))}
          </select>
          <span className={cn('font-normal', !canHostTournament(game) && 'text-destructive')}>
            {!canHostTournament(game)
              ? 'Bu oyunda artık turnuva açılmıyor. Listeden başka bir oyun seç.'
              : pointsLeague
                ? `Puan liginde turnuva masası açılmaz, 2 kişi şartı da yoktur: oyuncular ${ARENA_META[game].title} oyunlarını her zamanki masalarda oynar, masa kaç kişilik olursa olsun sonuç puan tablosuna yazılır. Sadece ${ARENA_META[game].title} sayılır; başka oyunlar bu lige puan yazmaz.`
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
                : `Eşleşme ve fikstür yok. Lig süresince kayıtlı oyuncuların kendi oynadığı ${ARENA_META[game].title} oyunları sayılır: galibiyet 3, beraberlik 1 puan. Bitiş saatinde ilk sıralar ödülü alır. Günlerce süren lig için uygun olan budur.`}
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
              Sayılan {ARENA_META[game].title} masaları
              <select name="source" value={league.source} onChange={(e) => setLeague({ ...league, source: e.target.value as PointSource })} className={field}>
                {POINT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
              <span className={cn('font-normal', league.source === 'hepsi' && 'text-destructive')} aria-live="polite">
                {league.source === 'pvp'
                  ? `Masada en az iki üye varsa ${ARENA_META[game].title} oyunu sayılır; masa 2 ya da 4 kişilik olabilir, boş koltuklara bot oturmuş olabilir. Tek üyenin sadece botlarla oynadığı masa ve turnuva maçları sayılmaz. Sonucu sunucu yazar.`
                  : 'Sadece botlara karşı oynanan oyunlar da sayılır. Bot maçlarının bir kısmında sonucu oyuncunun tarayıcısı bildirir; ödüllü ligde bu seçenek hileye açıktır.'}
              </span>
            </label>
            <label className={labelCls}>
              Oyuncu başına sayılacak {ARENA_META[game].title} oyunu
              <select name="maxGames" value={league.maxGames} onChange={(e) => setLeague({ ...league, maxGames: Number(e.target.value) })} className={field}>
                {POINT_GAME_CAPS.map((n) => (
                  <option key={n} value={n}>
                    {n ? `İlk ${n} ${ARENA_META[game].title} oyunu` : `Sınır yok: oynadığı her ${ARENA_META[game].title} oyunu sayılır`}
                  </option>
                ))}
              </select>
              <span className="font-normal" aria-live="polite">
                {league.maxGames
                  ? `Her oyuncunun lig başladıktan sonraki ilk ${league.maxGames} ${ARENA_META[game].title} oyunu sayılır, sonrakiler puan getirmez. Herkes aynı sayıda oyunla yarışır.`
                  : `Sayı sınırı yok: çok ${ARENA_META[game].title} oynayan öne geçer. İki hesabın birbirine oyun vermesini de sınırlamak istersen bir sınır seç.`}{' '}
                Başka oyunlar hiçbir durumda sayılmaz.
              </span>
            </label>
          </>
        )}
      </div>
      <div data-step={1} className={cn('grid gap-4 sm:grid-cols-2', step !== 1 && 'hidden')}>
        <label className={cn(labelCls, 'sm:col-span-2')}>
          Turnuva adı
          <input name="title" required minLength={3} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cuma Akşamı Tavla Kupası" className={field} />
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
            <select name="joinMinutes" value={joinMinutes} onChange={(e) => setJoinMinutes(Number(e.target.value))} className={field}>
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
      </div>
      <div data-step={2} className={cn('grid gap-4 sm:grid-cols-2', step !== 2 && 'hidden')}>
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
          <input type="number" name="entryFee" min={0} max={100000} required value={entryFee} onChange={(e) => setEntryFee(e.target.value)} className={field} />
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
      <div data-step={3} className={cn('flex flex-col gap-3', step !== 3 && 'hidden')}>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-xl border border-border p-4 text-sm">
          {(
            [
              ['Turnuva', title.trim().length >= 3 ? title.trim() : null],
              ['Oyun', ARENA_META[game].title],
              [
                'Düzen',
                pointsLeague
                  ? `${FORMAT_SHORT.puan} · ${SOURCE_LABEL[league.source].toLocaleLowerCase('tr')} · ${league.maxGames ? `ilk ${league.maxGames} oyun` : 'oyun sınırı yok'}`
                  : fixtures
                    ? `${FORMAT_SHORT.lig} · ${PACE_SHORT[league.pace]} · ${league.legs === 2 ? 'çift devre' : 'tek devre'} · ${rounds} tur`
                    : `${FORMAT_SHORT.eleme} · ${shared ? `${seats} kişilik masalar` : 'birebir'}`,
              ],
              ['Başlangıç', Number.isNaN(startMs) ? null : inputDayText(startMs)],
              ['Bitiş', Number.isNaN(length) || length < MIN_TOURNAMENT_MINUTES || tooShort ? null : `${inputDayText(inputMs(times.end))} · ${lengthText(length)}`],
              ['Kontenjan', `${maxPlayers} oyuncu`],
              ['Katılım ücreti', Number(entryFee) > 0 ? `${Number(entryFee).toLocaleString('tr-TR')} KC` : 'Ücretsiz'],
              ['Ödül havuzu', total > MAX_PRIZE_POOL_KC ? null : `${total.toLocaleString('tr-TR')} KC · ${amounts.filter((n) => n > 0).length} sıraya ödül`],
              ...(pointsLeague ? [] : [['Maça giriş süresi', `${joinMinutes} dakika`] as [string, string]]),
              ...(!pointsLeague && matchLengthOf(game, matchLength) ? [['Maç uzunluğu', matchLengthOf(game, matchLength)?.label ?? ''] as [string, string]] : []),
            ] as [string, string | null][]
          ).map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="text-xs font-semibold text-muted-foreground">{name}</dt>
              <dd className={cn('min-w-0 font-semibold first-letter:uppercase', value ? 'text-foreground' : 'text-destructive')}>{value ?? 'Eksik ya da hatalı: ilgili adımı kontrol et'}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t
            ? 'Kaydedince değişiklikler /turnuvalar sayfasına hemen yansır.'
            : `Oluşturduğun ${pointsLeague ? 'lig' : 'turnuva'} hemen /turnuvalar sayfasında kayda açılır, başlangıç saatinde kendiliğinden başlar, bitiş saatinde kesin kapanır.`}
        </p>
      </div>
      <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3 sm:-mx-5 sm:px-5">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
          className="flex items-center gap-1 rounded-xl border border-border px-3.5 py-2.5 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Geri
        </button>
        {step < LAST_STEP && (
          <button
            type="button"
            onClick={goNext}
            className={cn(
              'flex items-center gap-1 rounded-xl px-3.5 py-2.5 text-sm font-bold',
              t ? 'border border-border text-foreground hover:bg-secondary' : 'bg-primary text-primary-foreground',
            )}
          >
            İleri
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        )}
        {(t || step === LAST_STEP) && (
          <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : t ? <Save className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {t ? 'Değişiklikleri kaydet' : 'Turnuvayı oluştur'}
          </button>
        )}
        <Feedback state={state} />
      </div>
    </form>
  )
}

/** Players are paired and fees are paid: only the end time and the two texts can still change. */
export function RunningForm({ t, onSaved }: { t: Tournament; onSaved?: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const next = await saveTournament(prev, form)
    if (next.ok) onSaved?.()
    return next
  }, {})
  return (
    <form action={action} data-no-guard className="flex flex-col gap-4">
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
