'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowLeftRight,
  Bot,
  Car,
  Dice5,
  Droplets,
  Eye,
  Gavel,
  HelpCircle,
  Home,
  Hotel,
  KeyRound,
  Landmark,
  Lock,
  MapPin,
  Package,
  Train,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BOARD,
  canBuild,
  canMortgage,
  canSell,
  isBuyable,
  JAIL_FINE,
  netWorth,
  unmortgageCost,
  type Bundle,
  type Group,
  type MonopolyState,
} from '@/lib/games/monopoly'
import type { Remote } from './remote'
import { EventFeed, EventSpotlight, MoneyFloat, useEventFeed, useMoneyDeltas, type GameEvent } from './monopoly-events'
import { TableBrand } from './table-brand'
import dynamic from 'next/dynamic'

const MonopolyBoard3D = dynamic(() => import('./monopoly-board-3d'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center font-display text-sm text-[#9aa6c2]">Tahta kuruluyor…</div>,
})
import {
  AllDeedsPanel,
  AuctionPanel,
  DebtPanel,
  deedColor,
  deedsOf,
  FinalStandings,
  GROUP_COLOR,
  housesOf,
  PlayersPanel,
  TOKEN_COLOR,
  TradeComposer,
  TradeOfferCard,
} from './monopoly-panels'

const LIGHT_GROUPS: Group[] = ['lightblue', 'yellow']
const INK = 'oklch(0.22 0.02 160)'
const WHITE = 'oklch(0.985 0 0)'

const STEP_MS = 300

const TURN_GAP_MS = 650
const DICE_SETTLE_MS = 1150

/**
 * Walks pawns one square at a time, one player at a time, in turn order starting
 * from whoever held the turn before this update — so a batch of bot moves that
 * arrives in a single server response still plays out sequentially.
 */
function useWalkingPawns(target: number[], turn: number) {
  const [shown, setShown] = useState(target)
  const [walker, setWalker] = useState<number | null>(null)
  const shownRef = useRef(target)
  const startRef = useRef(turn)
  const turnRef = useRef(turn)
  const key = target.join(',')

  useEffect(() => {
    const goal = key.split(',').map(Number)
    const n = goal.length
    if (shownRef.current.length !== n) {
      shownRef.current = goal
      setShown(goal)
      startRef.current = turnRef.current
      return
    }
    const start = startRef.current
    const order = Array.from({ length: n }, (_, k) => (start + k) % n)
    let timer = 0
    let current: number | null = null

    const tick = () => {
      const seat = order.find((i) => shownRef.current[i] !== goal[i])
      if (seat === undefined) {
        current = null
        setWalker(null)
        startRef.current = turnRef.current
        return
      }
      if (current !== null && current !== seat) {
        current = seat
        setWalker(seat)
        timer = window.setTimeout(tick, TURN_GAP_MS)
        return
      }
      current = seat
      setWalker(seat)
      const p = shownRef.current[seat]
      const t = goal[seat]
      const steps = (t - p + 40) % 40
      const next = [...shownRef.current]
      next[seat] = steps > 12 ? t : (p + 1) % 40
      shownRef.current = next
      setShown(next)
      timer = window.setTimeout(tick, next[seat] === t ? TURN_GAP_MS : STEP_MS)
    }

    // Give the 3D dice time to land before the pawn starts hopping.
    timer = window.setTimeout(tick, DICE_SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [key])

  useEffect(() => {
    turnRef.current = turn
    if (shownRef.current.every((p, i) => p === target[i])) startRef.current = turn
  }, [turn, target])

  return { shown, walker }
}

export function MonopolyPvp({ remote }: { remote: Remote<MonopolyState> }) {
  const s = remote.state
  const me = remote.spectator ? -1 : remote.seat
  const myTurn = remote.myTurn
  const [focus, setFocus] = useState<number | null>(null)
  const [tab, setTab] = useState<PanelTab>('props')
  const [sheet, setSheet] = useState(false)
  const [follow, setFollow] = useState(true)
  const [composer, setComposer] = useState<{ target: number | null; counter?: { give: Bundle; take: Bundle; to: number } } | null>(null)
  const nameOf = (seat: number) => (seat === me ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const fill = (t: string) => t.replace(/@(\d)/g, (_, d) => nameOf(Number(d)))

  const realPos = useMemo(() => s.players.map((p) => p.pos), [s.players])
  const { shown: shownPos, walker } = useWalkingPawns(realPos, s.turn)
  const walking = shownPos.some((p, i) => p !== realPos[i])
  const shownTurn = walking && walker !== null ? walker : s.turn
  const { feed, batch } = useEventFeed(s.log, walking)
  const { displayMoney, deltas } = useMoneyDeltas(
    s.players.map((p) => p.money),
    walking,
  )

  const myPlayer = me >= 0 ? s.players[me] : null
  const myProps = me >= 0 ? deedsOf(s, me) : []
  const active = s.players[s.turn]
  const activeSquare = active ? BOARD[active.pos] : null
  const ownTurn = me >= 0 && s.turn === me && myTurn && !s.auction && !s.trade && !!myPlayer && !myPlayer.out
  const canManage = ownTurn && !walking
  const canTrade = canManage && ['roll', 'end', 'debt'].includes(s.phase)
  const alive = s.players.filter((p) => !p.out).length

  const openDeed = (i: number) => {
    setFocus(i)
    setTab('deed')
    setSheet(true)
  }
  const startTrade = (target: number | null) => {
    setComposer({ target })
    setTab('trade')
  }

  const tabs: [PanelTab, string][] = [
    ['props', `Mülklerim${myProps.length ? ` · ${myProps.length}` : ''}`],
    ['players', 'Oyuncular'],
    ['all', 'Tüm tapular'],
    ['log', 'Olaylar'],
    ...(composer ? ([['trade', 'Takas']] as [PanelTab, string][]) : []),
    ['deed', 'Tapu'],
  ]

  return (
    <div data-ls-wide className="@container/mono">
      <div className="flex flex-col gap-3 @3xl/mono:grid @3xl/mono:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] @3xl/mono:grid-rows-[auto_auto_1fr] @3xl/mono:items-start @3xl/mono:gap-4 [.ls-split_&]:grid [.ls-split_&]:h-[var(--ls-h,100svh)] [.ls-split_&]:grid-cols-[minmax(0,1fr)_15rem] [.ls-split_&]:grid-rows-[auto_auto_minmax(0,1fr)] [.ls-split_&]:items-stretch [.ls-split_&]:gap-x-2 [.ls-split_&]:gap-y-1.5 [.ls-split_&]:overflow-hidden">
        <section aria-label="Oyuncular" className="flex flex-col gap-2 @3xl/mono:col-start-2 @3xl/mono:row-start-1 [.ls-split_&]:col-start-2 [.ls-split_&]:row-start-1 [.ls-split_&]:min-h-0 [.ls-split_&]:gap-1">
          {remote.spectator && (
            <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
              <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun.
            </p>
          )}
          <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 pr-8 [mask-image:linear-gradient(to_right,black_88%,transparent)] @3xl/mono:mx-0 @3xl/mono:pr-0 @3xl/mono:[mask-image:none] @3xl/mono:grid @3xl/mono:max-h-80 @3xl/mono:grid-cols-1 @3xl/mono:overflow-y-auto @3xl/mono:px-0 [.ls-split_&]:mx-0 [.ls-split_&]:grid [.ls-split_&]:max-h-[7.5rem] [.ls-split_&]:grid-cols-2 [.ls-split_&]:gap-1 [.ls-split_&]:overflow-y-auto [.ls-split_&]:px-0 [.ls-split_&]:pb-0 [.ls-split_&]:pr-0 [.ls-split_&]:[mask-image:none]">
            {s.players.map((p, i) => (
              <PlayerChip
                key={i}
                seat={i}
                name={nameOf(i)}
                money={displayMoney[i] ?? p.money}
                delta={deltas ? { id: deltas.id, value: deltas.values[i] ?? 0 } : null}
                worth={netWorth(s, i)}
                deeds={deedsOf(s, i).length}
                houses={housesOf(s, i)}
                isBot={s.bots.includes(i)}
                inJail={p.inJail}
                hasCard={p.cards > 0}
                out={p.out}
                active={s.turn === i && !p.out}
                onOpen={() => setTab('players')}
              />
            ))}
          </ul>
        </section>

        <div className="@3xl/mono:col-start-1 @3xl/mono:row-span-3 @3xl/mono:row-start-1 [.ls-split_&]:col-start-1 [.ls-split_&]:row-span-3 [.ls-split_&]:row-start-1 [.ls-split_&]:h-full [.ls-split_&]:min-h-0">
          <div className="rounded-2xl bg-wood p-1.5 shadow-[0_24px_50px_-20px_oklch(0_0_0/0.8)] sm:p-2.5 [.ls-split_&]:h-full [.ls-split_&]:p-1">
            <div className="relative h-[min(64svh,560px)] overflow-hidden rounded-xl bg-[#0b1020] @3xl/mono:h-[min(calc(100svh-8rem),780px)] [.ls-split_&]:h-full">
              <TableBrand center={false} corners={false} jako={false} plaque="bottom" className="z-20" />
              <MonopolyBoard3D
                s={s}
                shownPos={shownPos}
                shownTurn={shownTurn}
                tokenColors={TOKEN_COLOR}
                follow={follow}
                moneyDelta={deltas}
                onSelect={openDeed}
              />
              <BoardHud
                s={s}
                walking={walking}
                activeName={active ? nameOf(shownTurn) : ''}
                activeSquareIndex={active?.pos ?? 0}
                note={s.note ? fill(s.note) : ownTurn ? 'Sıra sende.' : `${nameOf(s.turn)} oynuyor`}
                batch={batch}
                nameOf={nameOf}
                follow={follow}
                onToggleFollow={() => setFollow((f) => !f)}
              />
            </div>
          </div>
        </div>

        <section aria-label="Hamle" className="z-30 flex flex-col gap-3 max-lg:sticky max-lg:bottom-0 max-lg:pb-[env(safe-area-inset-bottom)] @3xl/mono:col-start-2 @3xl/mono:row-start-2 [.ls-split_&]:static [.ls-split_&]:col-start-2 [.ls-split_&]:row-start-2 [.ls-split_&]:max-h-[calc(var(--ls-h,100svh)-9rem)] [.ls-split_&]:gap-1.5 [.ls-split_&]:overflow-y-auto [.ls-split_&]:pb-0">
          {!walking && batch.some((e) => e.kind !== 'roll' && e.kind !== 'info') && (
            <EventSpotlight events={batch} nameOf={nameOf} tokenColor={TOKEN_COLOR} />
          )}
          <ActionPanel
            s={s}
            me={me}
            myTurn={myTurn}
            ownTurn={ownTurn}
            canTrade={canTrade}
            busy={remote.busy}
            walking={walking}
            send={remote.send}
            nameOf={nameOf}
            activeName={active ? nameOf(shownTurn) : ''}
            activeSquareIndex={active?.pos ?? 0}
            ownerName={activeSquare && s.owner[active!.pos] != null ? nameOf(s.owner[active!.pos]!) : null}
            onOpenDeed={openDeed}
            onTrade={() => startTrade(null)}
            onCounter={() => {
              const t = s.trade!
              setComposer({ target: t.from, counter: { give: t.take, take: t.give, to: t.from } })
              setTab('trade')
            }}
            gameOver={alive <= 1}
          />
        </section>

        <section aria-label="Ayrıntılar" className="overflow-hidden rounded-2xl border border-border bg-card @3xl/mono:col-start-2 @3xl/mono:row-start-3 [.ls-split_&]:col-start-2 [.ls-split_&]:row-start-3 [.ls-split_&]:flex [.ls-split_&]:min-h-0 [.ls-split_&]:flex-col">
          <div role="tablist" aria-label="Panel" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-1.5 [.ls-split_&]:flex-wrap [.ls-split_&]:overflow-visible [.ls-split_&]:p-1">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors [.ls-split_&]:px-2 [.ls-split_&]:py-1.5',
                  tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-3 [.ls-split_&]:min-h-0 [.ls-split_&]:flex-1 [.ls-split_&]:overflow-y-auto [.ls-split_&]:p-2">
            {tab === 'deed' &&
              (focus != null ? (
                <DeedCard i={focus} s={s} ownerName={s.owner[focus] != null ? nameOf(s.owner[focus]!) : null} />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">Ayrıntılarını görmek için tahtada bir kareye dokun.</p>
              ))}

            {tab === 'players' && <PlayersPanel s={s} me={me} nameOf={nameOf} canTrade={canTrade} onTrade={startTrade} />}
            {tab === 'all' && <AllDeedsPanel s={s} me={me} nameOf={nameOf} />}
            {tab === 'log' && <EventFeed feed={feed} nameOf={nameOf} tokenColor={TOKEN_COLOR} />}
            {tab === 'trade' &&
              (composer && me >= 0 && (canTrade || (composer.counter && s.trade?.to === me)) ? (
                <TradeComposer
                  key={`${composer.target}-${composer.counter ? 'c' : 'p'}`}
                  s={s}
                  me={me}
                  initialTarget={composer.target}
                  counter={composer.counter}
                  nameOf={nameOf}
                  busy={remote.busy}
                  send={remote.send}
                  onClose={() => {
                    setComposer(null)
                    setTab('players')
                  }}
                />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">Takası kendi sıranda, zar atmadan önce ya da turu bitirmeden önce teklif edebilirsin.</p>
              ))}

            {tab === 'props' &&
              (me < 0 ? (
                <p className="text-sm text-muted-foreground">İzleyici modundasın.</p>
              ) : myProps.length === 0 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">Henüz tapun yok. Sahipsiz bir kareye gelince satın alabilir ya da mezatta teklif verebilirsin.</p>
              ) : (
                <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                  {myProps.map((i) => {
                    const sq = BOARD[i]
                    const debt = s.phase === 'debt'
                    return (
                      <li key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-2">
                        <button type="button" onClick={() => openDeed(i)} className="flex items-center gap-2 text-left text-sm">
                          <span className="h-6 w-2 shrink-0 rounded-sm" style={{ background: deedColor(i) }} aria-hidden="true" />
                          <span className={cn('min-w-0 flex-1 truncate font-semibold text-foreground', s.mortgaged[i] && 'line-through opacity-60')}>{sq.name}</span>
                          {s.houses[i] > 0 && (
                            <span className="flex items-center gap-0.5 text-xs font-bold text-primary">
                              {s.houses[i] === 5 ? <Hotel className="size-3.5" aria-label="Otel" /> : <><Home className="size-3.5" aria-hidden="true" /> {s.houses[i]}</>}
                            </span>
                          )}
                        </button>
                        {canManage && ((!debt && canBuild(s, me, i)) || canSell(s, me, i) || canMortgage(s, me, i) || (!debt && s.mortgaged[i])) && (
                          <span className="flex flex-wrap gap-1">
                            {!debt && canBuild(s, me, i) && (
                              <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'build', pos: i })}>
                                {s.houses[i] === 4 ? 'Otel dik' : 'Ev dik'} · {(sq as { house: number }).house} ₺
                              </MiniButton>
                            )}
                            {canSell(s, me, i) && (
                              <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'sell', pos: i })}>
                                Ev sat · +{(sq as { house: number }).house / 2} ₺
                              </MiniButton>
                            )}
                            {canMortgage(s, me, i) && (
                              <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'mortgage', pos: i })}>
                                İpotekle · +{isBuyable(sq) ? sq.price / 2 : 0} ₺
                              </MiniButton>
                            )}
                            {!debt && s.mortgaged[i] && (
                              <MiniButton disabled={remote.busy || (myPlayer?.money ?? 0) < unmortgageCost(i)} onClick={() => remote.send({ type: 'unmortgage', pos: i })}>
                                İpoteği kaldır · {unmortgageCost(i)} ₺
                              </MiniButton>
                            )}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ))}
          </div>
        </section>
      </div>

      {sheet && focus != null && (
        <div className="fixed inset-0 z-[70] flex items-end bg-background/60 backdrop-blur-sm lg:hidden" onClick={() => setSheet(false)}>
          <div
            role="dialog"
            aria-label={BOARD[focus].name}
            className="w-full rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-[mono-event-in_300ms_ease-out_both]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="mx-auto h-1 w-10 rounded-full bg-muted" aria-hidden="true" />
              <button type="button" onClick={() => setSheet(false)} className="absolute right-4 rounded-lg p-1 text-muted-foreground" aria-label="Kapat">
                <X className="size-5" />
              </button>
            </div>
            <DeedCard i={focus} s={s} ownerName={s.owner[focus] != null ? nameOf(s.owner[focus]!) : null} />
          </div>
        </div>
      )}
    </div>
  )
}

