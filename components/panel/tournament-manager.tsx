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
  FINISH_LABEL,
  FORMAT_LABEL,
  FORMAT_SHORT,
  JOIN_MINUTES,
  MIN_TOURNAMENT_MINUTES,
  STATUS_LABEL,
  TABLE_PASS,
  canHostTournament,
  formatsFor,
  minEntrants,
  tournamentSeats,
  type Tournament,
  type TournamentFormat,
  type TournamentTemplate,
} from '@/lib/tournaments-shared'
import { MAX_PRIZE_KC, effectivePrizes, isPlayerCount, playerOptions, prizePlaces, prizeTotal, snapPlayers } from '@/lib/tournament-prizes'
import { PrizeList } from '@/components/alkanka/arena/prize-list'
import { MAX_LEAGUE_PLAYERS } from '@/lib/league'
import { LeagueView } from '@/components/alkanka/arena/league-view'
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
const DEFAULT_LENGTH = 180 * MINUTE

/** A moment as the text a `datetime-local` field shows for Istanbul. */
const toIstanbulInput = (ms: number) => new Date(ms + 3 * 3600000).toISOString().slice(0, 16)
const inputMs = (value: string) => Date.parse(`${value}:00Z`)
const shiftInput = (value: string, ms: number) => (Number.isNaN(inputMs(value)) ? value : new Date(inputMs(value) + ms).toISOString().slice(0, 16))

