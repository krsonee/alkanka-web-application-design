'use client'

import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { ArrowLeft, Check, Clock, Coins, Eye, Loader2, LogOut, Plus, Swords, Trophy, Users, X } from 'lucide-react'
import { ARENA_META, TURN_SECONDS, type ArenaGame, type ArenaGameSettings } from '@/lib/arena'
import { TableChat } from './table-chat'
import { MobileTableChat } from './mobile-table-chat'
import { VoiceChat } from './voice-chat'
import { FitToScreen } from './fit-to-screen'
import { LandscapeFit } from './landscape-fit'
import { cn } from '@/lib/utils'
import { claimTableTimeout, closeTable, leaveGameTable, openTable, playMove, sitAtTable } from '@/app/actions/arena'
import { InviteButton } from './invite-button'
import { formatAC, usePoints } from '../points-context'
import { useIdle } from '../use-idle'
import type { Remote, RemoteAction } from './remote'
import { TavlaPvp } from './tavla'
import { OkeyPvp } from './okey-pvp'
import { Okey101Pvp } from './okey101-pvp'
import { BatakPvp } from './batak-pvp'
import { BATAK_RULE_OPTIONS, BATAK_VARIANTS, type BatakRules, type BatakVariant } from '@/lib/games/batak'
import { MonopolyPvp } from './monopoly-pvp'
import { PistiFinalScore, PistiPvp } from './pisti-pvp'
import { PapazPvp } from './papaz-pvp'
import { DEFAULT_PISTI_RULES, PISTI_RULE_OPTIONS, PISTI_TARGETS, pistiRulesToList, type PistiRules } from '@/lib/games/pisti'
import { PAPAZ_RULE_OPTIONS, type PapazRules } from '@/lib/games/papaz'
import { Bilardo } from './bilardo'
import { BlackjackDuel } from './blackjack'
import { RouletteDuel } from './roulette'
import { HeadGame } from './head-game'
import { useDuelLink } from './duel-link'
import { MemberRank } from '../kp/member-rank'
import { playSound } from '@/lib/sound'
import { SoundToggle, actionSound } from './sound-toggle'
import { useTableSounds } from './use-table-sounds'

type PlayerInfo = { id: string; name: string; seat: number; bot?: boolean }
export type TableSummary = {
  id: string
  game: string
  stake: number
  seats: number
  team: boolean
  bots: number
  rounds?: number | null
  variant?: string | null
  extras?: string[] | null
  winners: string[]
  spectator: boolean
  status: 'bekliyor' | 'oynaniyor' | 'bitti' | 'iptal'
  players: PlayerInfo[]
  version: number
  winnerId: string | null
  tournamentId: number | null
  roundNo: number | null
  updatedAt: string
  paused?: boolean
  seat: number
  turn: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any
  ambient?: boolean
}
type LobbyData = {
  open: TableSummary[]
  mine: TableSummary[]
  tournament: { id: string; game: string; round: number; title: string }[]
}

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Yüklenemedi')
  return r.json()
}

const DUEL = ['blackjack', 'rulet', 'kafa-topu', 'kafa-basketbolu']
const SEAT_GAME_RULES: Record<string, { seats: number[]; rounds: number[] }> = {
  okey101: { seats: [2, 4], rounds: [1, 3, 5] },
  batak: { seats: [4], rounds: [1, 31, 51, 101] },
  monopoly: { seats: [2, 3, 4, 5, 6, 7, 8, 9, 10], rounds: [999, 50, 30] },
  pisti: { seats: [2, 4], rounds: [] },
  papaz: { seats: [2, 3, 4, 5, 6], rounds: [] },
}