type PanelTab = 'deed' | 'props' | 'players' | 'all' | 'log' | 'trade'

function PlayerChip({
  seat,
  name,
  money,
  delta,
  worth,
  deeds,
  houses,
  isBot,
  inJail,
  hasCard,
  out,
  active,
  onOpen,
}: {
  seat: number
  name: string
  money: number
  delta: { id: number; value: number } | null
  worth: number
  deeds: number
  houses: number
  isBot: boolean
  inJail: boolean
  hasCard: boolean
  out: boolean
  active: boolean
  onOpen: () => void
}) {
  return (
    <li className="relative shrink-0 snap-start @3xl/mono:shrink [.ls-split_&]:shrink">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-40 min-w-0 items-center gap-2 rounded-xl border bg-card p-1.5 pr-2 text-left transition-colors @3xl/mono:w-full sm:gap-2.5 sm:p-2 [.ls-split_&]:w-full [.ls-split_&]:gap-1.5 [.ls-split_&]:p-1 [.ls-split_&]:pr-1.5',
          delta && delta.value < 0 && 'motion-safe:animate-[bj-lose-shake_450ms_ease-in-out]',
          active ? 'border-primary bg-primary/10' : 'border-border',
          out && 'opacity-45 grayscale',
        )}
      >
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full border-2 sm:size-10 [.ls-split_&]:size-7" style={{ borderColor: TOKEN_COLOR[seat] }}>
          <img src={`/images/monopoly/pawn-${seat}.png`} alt="" className="size-full scale-[1.6] object-cover object-[50%_32%]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-bold text-foreground [.ls-split_&]:text-xs">
            {isBot && <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bot" />}
            <span className="truncate">{name}</span>
            {inJail && <Lock className="size-3.5 shrink-0 text-destructive" aria-label="Hapiste" />}
            {hasCard && <KeyRound className="size-3.5 shrink-0 text-primary" aria-label="Hapisten çıkış kartı" />}
          </span>
          {out ? (
            <span className="block text-xs text-muted-foreground">İflas etti</span>
          ) : (
            <>
              <span className="block truncate text-xs font-bold tabular-nums text-foreground">{money.toLocaleString('tr-TR')} ₺</span>
              <span className="block truncate text-[10px] tabular-nums text-muted-foreground [.ls-split_&]:hidden">
                {deeds} tapu · {houses} ev · servet {worth.toLocaleString('tr-TR')}
              </span>
            </>
          )}
        </span>
        {active && <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-label="Sırada" />}
      </button>
      {delta && delta.value !== 0 && <MoneyFloat key={delta.id} id={delta.id} delta={delta.value} />}
    </li>
  )
}