/** A new tournament starts on the next quarter hour that is at least an hour away, not a day later. */
const defaultStart = () => Math.ceil((Date.now() + 3600000) / QUARTER) * QUARTER

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
  const [prizes, setPrizes] = useState<string[]>(() => (from ? effectivePrizes(from) : [5000]).map(String))
  const places = prizePlaces(format, maxPlayers, seats)
  const total = prizeTotal(format, maxPlayers, places.map((_, i) => Math.max(0, Math.round(Number(prizes[i]) || 0))), seats)
  const legacySize = Boolean(from && !isPlayerCount(format, from.maxPlayers, seats))
  const legacyFormat = Boolean(from && from.format !== format && from.game === game)
  const [times, setTimes] = useState(() => {
    const start = preset ? tomorrowAt(preset.startTime) : toIstanbulInput(t ? Date.parse(t.startsAt) : defaultStart())
    return { start, end: t?.endsAt ? toIstanbulInput(Date.parse(t.endsAt)) : shiftInput(start, DEFAULT_LENGTH) }
  })
  const length = (inputMs(times.end) - inputMs(times.start)) / MINUTE
  const games = ARENA_GAMES.filter((g) => canHostTournament(g) || g === from?.game)
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
              setFormat(nextFormat)
              setMaxPlayers((n) => snapPlayers(nextFormat, n, tournamentSeats(next) ?? 2))
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
              setFormat(next)
              setMaxPlayers((n) => snapPlayers(next, n, seats))
            }}
            className={field}
          >
            {formats.map((f) => (
              <option key={f} value={f}>
                {shared ? `Eleme (${seats} kişilik masalar, ilk ${TABLE_PASS} tur atlar)` : FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
          <span className="font-normal">
            {shared
              ? 'Ortak masalarda oynanan oyunlarda lig düzeni yok.'
              : `Lig formatında en fazla ${MAX_LEAGUE_PLAYERS} oyuncu, en çok puanı toplayan şampiyon olur.`}
            {legacyFormat && ' Bu kayıt lig düzenindeydi; bu oyunda lig olmadığı için eleme seçildi.'}
          </span>
        </label>
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
            {preset ? 'Şablondaki saatle yarına ayarlandı. Tarihi kontrol et. ' : ''}
            Kayıtlar bu saatte kapanır ve turnuva kendiliğinden başlar. {minEntrants(seats)} kişiden az kayıt varsa iptal olur, ücretler iade edilir.
          </span>
        </label>
        <label className={labelCls}>
          Bitiş (İstanbul saati)
          <input type="datetime-local" name="endsAt" required value={times.end} onChange={(e) => setTimes((now) => ({ ...now, end: e.target.value }))} className={field} />
          <span className={cn('font-normal', length < MIN_TOURNAMENT_MINUTES && 'text-destructive')} aria-live="polite">
            {length >= MIN_TOURNAMENT_MINUTES
              ? `Turnuva en fazla ${lengthText(length)} sürer. Maçlar daha önce biterse sonuç beklenmeden yazılır; bu saatte süren maçlar kapanır.`
              : `Bitiş, başlangıçtan en az ${MIN_TOURNAMENT_MINUTES} dakika sonra olmalı.`}
          </span>
        </label>
        <label className={labelCls}>
          Maça giriş süresi
          <select name="joinMinutes" defaultValue={t?.joinMinutes ?? DEFAULT_JOIN_MINUTES} className={field}>
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
          </span>
        </label>
        <label className={labelCls}>
          Kontenjan (oyuncu)
          <select name="maxPlayers" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className={field}>
            {playerOptions(format, seats).map((n) => (
              <option key={n} value={n}>
                {n} oyuncu{shared ? ` · ${n / seats} masa` : ''}
              </option>
            ))}
          </select>
          <span className="font-normal">
            {shared
              ? `Kontenjan dolarsa her masada ${seats} gerçek oyuncu olur. Dolmazsa oyuncular masalara eşit dağıtılır: ${TABLE_PASS} ya da daha az oyuncusu olan masa oynanmaz, oyuncuları tur atlar; 3 oyunculu masada boş koltuğa bot oturur. Bot tur atlayamaz, ödül alamaz.`
              : format === 'eleme'
                ? 'Eleme tablosu boş maç kalmadan dolsun diye 2 ve katları seçilir.'
                : 'Ligde kimse tur boş geçmesin diye çift sayı seçilir.'}
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
            {places.map((place, i) => (
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
                  value={prizes[i] ?? '0'}
                  onChange={(e) => setPrizes((list) => places.map((_, j) => (j === i ? e.target.value : (list[j] ?? '0'))))}
                  className={field}
                />
              </label>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
            Toplam ödül havuzu: <span className="font-bold text-foreground">{total.toLocaleString('tr-TR')} KC</span>. Sitede bu toplam gösterilir. Turnuva bitince her sıranın ödülü o oyuncunun hesabına kendiliğinden yüklenir; ödül vermek istemediğin sırayı 0 bırak.
            {shared
              ? ` Final masası tek tek sıralanır (1. - ${seats}.); daha önceki turda elenenler aynı ödülü alır.`
              : format === 'eleme' && places.length > 2 && ' Elemede üçüncülük maçı oynanmaz: aynı turda elenenler aynı ödülü alır.'}
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
        Turnuva başladı: oyun, format, kontenjan, ücret, ödüller ve maça giriş süresi artık değişmez. Bitiş saatini, açıklamayı ve ödül notunu değiştirebilirsin.
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
            {t.endsAt
              ? `Değiştirirsen şu andan en az ${MIN_TOURNAMENT_MINUTES} dakika sonrası olmalı. Bu saatte süren maçlar kapanır ve sonuç yazılır.`
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
  return (
    <article data-find={`tournament-${t.id}`} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {ARENA_META[t.game].title} · {FORMAT_SHORT[t.format]} · {t.tableSize > 2 ? `${t.tableSize} kişilik masa` : 'birebir'} · {STATUS_LABEL[t.status]}
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
            )}{' '}
            · maça giriş {t.joinMinutes} dk
          </p>
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
              confirm={`Başlangıç saati beklenmeden kayıtlar kapanacak ve tüm oyuncular hemen eşleşecek. Oyuncuların masaya girmek için ${t.joinMinutes} dakikası olur.`}
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
            renderPick={(r, m, match) => (canPick(r, match) ? <WinnerPicker t={t} round={r} match={m} players={match.players} winner={null} /> : null)}
          />
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

      {t.bracket && <TournamentMatches id={t.id} running={running} />}

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
        Oyun, format, ad, açıklama, kontenjan, ücret, ödül ve başlangıç saati saklanır. Tarih, oyuncular ve sonuçlar saklanmaz. Aynı adla kaydedersen eski şablonun üzerine yazılır.
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
                {ARENA_META[tpl.game].title} · {FORMAT_SHORT[tpl.format]} · {tpl.maxPlayers} kişi · {tpl.startTime}
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