export function TableLobby({
  game,
  settings,
  rules,
  invitedId = null,
  initialStake,
}: {
  game: ArenaGame
  settings: ArenaGameSettings
  rules: string[]
  invitedId?: string | null
  initialStake?: number
}) {
  const { member, points, requireLogin, refresh } = usePoints()
  const [activeId, setActiveIdState] = useState<string | null>(null)
  // The open table lives in the URL so a page refresh drops the player straight back into it.
  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('masa', id)
    else url.searchParams.delete('masa')
    window.history.replaceState(window.history.state, '', url)
  }, [])
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get('masa')
    if (id && /^[\w-]{1,64}$/.test(id)) setActiveIdState(id)
  }, [])
  const [stake, setStake] = useState(initialStake && settings.bets.includes(initialStake) ? initialStake : (settings.bets[0] ?? 25))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [betFilter, setBetFilter] = useState<number | null>(null)
  const isOkey = game === 'okey'
  const [seats, setSeats] = useState<2 | 4>(4)
  const [teamMode, setTeamMode] = useState<boolean | null>(null)
  const [bots, setBots] = useState(0)
  const seatRule = SEAT_GAME_RULES[game]
  const [seatSeats, setSeatSeats] = useState(seatRule?.seats[seatRule.seats.length - 1] ?? 4)
  const [seatBots, setSeatBots] = useState(0)
  const [seatRounds, setSeatRounds] = useState(seatRule?.rounds[0] ?? 0)
  const [batakVariant, setBatakVariant] = useState<BatakVariant>('klasik')
  const [batakExtras, setBatakExtras] = useState<(keyof BatakRules)[]>(['batma'])
  const batakRuleList = BATAK_RULE_OPTIONS.filter((o) => o.variants.includes(batakVariant))
  const [pistiTarget, setPistiTarget] = useState('151')
  const [pistiTeam, setPistiTeam] = useState(true)
  const [pistiExtras, setPistiExtras] = useState<(keyof PistiRules)[]>(pistiRulesToList(DEFAULT_PISTI_RULES))
  const [papazExtras, setPapazExtras] = useState<(keyof PapazRules)[]>([])
  const [okey101Team, setOkey101Team] = useState(false)
  const [tavlaRounds, setTavlaRounds] = useState('1')
  const [okeyPoints, setOkeyPoints] = useState('0')
  const isTavla = game === 'tavla'
  const tavlaHold = isTavla && tavlaRounds === '1' ? stake * 2 : 0
  const humanSeats = seatRule ? seatSeats - seatBots : isOkey ? seats - (seats === 4 ? bots : 0) : 2
  const tableOptions = seatRule
    ? {
        seats: seatSeats,
        bots: seatBots,
        ...(seatRounds ? { rounds: seatRounds } : {}),
        ...(game === 'batak'
          ? { variant: batakVariant, extras: batakExtras.filter((k) => batakRuleList.some((o) => o.key === k)) }
          : game === 'pisti'
            ? { variant: pistiTarget, team: seatSeats === 4 && pistiTeam, extras: pistiExtras }
            : game === 'papaz'
              ? { extras: papazExtras }
              : game === 'okey101'
              ? { team: seatSeats === 4 && okey101Team }
              : {}),
      }
    : isOkey
      ? { seats, team: teamMode ?? false, bots: seats === 4 ? bots : 0, ...(okeyPoints !== '0' ? { rounds: Number(okeyPoints) } : {}) }
      : isTavla
        ? { rounds: Number(tavlaRounds) }
        : undefined
  const lobbyIdle = useIdle()
  const { data, mutate } = useSWR<LobbyData>(activeId ? null : `/api/tables?game=${game}`, fetcher, {
    refreshInterval: lobbyIdle ? 30000 : 6000,
  })

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; id?: string }>) => {
    if (!requireLogin()) return
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    refresh()
    if (!res.ok) setError(res.error ?? 'Bir hata oluştu.')
    return res
  }

  if (activeId) return <TableRoom id={activeId} onLeave={() => { setActiveId(null); mutate() }} />

  const allOpen = (data?.open ?? []).filter((t) => t.status === 'bekliyor' && t.seat < 0)
  const openBets = Array.from(new Set(allOpen.map((t) => t.stake))).sort((a, b) => a - b)
  const open = betFilter == null ? allOpen : allOpen.filter((t) => t.stake === betFilter || t.id === invitedId)
  const watchable = (data?.open ?? []).filter((t) => t.status === 'oynaniyor' && t.seat < 0)
  const mine = data?.mine ?? []
  const tour = (data?.tournament ?? []).filter((t) => t.game === game)
  const invited = invitedId ? open.find((t) => t.id === invitedId) : undefined
  if (invited) open.sort((a, b) => (a.id === invitedId ? -1 : b.id === invitedId ? 1 : 0))
  const invitedMine = invitedId != null && mine.some((t) => t.id === invitedId)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-labelledby="lobby-title" className="flex flex-col gap-4">
        {invitedId && data && !invitedMine && (
          <p
            role="status"
            className={cn(
              'rounded-xl border p-3 text-sm',
              invited ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground',
            )}
          >
            {invited
              ? `${invited.players.find((p) => !p.bot)?.name ?? 'Bir kanka'} seni masasına çağırıyor. Aşağıdaki "Otur" butonuyla katıl.`
              : 'Davet edildiğin masa doldu ya da kapandı. Diğer açık masalara göz at veya kendin bir masa aç.'}
          </p>
        )}
        {tour.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-primary bg-primary/10 p-4">
            {tour.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Trophy className="size-4 text-primary" aria-hidden="true" />
                  {t.title} · {t.round}. tur maçın hazır
                </span>
                <button onClick={() => setActiveId(t.id)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                  Maça gir
                </button>
              </div>
            ))}
          </div>
        )}

        {mine.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Masalarım</h3>
            {mine.map((t) => (
              <TableRowCard key={t.id} t={t}>
                <div className="flex items-center gap-2">
                  <LeaveTableButton
                    id={t.id}
                    running={t.status === 'oynaniyor'}
                    stake={t.stake}
                    onDone={() => {
                      refresh()
                      void mutate()
                    }}
                  />
                  <button onClick={() => setActiveId(t.id)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    {t.status === 'bekliyor' ? 'Masaya dön' : 'Oyuna dön'}
                  </button>
                </div>
              </TableRowCard>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="lobby-title" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Açık masalar
            </h3>
            {openBets.length > 1 && (
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Bahse göre filtrele">
                {[null, ...openBets].map((b) => (
                  <button
                    key={b ?? 'all'}
                    type="button"
                    role="radio"
                    aria-checked={betFilter === b}
                    onClick={() => setBetFilter(b)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums transition-colors',
                      betFilter === b ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/70',
                    )}
                  >
                    {b == null ? 'Tümü' : `${formatAC(b)} KC`}
                  </button>
                ))}
              </div>
            )}
          </div>
          {open.length > 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">Oturduğun masanın bahsi kesilir. Masayı açan bahsi belirler.</p>
          )}
          {!data && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Masalar yükleniyor
            </div>
          )}
          {data && open.length === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Şu an bekleyen masa yok. İlk masayı sen aç, kankalar otururken haber verelim.
            </p>
          )}
          {open.map((t) => (
            <TableRowCard key={t.id} t={t} highlight={t.id === invitedId}>
              <button
                disabled={busy || (member != null && points < t.stake)}
                onClick={async () => {
                  const r = await run(() => sitAtTable(t.id, t.stake))
                  if (r?.ok) setActiveId(t.id)
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Otur · {formatAC(t.stake)} KC
              </button>
            </TableRowCard>
          ))}
        </div>

        {watchable.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Oynanan masalar</h3>
            {watchable.map((t) => (
              <TableRowCard key={t.id} t={t}>
                {t.ambient ? (
                  <span className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground">
                    <Users className="size-4" aria-hidden="true" /> Masa dolu
                  </span>
                ) : (
                  <button onClick={() => setActiveId(t.id)} className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary">
                    <Eye className="size-4" aria-hidden="true" /> İzle
                  </button>
                )}
              </TableRowCard>
            ))}
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:gap-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Plus className="size-4" aria-hidden="true" />
            </span>
            <h3 className="font-bold leading-tight text-foreground">Masa aç</h3>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold leading-tight text-muted-foreground">Bahis (KC)</span>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-secondary/60 p-1" role="radiogroup" aria-label="Bahis">
              {settings.bets.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={stake === b}
                  onClick={() => setStake(b)}
                  className={cn(
                    'min-w-0 truncate rounded-lg px-1 py-2 text-sm font-bold tabular-nums leading-none transition-colors',
                    stake === b ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-background/60',
                  )}
                >
                  {b.toLocaleString('tr-TR')}
                </button>
              ))}
            </div>
          </div>
          {isTavla && (
            <div className="flex flex-col gap-2">
              <OptionGroup
                label="Maç"
                value={tavlaRounds}
                options={[
                  { value: '1', label: 'Tek el' },
                  { value: '3', label: '3 el' },
                  { value: '5', label: '5 el' },
                ]}
                onChange={setTavlaRounds}
              />
              <p className="text-[11px] leading-snug text-muted-foreground text-pretty">
                {tavlaRounds === '1'
                  ? `Tek elde mars 2 kat, ağır mars 3 kat öder. Mars güvencesi için girişte +${formatAC(tavlaHold)} KC bloke edilir, oyun bitince iade edilir.`
                  : `${tavlaRounds === '3' ? '2' : '3'} eli ilk alan maçı kazanır. Mars 2, ağır mars 3 el sayılır.`}
              </p>
            </div>
          )}
          {isOkey && (
            <div className="flex flex-col gap-3">
              <OptionGroup
                label="Masa"
                value={String(seats)}
                options={[
                  { value: '2', label: '2 kişilik' },
                  { value: '4', label: '4 kişilik' },
                ]}
                onChange={(v) => {
                  const next = v === '4' ? 4 : 2
                  setSeats(next)
                  if (next === 2) {
                    setBots(0)
                    if (teamMode) setTeamMode(null)
                  }
                }}
              />
              <OptionGroup
                label="Oyun modu (zorunlu)"
                value={teamMode == null ? '' : teamMode ? 'team' : 'solo'}
                options={[
                  { value: 'solo', label: 'Tekli' },
                  { value: 'team', label: 'Takımlı', disabled: seats !== 4 },
                ]}
                onChange={(v) => setTeamMode(v === 'team')}
              />
              <div className="flex flex-col gap-2">
                <OptionGroup
                  label="Puan"
                  value={okeyPoints}
                  options={[
                    { value: '0', label: 'Tek el' },
                    { value: '10', label: '10 puan' },
                    { value: '20', label: '20 puan' },
                    { value: '30', label: '30 puan' },
                  ]}
                  onChange={setOkeyPoints}
                />
                <p className="text-[11px] leading-snug text-muted-foreground text-pretty">
                  {okeyPoints === '0'
                    ? 'İlk bitiren masayı kazanır.'
                    : `Herkes ${okeyPoints} puanla başlar. Bitirene karşı rakipler 2, çift ya da okey atarak bitirişte 4, ikisi birden olursa 8 puan kaybeder. Göstergeyi gösteren rakiplerine 1 puan sildirir. Puanı ilk sıfırlanan olunca en yüksek puanlı kazanır.`}
                </p>
              </div>
              {seats === 4 && (
                <OptionGroup
                  label="Bot koltuğu"
                  value={String(bots)}
                  options={[
                    { value: '0', label: 'Bot yok' },
                    { value: '1', label: '1 bot' },
                    { value: '2', label: '2 bot' },
                  ]}
                  onChange={(v) => setBots(Number(v))}
                />
              )}
              {teamMode && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Karşılıklı oturanlar eş olur, eşlerden biri bitirince takım kazanır.
                </p>
              )}
            </div>
          )}
          {seatRule && (
            <div className="flex flex-col gap-2.5">
              {game === 'batak' && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Batak türü</span>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Batak türü">
                    {BATAK_VARIANTS.map((v) => {
                      const active = batakVariant === v.value
                      return (
                        <button
                          key={v.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => {
                            setBatakVariant(v.value)
                            setSeatSeats(v.seats)
                            setSeatBots((b) => Math.min(b, v.seats - 1))
                          }}
                          className={cn(
                            'relative flex min-h-20 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                            active ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/40 hover:bg-secondary/50',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full border',
                              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                            )}
                            aria-hidden="true"
                          >
                            {active && <Check className="size-3" strokeWidth={3} />}
                          </span>
                          <span className="pr-5 text-sm font-bold leading-tight text-foreground">{v.label}</span>
                          <span className="text-xs leading-snug text-muted-foreground text-pretty">{v.hint}</span>
                          <span className="mt-auto flex items-center gap-1 pt-1 text-xs font-semibold text-muted-foreground">
                            <Users className="size-3" aria-hidden="true" /> {v.seats} kişi
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {game === 'pisti' && (
                <OptionGroup
                  label="Puan"
                  value={pistiTarget}
                  options={PISTI_TARGETS.map((t) => ({ value: t.value, label: t.value === '101' ? '101 · Hızlı' : '151 · Klasik' }))}
                  onChange={setPistiTarget}
                />
              )}
              {seatRule.seats.length > 1 && (
                <OptionGroup
                  label="Masa"
                  value={String(seatSeats)}
                  options={seatRule.seats.map((n) => ({ value: String(n), label: seatRule.seats.length > 5 ? String(n) : `${n} kişilik` }))}
                  onChange={(v) => {
                    const n = Number(v)
                    setSeatSeats(n)
                    setSeatBots((b) => Math.min(b, n - 1))
                  }}
                />
              )}
              {game === 'pisti' && seatSeats === 4 && (
                <OptionGroup
                  label="Mod"
                  value={pistiTeam ? 'team' : 'solo'}
                  options={[
                    { value: 'team', label: 'Eşli (2+2)' },
                    { value: 'solo', label: 'Tekli' },
                  ]}
                  onChange={(v) => setPistiTeam(v === 'team')}
                />
              )}
              {game === 'okey101' && seatSeats === 4 && (
                <OptionGroup
                  label="Mod"
                  value={okey101Team ? 'team' : 'solo'}
                  options={[
                    { value: 'solo', label: 'Tekli' },
                    { value: 'team', label: 'Eşli (2+2)' },
                  ]}
                  onChange={(v) => setOkey101Team(v === 'team')}
                />
              )}
              <OptionGroup
                label="Bot koltuğu"
                value={String(seatBots)}
                options={Array.from({ length: seatSeats }, (_, i) => ({ value: String(i), label: i === 0 ? (seatSeats > 5 ? 'Yok' : 'Bot yok') : seatSeats > 5 ? String(i) : `${i} bot` }))}
                onChange={(v) => setSeatBots(Number(v))}
              />
              {seatRule.rounds.length > 0 && (
                <OptionGroup
                  label={game === 'monopoly' ? 'Süre' : game === 'batak' ? 'Oyun sonu' : 'El sayısı'}
                  value={String(seatRounds)}
                  options={seatRule.rounds.map((n) => ({
                    value: String(n),
                    label: game === 'monopoly' ? (n >= 999 ? 'İflasa kadar' : `${n} tur`) : game === 'batak' ? (n === 1 ? 'Tek el' : `${n} puan`) : `${n} el`,
                  }))}
                  onChange={(v) => setSeatRounds(Number(v))}
                />
              )}
              {game === 'batak' && (
                <p className="text-[11px] leading-snug text-pretty text-muted-foreground">
                  {seatRounds === 1
                    ? 'Tek el oynanır, en yüksek puan kazanır. Eşitlikte ihaleyi alan kazanır.'
                    : `${seatRounds} puana ilk ulaşan kazanır. Zirvede eşitlik olursa bir el daha oynanır.`}
                </p>
              )}
              {game === 'pisti' && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-semibold text-muted-foreground">Masa ayarları</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PISTI_RULE_OPTIONS.map((o) => {
                      const on = pistiExtras.includes(o.key)
                      return (
                        <button
                          key={o.key}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          onClick={() => setPistiExtras((list) => (on ? list.filter((k) => k !== o.key) : [...list, o.key]))}
                          className={cn(
                            'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                            on ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50',
                          )}
                        >
                          <span
                            className={cn('mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-primary' : 'bg-muted')}
                            aria-hidden="true"
                          >
                            <span className={cn('size-3 rounded-full bg-background transition-transform', on && 'translate-x-3')} />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-xs font-bold text-foreground">{o.label}</span>
                            <span className="text-[11px] leading-snug text-muted-foreground">{o.hint}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] leading-snug text-pretty text-muted-foreground">
                    En çok kart +3, eşitlikte kimseye verilmez. As ve Vale +1, ♣2 +2, ♦10 +3. Pişti +10, Vale pişti +20.
                  </p>
                </fieldset>
              )}
              {game === 'papaz' && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-semibold text-muted-foreground">Masa ayarları</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PAPAZ_RULE_OPTIONS.map((o) => {
                      const on = papazExtras.includes(o.key)
                      return (
                        <button
                          key={o.key}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          onClick={() => setPapazExtras((list) => (on ? list.filter((k) => k !== o.key) : [...list, o.key]))}
                          className={cn(
                            'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                            on ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50',
                          )}
                        >
                          <span
                            className={cn('mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-primary' : 'bg-muted')}
                            aria-hidden="true"
                          >
                            <span className={cn('size-3 rounded-full bg-background transition-transform', on && 'translate-x-3')} />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-xs font-bold text-foreground">{o.label}</span>
                            <span className="text-[11px] leading-snug text-muted-foreground">{o.hint}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] leading-snug text-pretty text-muted-foreground">
                    En çok kart +3, eşitlikte kimseye verilmez. As ve Vale +1, ♣2 +2, ♦10 +3. Pişti +10, Vale pişti +20.
                  </p>
                </fieldset>
              )}
              {game === 'batak' && batakRuleList.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-semibold text-muted-foreground">Masa ayarları</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {batakRuleList.map((o) => {
                      const on = batakExtras.includes(o.key)
                      return (
                        <button
                          key={o.key}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          onClick={() => setBatakExtras((list) => (on ? list.filter((k) => k !== o.key) : [...list, o.key]))}
                          className={cn(
                            'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                            on ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50',
                          )}
                        >
                          <span
                            className={cn('mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-primary' : 'bg-muted')}
                            aria-hidden="true"
                          >
                            <span className={cn('size-3 rounded-full bg-background transition-transform', on && 'translate-x-3')} />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-xs font-bold text-foreground">{o.label}</span>
                            <span className="text-[11px] leading-snug text-muted-foreground">{o.hint}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          )}
          <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-secondary/40 py-2 text-center">
            <div className="flex flex-col gap-0.5 px-1">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Oyuncu</dt>
              <dd className="text-xs font-bold text-foreground">
                {humanSeats}
                {seatRule && seatBots > 0 ? ` + ${seatBots} bot` : isOkey && seats === 4 && bots > 0 ? ` + ${bots} bot` : ''}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 px-1">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pot</dt>
              <dd className="text-xs font-bold tabular-nums text-foreground">{formatAC(stake * humanSeats)} KC</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-1">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{isOkey && teamMode ? 'Takıma' : game === 'papaz' ? 'Dağıtılan' : 'Kazanan'}</dt>
              <dd className="flex items-center justify-center gap-1 text-xs font-bold tabular-nums text-primary">
                <Coins className="size-3.5" aria-hidden="true" />
                {formatAC(stake * humanSeats - Math.round((stake * humanSeats * settings.commission) / 100))} KC
              </dd>
            </div>
          </dl>
          <p className="-mt-1 text-[11px] leading-snug text-muted-foreground text-pretty">
            {game === 'papaz'
              ? `Pot kurtulma sırasına göre bölünür: ilk kurtulan en çok alır, eşsiz kartla kalan kaybeder. %${settings.commission} kesinti uygulanır.`
              : `Oyuncu masasında pot kazanana gider, %${settings.commission} kesinti uygulanır.`} Masa iptal olursa bahis iade edilir.
            {seatRule && humanSeats === 1 ? ' Tek gerçek oyuncuyla oyun hemen botlara karşı başlar.' : ''}
          </p>
          <button
            disabled={busy || (isOkey && teamMode == null)}
            onClick={async () => {
              const r = await run(() => openTable(game, stake, tableOptions))
              if (r?.ok && r.id) setActiveId(r.id)
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Swords className="size-4" aria-hidden="true" />}
            Masa aç
          </button>
          {isOkey && teamMode == null && <p className="text-xs text-muted-foreground">Masa açmak için tekli ya da takımlı modu seç.</p>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 font-bold text-foreground">Kurallar</h3>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string; disabled?: boolean }[]
  onChange: (v: string) => void
}) {
  const stacked = options.length > 3
  return (
    <div className={cn('flex gap-3', stacked ? 'flex-col gap-1.5' : 'items-center')}>
      <span className={cn('shrink-0 text-xs font-semibold leading-tight text-muted-foreground', !stacked && 'w-20')}>{label}</span>
      <div
        className={cn('min-w-0 flex-1 gap-1 rounded-xl bg-secondary/60 p-1', options.length > 5 ? 'grid grid-cols-5' : 'flex')}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-w-0 flex-1 whitespace-nowrap rounded-lg px-1 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 sm:text-sm',
              value === o.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-background/60',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TableRowCard({ t, children, highlight = false }: { t: TableSummary; children: React.ReactNode; highlight?: boolean }) {
  const host = t.players.find((p) => !p.bot)?.name ?? 'Kanka'
  const humans = t.players.filter((p) => !p.bot).length
  const meta = ARENA_META[t.game as ArenaGame]
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 sm:p-4',
        highlight ? 'border-primary ring-2 ring-primary/40' : 'border-border',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-foreground">
          {host.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {host}
            {t.seats > 2 || t.team ? <span className="ml-2 text-xs font-normal text-muted-foreground">{meta?.title}</span> : null}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Coins className="size-3.5" aria-hidden="true" /> {formatAC(t.stake)} KC
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" aria-hidden="true" /> {humans}/{t.seats - t.bots}
              {t.bots > 0 ? ` + ${t.bots} bot` : ''}
            </span>
            {t.game === 'okey' && <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold text-foreground">{t.team ? 'Takımlı' : 'Tekli'}</span>}
            {t.game === 'okey' && (
              <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold text-foreground">{t.rounds ? `${t.rounds} puan` : 'Tek el'}</span>
            )}
            {t.game === 'papaz' && (
              <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold text-foreground">
                {t.extras?.includes('kiz') ? 'Kız Kimde' : 'Papaz Kimde'}
                {t.extras?.includes('klasik') ? ' · Klasik' : ''}
              </span>
            )}
            {t.game === 'pisti' && (
              <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold text-foreground">
                {t.variant === '101' ? 101 : 151} puan{t.seats === 4 ? (t.team ? ' · Eşli' : ' · Tekli') : ''}
              </span>
            )}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}

export function TableRoom({ id, onLeave }: { id: string; onLeave: () => void }) {
  const { refresh, member } = usePoints()
  const idle = useIdle()
  const { data, mutate, error } = useSWR<TableSummary>(`/api/tables/${id}`, fetcher, {
    refreshInterval: (d) => {
      if (!d) return 2000
      if (d.status === 'bitti' || d.status === 'iptal') return 0
      if (idle) return 10000
      if (d.status === 'bekliyor') return 5000
      if (d.spectator) return 3000
      // Nothing changes server-side while it's my move (except the turn timer), so poll slowly then.
      if (d.turn === d.seat) return 5000
      // 101 bots play one turn per poll, so a quicker beat keeps their moves flowing one by one.
      return d.game === 'okey101' ? 1200 : d.game === 'batak' || d.game === 'pisti' || d.game === 'papaz' ? 1000 : 2000
    },
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [resultClosed, setResultClosed] = useState(false)

  const send = useCallback(
    async (action: RemoteAction) => {
      if (!data) return false
      setBusy(true)
      const r = await playMove(id, data.version, action)
      if (r.ok && r.view) await mutate(r.view as TableSummary, { revalidate: false })
      else await mutate()
      setBusy(false)
      if (!r.ok) {
        playSound('error')
        setMsg(r.error ?? 'Hamle yapılamadı.')
        return false
      }
      playSound(actionSound(data.game, action.type))
      setMsg(null)
      return true
    },
    [data, id, mutate],
  )

  useTableSounds(
    data
      ? {
          status: data.status,
          version: data.version,
          turn: data.turn ?? null,
          seat: data.seat,
          humans: data.players.filter((p) => !p.bot).length,
          game: data.game,
          won: member != null && (data.winners ?? []).includes(member.id),
        }
      : null,
  )

  if (error) return <RoomShell onLeave={onLeave}><p className="p-6 text-sm text-destructive">{String(error.message)}</p></RoomShell>
  if (!data) {
    return (
      <RoomShell onLeave={onLeave}>
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Masa yükleniyor
        </div>
      </RoomShell>
    )
  }

  const meta = ARENA_META[data.game as ArenaGame]
  const seatCount = data.seats || 2
  const names = Array.from({ length: seatCount }, (_, i) => data.players.find((p) => p.seat === i)?.name ?? 'Bekleniyor')
  const mySeat = data.seat
  const spectator = mySeat < 0
  const ended = data.status === 'bitti' || data.status === 'iptal'
  const idleMs = Date.now() - new Date(data.updatedAt).getTime()
  const oppTurnStale = data.status === 'oynaniyor' && mySeat >= 0 && data.turn != null && data.turn !== mySeat && idleMs > 3 * 60 * 1000
  const duelStale = data.status === 'oynaniyor' && mySeat >= 0 && data.turn == null && data.state?.scores?.[mySeat] && idleMs > 10 * 60 * 1000
  const won = member != null && (data.winners ?? []).includes(member.id)
  const turnName = data.turn != null ? names[data.turn] : null

  const remote: Remote<unknown> = {
    id,
    // Tavla and bilardo render from seat 0's side for spectators; okey handles seat -1 itself.
    seat: spectator && !['okey', 'okey101', 'batak', 'monopoly', 'pisti', 'papaz'].includes(data.game) ? 0 : mySeat,
    state: data.state,
    version: data.version,
    myTurn: !spectator && data.status === 'oynaniyor' && data.turn === mySeat,
    busy,
    names,
    spectator,
    send,
  }

  const immersive = ['pisti', 'papaz', 'okey101', 'batak'].includes(data.game) && data.status === 'oynaniyor'

  return (
    <RoomShell
      immersive={immersive}
      onLeave={onLeave}
      title={`${meta?.title ?? data.game} · ${formatAC(data.stake)} KC${data.game === 'pisti' ? ` · ${data.variant === '101' ? 101 : 151} puan · ${data.team ? 'Eşli' : 'Tekli'}` : ''}${data.roundNo ? ` · ${data.roundNo}. tur` : ''}`}
    >
      <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm', immersive && 'max-lg:flex-nowrap max-lg:px-2 max-lg:py-2')}>
        <span className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-foreground', immersive && 'max-lg:hidden')}>
          {(data.team ? [0, 2, 1, 3] : names.map((_, i) => i)).map((seatNo, i) => {
            const p = data.players.find((pl) => pl.seat === seatNo)
            return (
              <span key={seatNo} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground">{data.team && i === 2 ? 'vs' : data.team ? '&' : '·'}</span>}
                <span className="truncate">{names[seatNo]}</span>
                <MemberRank userId={p?.id} />
              </span>
            )
          })}
        </span>
        <span className={cn('flex items-center gap-1 text-muted-foreground', immersive && 'max-lg:hidden')}>
          {spectator ? <Eye className="size-3.5" aria-hidden="true" /> : <Clock className="size-3.5" aria-hidden="true" />}
          {data.status === 'bekliyor'
            ? `Oyuncu bekleniyor (${data.players.filter((p) => !p.bot).length}/${seatCount - (data.bots ?? 0)})`
            : data.status === 'oynaniyor'
              ? data.turn == null
                ? 'Eş zamanlı oynanıyor'
                : data.turn === mySeat
                  ? 'Sıra sende'
                  : `${turnName} oynuyor`
              : data.status === 'bitti'
                ? 'Bitti'
                : 'İptal'}
          {spectator && data.status === 'oynaniyor' ? ' · izleyici' : ''}
        </span>
        {data.status === 'oynaniyor' && data.turn != null && TURN_SECONDS[data.game as ArenaGame] && (
          <div className={immersive ? 'min-w-0 flex-1 lg:flex-none' : 'contents'}>
            <TurnClock
              key={`${data.version}-${data.turn}`}
              updatedAt={data.updatedAt}
              paused={Boolean(data.paused)}
              seconds={TURN_SECONDS[data.game as ArenaGame] ?? 30}
              mine={data.turn === mySeat}
              onExpire={() => void mutate()}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {!spectator && mySeat >= 0 && !data.tournamentId && data.status === 'oynaniyor' && (
            <LeaveTableButton
              id={id}
              running
              compact={immersive}
              stake={data.stake}
              onDone={() => {
                refresh()
                onLeave()
              }}
            />
          )}
          {data.status !== 'bitti' && <VoiceChat key={`v-${id}`} roomId={id} />}
          <SoundToggle />
          <MobileTableChat key={`m-${id}`} tableId={id} />
        </div>
      </div>

      {msg && (
        <p role="alert" className="px-4 pt-3 text-sm text-destructive">
          {msg}
        </p>
      )}

      <div className="flex flex-col gap-3 p-2 sm:p-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        {data.status === 'bekliyor' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-pretty text-sm text-muted-foreground">Masan açık. Bir kanka oturduğunda oyun otomatik başlar.</p>
            {mySeat >= 0 && !data.tournamentId && <InviteButton tableId={id} />}
            {mySeat > 0 && !data.tournamentId && (
              <LeaveTableButton
                id={id}
                running={false}
                stake={data.stake}
                onDone={() => {
                  refresh()
                  onLeave()
                }}
              />
            )}
            {mySeat === 0 && !data.tournamentId && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await closeTable(id)
                  setBusy(false)
                  refresh()
                  onLeave()
                }}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <X className="size-4" aria-hidden="true" /> Masayı kapat ve bahsi geri al
              </button>
            )}
          </div>
        )}

        {data.status === 'oynaniyor' && spectator && DUEL.includes(data.game) && (
          <p className="py-10 text-center text-sm text-muted-foreground">Bu oyunda iki oyuncu aynı anda kendi masasında oynuyor, skorlar bitince görünür.</p>
        )}

        {(data.status === 'oynaniyor' || ended) && data.state && !(spectator && DUEL.includes(data.game)) && (
          <div className={cn(spectator && data.game !== 'okey' && 'pointer-events-none')}>
            {spectator ? (
              <FitToScreen>
                <GameSurface game={data.game} remote={remote} done={ended} pvp={data.players.filter((p) => !p.bot).length === 2} />
              </FitToScreen>
            ) : data.game === 'kafa-topu' || data.game === 'kafa-basketbolu' ? (
              <GameSurface game={data.game} remote={remote} done={ended} pvp={data.players.filter((p) => !p.bot).length === 2} />
            ) : (
              <LandscapeFit>
                <GameSurface game={data.game} remote={remote} done={ended} pvp={data.players.filter((p) => !p.bot).length === 2} />
              </LandscapeFit>
            )}
          </div>
        )}

        {(oppTurnStale || duelStale) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary p-3 text-sm">
            <span className="text-foreground">
              {seatCount > 2 ? `${turnName} uzun süredir hamle yapmadı.` : 'Rakibin uzun süredir hamle yapmadı.'}
            </span>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const r = await claimTableTimeout(id)
                await mutate()
                setBusy(false)
                refresh()
                if (!r.ok) setMsg(r.error ?? 'Talep reddedildi.')
              }}
              className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground"
            >
              {seatCount > 2 && !data.team ? 'Yerine bot geçir' : 'Hükmen galibiyet al'}
            </button>
          </div>
        )}

        {ended && !resultClosed && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-result-title"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm animate-in fade-in duration-300"
          >
            <div
              className={cn(
                'flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border-2 bg-card p-6 text-center shadow-2xl animate-in zoom-in-75 slide-in-from-bottom-6 duration-500',
                won ? 'border-primary glow-gold' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'flex size-20 items-center justify-center rounded-full animate-in spin-in-12 zoom-in-50 duration-700',
                  won ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {won || spectator || data.winnerId == null ? <Trophy className="size-10" aria-hidden="true" /> : <X className="size-10" aria-hidden="true" />}
              </span>
              <p id="game-result-title" className={cn('text-3xl font-black uppercase tracking-tight', won ? 'text-primary' : 'text-foreground')}>
                {data.status === 'iptal'
                  ? 'İptal'
                  : data.winnerId == null
                    ? 'Berabere'
                    : spectator
                      ? 'Oyun bitti'
                      : won
                        ? data.team
                          ? 'Takımın kazandı!'
                          : 'Kazandın!'
                        : 'Kaybettin'}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {data.status === 'iptal' || data.winnerId == null
                  ? 'Bahis iade edildi.'
                  : spectator
                    ? `Kazanan: ${data.players.filter((p) => data.winners.includes(p.id)).map((p) => p.name).join(' & ')}`
                    : won
                      ? 'Pot hesabına eklendi.'
                      : `Kazanan: ${data.players.filter((p) => data.winners.includes(p.id)).map((p) => p.name).join(' & ')}`}
              </p>
              {data.game === 'pisti' && data.status === 'bitti' && Array.isArray(data.state?.totals) && (
                <PistiFinalScore state={data.state} names={names} mySeat={mySeat} />
              )}
              <div className="mt-1 grid w-full grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResultClosed(true)}
                  className="rounded-xl border border-border py-2.5 text-sm font-bold text-foreground hover:bg-secondary"
                >
                  Masaya dön
                </button>
                <button
                  type="button"
                  onClick={() => { refresh(); onLeave() }}
                  className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Lobiye dön
                </button>
              </div>
            </div>
          </div>
        )}

        {ended && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-xl font-bold text-foreground">
              {data.status === 'iptal'
                ? 'Masa iptal edildi, bahis iade edildi.'
                : data.winnerId == null
                  ? 'Berabere, bahisler iade edildi.'
                  : spectator
                    ? `Kazanan: ${data.players.filter((p) => data.winners.includes(p.id)).map((p) => p.name).join(' & ')}`
                    : won
                      ? data.team
                        ? 'Takımın kazandı!'
                        : 'Kazandın!'
                      : 'Kaybettin'}
            </p>
            {data.tournamentId && won && (
              <p className="text-sm text-muted-foreground">Turdaki tüm maçlar bitince bir sonraki tura otomatik eşleşeceksin.</p>
            )}
            <button onClick={() => { refresh(); onLeave() }} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
              Lobiye dön
            </button>
          </div>
        )}
      </div>
      <TableChat tableId={id} className="hidden h-72 lg:flex xl:sticky xl:top-20 xl:h-[32rem] xl:w-80 xl:shrink-0" />
      </div>
    </RoomShell>
  )
}

function TurnClock({
  updatedAt,
  seconds,
  mine,
  paused,
  onExpire,
}: {
  updatedAt: string
  seconds: number
  mine: boolean
  paused: boolean
  onExpire: () => void
}) {
  const deadline = new Date(updatedAt).getTime() + seconds * 1000
  const [tick, setNow] = useState(() => Date.now())
  // While a Çember round is on screen the server keeps the clock frozen; mirror that locally.
  const [frozenAt, setFrozenAt] = useState<number | null>(null)
  if (paused && frozenAt === null) setFrozenAt(tick)
  if (!paused && frozenAt !== null) setFrozenAt(null)
  const now = paused ? (frozenAt ?? tick) : tick
  const left = Math.max(0, Math.ceil((deadline - now) / 1000))
  const expired = left === 0 && !paused

  useEffect(() => {
    if (paused) {
      const t = setInterval(onExpire, 3000)
      return () => clearInterval(t)
    }
    if (expired) {
      onExpire()
      return
    }
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  const pct = Math.min(100, Math.max(0, ((deadline - now) / (seconds * 1000)) * 100))
  const urgent = left <= 10
  return (
    <div className="flex w-full items-center gap-2 sm:w-56" role="timer" aria-label={`Hamle süresi ${left} saniye`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full transition-[width] duration-200 ease-linear', urgent ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('w-16 text-right text-xs font-bold tabular-nums', urgent ? 'text-destructive' : 'text-foreground')}>
        {paused ? 'Durdu' : expired ? 'Süre doldu' : `${mine ? 'Sen ' : ''}${left} sn`}
      </span>
    </div>
  )
}

function GameSurface({ game, remote, done, pvp = false }: { game: string; remote: Remote<unknown>; done: boolean; pvp?: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = remote as Remote<any>
  if (game === 'tavla') return <TavlaPvp remote={r} />
  if (game === 'okey') return <OkeyPvp remote={r} />
  if (game === 'bilardo') return <Bilardo remote={r} />
  if (game === 'okey101') return <Okey101Pvp remote={r} />
  if (game === 'batak') return <BatakPvp remote={r} />
  if (game === 'monopoly') return <MonopolyPvp remote={r} />
  if (game === 'pisti') return <PistiPvp remote={r} />
  if (game === 'papaz') return <PapazPvp remote={r} />
  if (DUEL.includes(game)) {
    const mine = r.state?.scores?.[r.seat]
    if (mine || done) {
      const opp = r.state?.scores?.[r.seat === 0 ? 1 : 0]
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm">
          <p className="font-semibold text-foreground">
            Skorun: {mine ? `${mine.for} - ${mine.against}` : '-'}
          </p>
          <p className="text-muted-foreground">
            {opp && !opp.hidden ? `Rakip skoru: ${opp.for} - ${opp.against}` : 'Rakibinin oyununu bitirmesi bekleniyor.'}
          </p>
        </div>
      )
    }
    const submit = (s: { for: number; against: number }) => void r.send({ type: 'score', for: s.for, against: s.against })
    if (game === 'blackjack') return <BlackjackDuel onDone={submit} />
    if (game === 'rulet') return <RouletteDuel onDone={submit} />
    const sport = game === 'kafa-topu' ? 'futbol' : 'basket'
    if (pvp && r.id && !r.spectator && (r.seat === 0 || r.seat === 1)) {
      return <HeadDuel tableId={r.id} sport={sport} host={r.seat === 0} names={[r.names[0] ?? 'Ev sahibi', r.names[1] ?? 'Rakip']} onEnd={submit} />
    }
    return <HeadGame sport={sport} mode="bot" onEnd={submit} />
  }
  return null
}

/** Live 1v1 head game: both humans play the same match over a peer-to-peer link instead of separate bot games. */
function HeadDuel({
  tableId,
  sport,
  host,
  names,
  onEnd,
}: {
  tableId: string
  sport: 'futbol' | 'basket'
  host: boolean
  names: [string, string]
  onEnd: (s: { for: number; against: number }) => void
}) {
  const link = useDuelLink(tableId, host)
  return <HeadGame sport={sport} mode={host ? 'host' : 'guest'} link={link} names={names} onEnd={onEnd} />
}

function RoomShell({ children, onLeave, title, immersive }: { children: React.ReactNode; onLeave: () => void; title?: string; immersive?: boolean }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card',
        immersive && 'max-lg:fixed max-lg:inset-0 max-lg:z-[60] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-none max-lg:border-0 max-lg:pt-[env(safe-area-inset-top)]',
      )}
    >
      <div className={cn('flex items-center gap-3 border-b border-border px-3 py-2.5', immersive && 'max-lg:py-1.5')}>
        <button onClick={onLeave} aria-label="Lobiye dön" className="flex size-9 items-center justify-center rounded-lg hover:bg-secondary">
          <ArrowLeft className="size-4 text-foreground" aria-hidden="true" />
        </button>
        <h3 className="truncate font-bold text-foreground">{title ?? 'Masa'}</h3>
      </div>
      {children}
    </div>
  )
}

function LeaveTableButton({ id, running, stake, onDone, compact }: { id: string; running: boolean; stake: number; onDone: () => void; compact?: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={compact ? 'Masadan kalk' : undefined}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className={cn(compact && 'max-lg:sr-only')}>Masadan kalk</span>
      </button>
    )
  }

  return (
    <div role="alertdialog" aria-label="Masadan kalkmayı onayla" className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {error ?? (running ? `Hükmen kaybedersin (-${formatAC(stake)} KC).` : 'Bahsin iade edilir.')}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          const r = await leaveGameTable(id)
          setBusy(false)
          if (!r.ok) {
            setError(r.error ?? 'Kalkamadın, tekrar dene.')
            return
          }
          setConfirming(false)
          onDone()
        }}
        className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-foreground disabled:opacity-60"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        Kalk
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        Vazgeç
      </button>
    </div>
  )
}