function BoardHud({
  s,
  walking,
  activeName,
  activeSquareIndex,
  note,
  batch,
  nameOf,
  follow,
  onToggleFollow,
}: {
  s: MonopolyState
  walking: boolean
  activeName: string
  activeSquareIndex: number
  note: string
  batch: GameEvent[]
  nameOf: (seat: number) => string
  follow: boolean
  onToggleFollow: () => void
}) {
  const sq = BOARD[activeSquareIndex]
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : INK
  const roll = s.dice ?? s.lastRoll?.dice ?? null

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between gap-2 p-1.5 sm:p-3">
      <div className="flex items-start justify-between gap-1.5">
        <p
          className="line-clamp-2 min-w-0 flex-1 rounded-lg bg-[#0d1324]/75 px-2 py-1 text-[11px] font-semibold leading-snug text-[#f4efe4] backdrop-blur sm:max-w-md sm:flex-none sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm"
          aria-live="polite"
        >
          {walking ? `${activeName} ilerliyor…` : note}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-[#0d1324]/75 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9aa6c2] backdrop-blur sm:text-[11px]">
            {s.maxRounds > 0 ? `Tur ${Math.min(s.round, s.maxRounds)}/${s.maxRounds}` : `Tur ${s.round}`}
            {s.rules?.kumbara ? ` · ${(s.pot ?? 0).toLocaleString('tr-TR')} ₺` : ''}
          </span>
          <button
            type="button"
            onClick={onToggleFollow}
            aria-pressed={!follow}
            className="pointer-events-auto rounded-lg border border-white/10 bg-[#0d1324]/80 px-2 py-1 text-[11px] font-semibold text-[#f4efe4] backdrop-blur transition-colors hover:border-[#e8b931] sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
          >
            {follow ? 'Tüm tahta' : 'Takip et'}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {roll && (
          <div className="flex max-w-full items-center gap-2 rounded-full bg-[#0d1324]/80 py-1 pl-1 pr-3 text-[#f4efe4] backdrop-blur">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full" style={{ background: color, color: WHITE }}>
              <MapPin className="size-3.5" aria-hidden="true" />
            </span>
            <span className="truncate font-display text-xs font-bold sm:text-sm">
              {s.dice
                ? `${roll[0]} + ${roll[1]} = ${roll[0] + roll[1]}${roll[0] === roll[1] ? ' · Çift!' : ''}${walking ? '' : ` · ${sq.name}`}`
                : `${nameOf(s.lastRoll!.seat)} attı · ${roll[0] + roll[1]}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function ActionPanel({
  s,
  me,
  myTurn,
  ownTurn,
  canTrade,
  busy,
  walking,
  send,
  nameOf,
  activeName,
  activeSquareIndex,
  ownerName,
  onOpenDeed,
  onTrade,
  onCounter,
  gameOver,
}: {
  s: MonopolyState
  me: number
  myTurn: boolean
  ownTurn: boolean
  canTrade: boolean
  busy: boolean
  walking: boolean
  send: Remote<MonopolyState>['send']
  nameOf: (seat: number) => string
  activeName: string
  activeSquareIndex: number
  ownerName: string | null
  onOpenDeed: (i: number) => void
  onTrade: () => void
  onCounter: () => void
  gameOver: boolean
}) {
  const sq = BOARD[activeSquareIndex]
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : 'oklch(0.45 0.02 160)'
  const light = sq.type === 'property' && LIGHT_GROUPS.includes(sq.group)
  const myPlayer = me >= 0 ? s.players[me] : null
  const canAct = ownTurn && myPlayer && !walking
  const highlight = myTurn && !walking

  let body: React.ReactNode
  if (gameOver) body = <FinalStandings s={s} nameOf={nameOf} />
  else if (s.trade) body = <TradeOfferCard s={s} me={me} nameOf={nameOf} busy={busy} send={send} onCounter={onCounter} />
  else if (s.auction && !walking) body = <AuctionPanel s={s} me={me} nameOf={nameOf} busy={busy} send={send} />
  else if (canAct && s.phase === 'debt' && s.debt) body = <DebtPanel s={s} me={me} busy={busy} send={send} nameOf={nameOf} />
  else if (canAct)
    body = (
      <div className="flex flex-col gap-2">
        {s.phase === 'roll' && (
          <>
            <ActionButton primary disabled={busy} onClick={() => send({ type: 'roll' })}>
              <Dice5 className="size-5" aria-hidden="true" /> {myPlayer.inJail ? 'Çift için zar at' : 'Zar at'}
            </ActionButton>
            {myPlayer.inJail && (
              <div className="grid grid-cols-2 gap-2">
                <ActionButton disabled={busy || myPlayer.money < JAIL_FINE} onClick={() => send({ type: 'payJail' })}>
                  {JAIL_FINE} ₺ öde
                </ActionButton>
                <ActionButton disabled={busy || myPlayer.cards === 0} onClick={() => send({ type: 'useCard' })}>
                  <KeyRound className="size-4" aria-hidden="true" /> Kart
                </ActionButton>
              </div>
            )}
          </>
        )}
        {s.phase === 'buy' && isBuyable(sq) && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <ActionButton primary disabled={busy || myPlayer.money < sq.price} onClick={() => send({ type: 'buy' })}>
              Satın al · {sq.price} ₺
            </ActionButton>
            <ActionButton disabled={busy} onClick={() => send({ type: 'pass' })}>
              <Gavel className="size-4" aria-hidden="true" /> Mezata
            </ActionButton>
          </div>
        )}
        {s.phase === 'end' && (
          <ActionButton primary disabled={busy} onClick={() => send({ type: 'end' })}>
            Turu bitir
          </ActionButton>
        )}
        {canTrade && s.phase !== 'debt' && (
          <button type="button" onClick={onTrade} className="flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
            <ArrowLeftRight className="size-4" aria-hidden="true" /> Takas teklif et
          </button>
        )}
      </div>
    )
  else
    body = (
      <p className="rounded-xl bg-secondary px-3 py-3 text-center text-sm font-semibold text-muted-foreground">
        {ownTurn && walking ? 'Piyon yürüyor…' : me < 0 ? 'İzliyorsun' : `${activeName} oynuyor, sıranı bekle`}
      </p>
    )

  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-3 max-lg:shadow-[0_-12px_30px_-12px_oklch(0_0_0/0.35)]', highlight ? 'border-primary' : 'border-border')}>
      {!s.auction && !s.trade && !gameOver && (
        <button type="button" onClick={() => onOpenDeed(activeSquareIndex)} className="flex items-stretch overflow-hidden rounded-xl border border-border text-left max-lg:hidden">
          <span className="flex w-12 shrink-0 items-center justify-center" style={{ background: color, color: light ? INK : WHITE }}>
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
            <span className="text-xs text-muted-foreground">{walking ? `${activeName} ilerliyor` : `${activeName} şurada`}</span>
            <span className="truncate font-bold text-foreground">{sq.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {isBuyable(sq) ? (ownerName ? `Sahibi ${ownerName}${s.mortgaged[activeSquareIndex] ? ' · ipotekli' : ''}` : `Sahipsiz · ${sq.price} ₺`) : sq.type === 'tax' ? `${sq.amount} ₺ vergi` : 'Özel kare'}
            </span>
          </span>
        </button>
      )}
      {body}
    </div>
  )
}

function DeedCard({ i, s, ownerName }: { i: number; s: MonopolyState; ownerName: string | null }) {
  const sq = BOARD[i]
  if (!isBuyable(sq)) {
    return (
      <div className="rounded-xl border border-border p-3 text-sm">
        <p className="font-bold text-foreground">{sq.name}</p>
        <p className="leading-relaxed text-muted-foreground">
          {sq.type === 'tax'
            ? `Buraya gelen ${sq.amount} ₺ vergi öder.`
            : sq.type === 'chance' || sq.type === 'chest'
              ? 'Buraya gelen bir kart çeker.'
              : sq.type === 'gotojail'
                ? 'Buraya gelen doğrudan hapse girer.'
                : sq.type === 'jail'
                  ? 'Hapis ya da sadece ziyaret.'
                  : sq.type === 'go'
                    ? s.rules?.goDouble ? "Başla'dan geçen 200 ₺, tam gelen 400 ₺ alır." : "Başla'dan her geçişte 200 ₺ maaş alınır."
                    : sq.type === 'parking' && s.rules?.kumbara ? `Otopark kumbarası: ${s.pot ?? 0} ₺. Buraya gelen hepsini alır.` : 'Burada bir şey olmaz, dinlen.'}
        </p>
      </div>
    )
  }
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : 'oklch(0.45 0.02 160)'
  const light = sq.type === 'property' && LIGHT_GROUPS.includes(sq.group)
  return (
    <div className="mx-auto max-w-xs overflow-hidden rounded-lg border-2 text-xs shadow-lg" style={{ borderColor: INK, background: WHITE, color: INK }}>
      <div className="m-1.5 rounded-sm p-2 text-center" style={{ background: color, color: light ? INK : WHITE }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest">Tapu senedi</p>
        <p className="text-base font-black uppercase">{sq.name}</p>
      </div>
      <div className="flex flex-col gap-0.5 px-3 pb-3 pt-1">
        {sq.type === 'property' ? (
          <>
            {['Kira', '1 evli', '2 evli', '3 evli', '4 evli', 'Otelli'].map((label, k) => (
              <p key={label} className={cn('flex justify-between', s.houses[i] === k && s.owner[i] != null && 'font-black')}>
                <span>{label}</span>
                <span className="tabular-nums">{sq.rent[k]} ₺</span>
              </p>
            ))}
            <p className="mt-1 text-[10px] leading-snug opacity-75">{s.rules?.doubleRent ? 'Ev kuralı: evsiz kira 2 kat. ' : ''}Grubun tamamı sende ise boş arsa kirası iki katıdır. Ev / otel: {sq.house} ₺</p>
          </>
        ) : sq.type === 'rail' ? (
          ['1 istasyon', '2 istasyon', '3 istasyon', '4 istasyon'].map((label, k) => (
            <p key={label} className="flex justify-between">
              <span>{label}</span>
              <span className="tabular-nums">{25 * 2 ** k} ₺</span>
            </p>
          ))
        ) : (
          <p>Bir idare: zarın 4 katı. İki idare: zarın 10 katı.</p>
        )}
        <p className="mt-1 border-t pt-1" style={{ borderColor: INK }}>
          Fiyat {sq.price} ₺ · ipotek {sq.price / 2} ₺
        </p>
        <p className="font-bold">{ownerName ? `Sahibi: ${ownerName}${s.mortgaged[i] ? ' (ipotekli)' : ''}` : 'Sahipsiz'}</p>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold uppercase tracking-wide transition-transform active:scale-[0.98] disabled:opacity-40 [.ls-split_&]:min-h-10 [.ls-split_&]:gap-1.5 [.ls-split_&]:whitespace-nowrap [.ls-split_&]:px-2.5 [.ls-split_&]:text-xs [.ls-split_&]:tracking-normal',
        primary ? 'bg-primary text-primary-foreground shadow-[0_4px_0_oklch(0_0_0/0.3)]' : 'border border-border bg-secondary text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function MiniButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40">
      {children}
    </button>
  )
}
