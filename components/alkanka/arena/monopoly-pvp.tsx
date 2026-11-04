'use client'

import { useCallback, useEffect, useState } from 'react'
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
  ScrollText,
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

import type { Playback } from './monopoly-board-3d'

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
  TOKEN_COLOR,
  TradeComposer,
  TradeOfferCard,
} from './monopoly-panels'

const LIGHT_GROUPS: Group[] = ['lightblue', 'yellow']
const INK = 'oklch(0.22 0.02 160)'
const WHITE = 'oklch(0.985 0 0)'

type Open = { kind: 'player'; seat: number } | { kind: 'tool'; tab: PanelTab } | null

/** Hides the event card a few seconds after a batch of moves has finished playing. */
function useSpotlight(batch: GameEvent[], walking: boolean) {
  const key = batch.map((e) => e.id).join(',')
  const [hidden, setHidden] = useState('')
  useEffect(() => {
    if (!key || walking) return
    const t = window.setTimeout(() => setHidden(key), 4200)
    return () => window.clearTimeout(t)
  }, [key, walking])
  return !walking && key !== hidden && batch.some((e) => e.kind !== 'roll' && e.kind !== 'info')
}

export function MonopolyPvp({ remote }: { remote: Remote<MonopolyState> }) {
  const s = remote.state
  const me = remote.spectator ? -1 : remote.seat
  const myTurn = remote.myTurn
  const [focus, setFocus] = useState<number | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const [follow, setFollow] = useState(true)
  const [composer, setComposer] = useState<{ target: number | null; counter?: { give: Bundle; take: Bundle; to: number } } | null>(null)
  const [play, setPlay] = useState<Playback>(() => ({ walking: false, walker: null, shown: s.players.map((p) => p.pos) }))
  const nameOf = (seat: number) => (seat === me ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const fill = (t: string) => t.replace(/@(\d)/g, (_, d) => nameOf(Number(d)))

  const walking = play.walking
  const shownTurn = walking && play.walker !== null ? play.walker : s.turn
  const { feed, batch } = useEventFeed(s.log, walking)
  const { displayMoney, deltas } = useMoneyDeltas(
    s.players.map((p) => p.money),
    walking,
  )
  const showSpot = useSpotlight(batch, walking)

  const myPlayer = me >= 0 ? s.players[me] : null
  const myProps = me >= 0 ? deedsOf(s, me) : []
  const active = s.players[s.turn]
  const activeSquare = active ? BOARD[active.pos] : null
  const ownTurn = me >= 0 && s.turn === me && myTurn && !s.auction && !s.trade && !!myPlayer && !myPlayer.out
  const canManage = ownTurn && !walking
  const canTrade = canManage && ['roll', 'end', 'debt'].includes(s.phase)
  const alive = s.players.filter((p) => !p.out).length
  const gameOver = alive <= 1

  const onPlayback = useCallback((p: Playback) => setPlay(p), [])
  const openDeed = useCallback((i: number) => {
    setFocus(i)
    setOpen({ kind: 'tool', tab: 'deed' })
  }, [])
  const startTrade = (target: number | null) => {
    setComposer({ target })
    setOpen({ kind: 'tool', tab: 'trade' })
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const tools: { tab: PanelTab; label: string; icon: typeof Home; badge?: number; hidden?: boolean }[] = [
    { tab: 'props', label: 'Mülklerim', icon: Home, badge: myProps.length, hidden: me < 0 },
    { tab: 'all', label: 'Tüm tapular', icon: Landmark },
    { tab: 'log', label: 'Olaylar', icon: ScrollText },
    { tab: 'trade', label: 'Takas', icon: ArrowLeftRight, hidden: !canTrade && !composer },
  ]
  const toolTitle: Record<PanelTab, string> = {
    props: 'Mülklerim',
    all: 'Tüm tapular',
    log: 'Olaylar',
    trade: 'Takas',
    deed: focus != null ? BOARD[focus].name : 'Tapu',
    players: 'Oyuncular',
  }

  const bigPanel = gameOver
    ? <FinalStandings s={s} nameOf={nameOf} />
    : s.trade
      ? <TradeOfferCard s={s} me={me} nameOf={nameOf} busy={remote.busy} send={remote.send} onCounter={() => {
          const t = s.trade!
          setComposer({ target: t.from, counter: { give: t.take, take: t.give, to: t.from } })
          setOpen({ kind: 'tool', tab: 'trade' })
        }} />
      : s.auction && !walking
        ? <AuctionPanel s={s} me={me} nameOf={nameOf} busy={remote.busy} send={remote.send} />
        : ownTurn && !walking && s.phase === 'debt' && s.debt
          ? <DebtPanel s={s} me={me} busy={remote.busy} send={remote.send} nameOf={nameOf} />
          : null

  const openPlayer = open?.kind === 'player' ? open.seat : null
  const openTab = open?.kind === 'tool' ? open.tab : null

  return (
    <div data-ls-wide className="@container/mono">
      <div className="rounded-2xl bg-wood p-1.5 shadow-[0_24px_50px_-20px_oklch(0_0_0/0.8)] sm:p-2 [.ls-split_&]:p-1">
        <div className="relative h-[min(84svh,780px)] overflow-hidden rounded-xl bg-[#0b1020] landscape:h-[min(calc(100svh-6rem),920px)] [.ls-split_&]:h-[calc(var(--ls-h,100svh)-0.5rem)]">
          <TableBrand center={false} corners={false} jako={false} plaque="bottom" className="z-20" />
          <MonopolyBoard3D
            s={s}
            tokenColors={TOKEN_COLOR}
            follow={follow}
            moneyDelta={deltas}
            onSelect={openDeed}
            onPlayback={onPlayback}
            dock={
              bigPanel ? null : (
                <BoardDock
                  s={s}
                  me={me}
                  ownTurn={ownTurn}
                  walking={walking}
                  canTrade={canTrade}
                  busy={remote.busy}
                  send={remote.send}
                  activeName={active ? nameOf(shownTurn) : ''}
                  activeSquareIndex={active?.pos ?? 0}
                  ownerName={activeSquare && s.owner[active!.pos] != null ? nameOf(s.owner[active!.pos]!) : null}
                  onTrade={() => startTrade(null)}
                  onOpenDeed={openDeed}
                />
              )
            }
          />

          <BoardHud
            s={s}
            note={walking ? `${active ? nameOf(shownTurn) : ''} ilerliyor…` : s.note ? fill(s.note) : ownTurn ? 'Sıra sende.' : `${nameOf(s.turn)} oynuyor`}
            spectator={!!remote.spectator}
          />

          <ul
            aria-label="Oyuncular"
            className="absolute z-30 flex gap-1.5 portrait:inset-x-2 portrait:top-11 portrait:justify-center portrait:overflow-x-auto landscape:left-2 landscape:top-12 landscape:bottom-10 landscape:flex-col landscape:justify-center landscape:overflow-y-auto sm:landscape:left-3"
          >
            {s.players.map((p, i) => (
              <PlayerBubble
                key={i}
                seat={i}
                name={nameOf(i)}
                money={displayMoney[i] ?? p.money}
                delta={deltas ? { id: deltas.id, value: deltas.values[i] ?? 0 } : null}
                isBot={s.bots.includes(i)}
                inJail={p.inJail}
                out={p.out}
                active={shownTurn === i && !p.out}
                open={openPlayer === i}
                onOpen={() => setOpen(openPlayer === i ? null : { kind: 'player', seat: i })}
              />
            ))}
          </ul>

          <nav
            aria-label="Masa araçları"
            className="absolute z-30 flex gap-2 portrait:bottom-8 portrait:left-1/2 portrait:-translate-x-1/2 landscape:right-2 landscape:top-1/2 landscape:-translate-y-1/2 landscape:flex-col sm:landscape:right-3"
          >
            {tools.filter((t) => !t.hidden).map((t) => (
              <ToolBubble
                key={t.tab}
                label={t.label}
                icon={t.icon}
                badge={t.badge}
                pressed={openTab === t.tab}
                onClick={() => setOpen(openTab === t.tab ? null : { kind: 'tool', tab: t.tab })}
              />
            ))}
            <ToolBubble
              label={follow ? 'Tüm tahtayı göster' : 'Oynayanı takip et'}
              icon={follow ? ZoomOut : ZoomIn}
              pressed={!follow}
              onClick={() => setFollow((f) => !f)}
            />
          </nav>

          {showSpot && (
            <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-16 portrait:top-28 landscape:top-12">
              <div className="w-[min(22rem,100%)]">
                <EventSpotlight events={batch} nameOf={nameOf} tokenColor={TOKEN_COLOR} />
              </div>
            </div>
          )}

          {bigPanel && (
            <div className="absolute inset-x-3 bottom-3 z-40 mx-auto max-h-[78%] w-auto overflow-y-auto rounded-2xl border border-primary bg-card p-3 shadow-2xl landscape:inset-x-0 landscape:bottom-auto landscape:top-1/2 landscape:w-[min(26rem,calc(100%-9rem))] landscape:-translate-y-1/2">
              {bigPanel}
            </div>
          )}

          {open && (
            <>
              <button
                type="button"
                aria-label="Pencereyi kapat"
                className="absolute inset-0 z-[35] cursor-default bg-[#0b1020]/35"
                onClick={() => setOpen(null)}
              />
              <div
                className={cn(
                  'absolute z-40 flex',
                  openPlayer != null
                    ? 'portrait:inset-x-3 portrait:top-28 landscape:bottom-10 landscape:left-16 landscape:top-12 landscape:items-center sm:landscape:left-20'
                    : 'portrait:inset-x-3 portrait:bottom-24 portrait:top-28 portrait:items-end landscape:bottom-3 landscape:right-16 landscape:top-3 landscape:items-center sm:landscape:right-20',
                )}
              >
                <div
                  role="dialog"
                  aria-label={openPlayer != null ? nameOf(openPlayer) : toolTitle[openTab!]}
                  className={cn(
                    'flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl motion-safe:animate-[mono-event-in_260ms_ease-out_both]',
                    openPlayer != null ? 'landscape:w-72' : 'landscape:w-[min(22rem,calc(100cqw-10rem))]',
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <p className="truncate font-display text-sm font-bold">{openPlayer != null ? nameOf(openPlayer) : toolTitle[openTab!]}</p>
                    <button type="button" onClick={() => setOpen(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Kapat">
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {openPlayer != null && (
                      <PlayerDetail
                        s={s}
                        seat={openPlayer}
                        me={me}
                        money={displayMoney[openPlayer] ?? s.players[openPlayer].money}
                        isBot={s.bots.includes(openPlayer)}
                        canTrade={canTrade}
                        onTrade={() => startTrade(openPlayer)}
                        onOpenDeed={openDeed}
                      />
                    )}
                    {openTab === 'deed' &&
                      (focus != null ? (
                        <DeedCard i={focus} s={s} ownerName={s.owner[focus] != null ? nameOf(s.owner[focus]!) : null} />
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground">Ayrıntılarını görmek için tahtada bir kareye dokun.</p>
                      ))}
                    {openTab === 'all' && <AllDeedsPanel s={s} me={me} nameOf={nameOf} />}
                    {openTab === 'log' && <EventFeed feed={feed} nameOf={nameOf} tokenColor={TOKEN_COLOR} />}
                    {openTab === 'trade' &&
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
                            setOpen(null)
                          }}
                        />
                      ) : canTrade ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-sm leading-relaxed text-muted-foreground">Kiminle takas yapmak istiyorsun?</p>
                          {s.players.map((p, i) =>
                            i === me || p.out ? null : (
                              <MiniButton key={i} onClick={() => startTrade(i)}>
                                {nameOf(i)}
                              </MiniButton>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground">Takası kendi sıranda, zar atmadan önce ya da turu bitirmeden önce teklif edebilirsin.</p>
                      ))}
                    {openTab === 'props' &&
                      (me < 0 ? (
                        <p className="text-sm text-muted-foreground">İzleyici modundasın.</p>
                      ) : myProps.length === 0 ? (
                        <p className="text-sm leading-relaxed text-muted-foreground">Henüz tapun yok. Sahipsiz bir kareye gelince satın alabilir ya da mezatta teklif verebilirsin.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
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
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type PanelTab = 'deed' | 'props' | 'players' | 'all' | 'log' | 'trade'

function PlayerBubble({
  seat,
  name,
  money,
  delta,
  isBot,
  inJail,
  out,
  active,
  open,
  onOpen,
}: {
  seat: number
  name: string
  money: number
  delta: { id: number; value: number } | null
  isBot: boolean
  inJail: boolean
  out: boolean
  active: boolean
  open: boolean
  onOpen: () => void
}) {
  return (
    <li className="relative shrink-0">
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        aria-label={`${name}${isBot ? ' (bot)' : ''}, ${out ? 'iflas etti' : `${money.toLocaleString('tr-TR')} ₺`}${active ? ', sırada' : ''}`}
        className={cn(
          'group flex flex-col items-center gap-0.5 rounded-2xl p-0.5 transition-transform active:scale-95',
          delta && delta.value < 0 && 'motion-safe:animate-[bj-lose-shake_450ms_ease-in-out]',
          out && 'opacity-45 grayscale',
        )}
      >
        <span
          className={cn(
            'relative block size-10 overflow-hidden rounded-full border-2 bg-[#0d1324] shadow-lg transition-shadow sm:size-11',
            active && 'ring-2 ring-primary ring-offset-2 ring-offset-[#0b1020] motion-safe:animate-pulse',
            open && 'ring-2 ring-foreground ring-offset-2 ring-offset-[#0b1020]',
          )}
          style={{ borderColor: TOKEN_COLOR[seat] }}
        >
          <img src={`/images/monopoly/pawn-${seat}.png`} alt="" className="size-full scale-[1.6] object-cover object-[50%_32%]" />
          {(isBot || inJail) && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#0d1324] text-[#f4efe4]">
              {inJail ? <Lock className="size-2.5 text-destructive" aria-hidden="true" /> : <Bot className="size-2.5" aria-hidden="true" />}
            </span>
          )}
        </span>
        <span className="max-w-16 truncate rounded-full bg-[#0d1324]/85 px-1.5 text-[10px] font-bold leading-4 tabular-nums text-[#f4efe4] backdrop-blur">
          {out ? 'İflas' : `${money.toLocaleString('tr-TR')} ₺`}
        </span>
      </button>
      {delta && delta.value !== 0 && <MoneyFloat key={delta.id} id={delta.id} delta={delta.value} />}
    </li>
  )
}

function ToolBubble({
  label,
  icon: Icon,
  badge,
  pressed,
  onClick,
}: {
  label: string
  icon: typeof Home
  badge?: number
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex size-10 items-center justify-center rounded-full border shadow-lg backdrop-blur transition-all active:scale-95 sm:size-11',
        pressed ? 'border-primary bg-primary text-primary-foreground' : 'border-white/10 bg-[#0d1324]/85 text-[#f4efe4] hover:border-primary',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {!!badge && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  )
}

function PlayerDetail({
  s,
  seat,
  me,
  money,
  isBot,
  canTrade,
  onTrade,
  onOpenDeed,
}: {
  s: MonopolyState
  seat: number
  me: number
  money: number
  isBot: boolean
  canTrade: boolean
  onTrade: () => void
  onOpenDeed: (i: number) => void
}) {
  const p = s.players[seat]
  const deeds = deedsOf(s, seat)
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: TOKEN_COLOR[seat] }}>
          <img src={`/images/monopoly/pawn-${seat}.png`} alt="" className="size-full scale-[1.6] object-cover object-[50%_32%]" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold tabular-nums">{p.out ? 'İflas etti' : `${money.toLocaleString('tr-TR')} ₺`}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Servet {netWorth(s, seat).toLocaleString('tr-TR')} ₺ · {housesOf(s, seat)} ev
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isBot && <span className="flex items-center gap-1"><Bot className="size-3.5" aria-hidden="true" /> Bot</span>}
            {p.inJail && <span className="flex items-center gap-1 text-destructive"><Lock className="size-3.5" aria-hidden="true" /> Hapiste</span>}
            {p.cards > 0 && <span className="flex items-center gap-1 text-primary"><KeyRound className="size-3.5" aria-hidden="true" /> Çıkış kartı</span>}
            <span>{BOARD[p.pos].name}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tapular · {deeds.length}</p>
        {deeds.length === 0 ? (
          <p className="text-xs text-muted-foreground">Henüz tapusu yok.</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {deeds.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onOpenDeed(i)}
                  className={cn('flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-1.5 py-1 text-xs font-semibold hover:bg-secondary', s.mortgaged[i] && 'line-through opacity-60')}
                >
                  <span className="h-3 w-1.5 rounded-sm" style={{ background: deedColor(i) }} aria-hidden="true" />
                  {BOARD[i].name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {canTrade && seat !== me && !p.out && (
        <ActionButton onClick={onTrade}>
          <ArrowLeftRight className="size-4" aria-hidden="true" /> Takas teklif et
        </ActionButton>
      )}
    </div>
  )
}

function BoardHud({ s, note, spectator }: { s: MonopolyState; note: string; spectator: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-1.5 sm:p-2.5">
      <p
        className="line-clamp-2 min-w-0 max-w-md rounded-xl bg-[#0d1324]/80 px-2.5 py-1.5 text-xs font-semibold leading-snug text-[#f4efe4] backdrop-blur sm:text-sm"
        aria-live="polite"
      >
        {spectator && <Eye className="mr-1 inline size-3.5 text-primary" aria-label="İzliyorsun" />}
        {note}
      </p>
      <span className="shrink-0 rounded-full bg-[#0d1324]/80 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9aa6c2] backdrop-blur">
        {s.maxRounds > 0 ? `Tur ${Math.min(s.round, s.maxRounds)}/${s.maxRounds}` : `Tur ${s.round}`}
        {s.rules?.kumbara ? ` · ${(s.pot ?? 0).toLocaleString('tr-TR')} ₺` : ''}
      </span>
    </div>
  )
}

/** The current player's actions, floating on the board right below the dice. */
function BoardDock({
  s,
  me,
  ownTurn,
  walking,
  canTrade,
  busy,
  send,
  activeName,
  activeSquareIndex,
  ownerName,
  onTrade,
  onOpenDeed,
}: {
  s: MonopolyState
  me: number
  ownTurn: boolean
  walking: boolean
  canTrade: boolean
  busy: boolean
  send: Remote<MonopolyState>['send']
  activeName: string
  activeSquareIndex: number
  ownerName: string | null
  onTrade: () => void
  onOpenDeed: (i: number) => void
}) {
  const sq = BOARD[activeSquareIndex]
  const myPlayer = me >= 0 ? s.players[me] : null
  const canAct = ownTurn && !!myPlayer && !walking

  if (!canAct) {
    return (
      <p className="pointer-events-none rounded-full bg-[#0d1324]/80 px-3 py-1.5 text-xs font-semibold text-[#f4efe4] shadow-lg backdrop-blur">
        {walking ? `${activeName} ilerliyor…` : me < 0 ? `${activeName} oynuyor` : `${activeName} oynuyor, sıranı bekle`}
      </p>
    )
  }

  if (s.phase === 'roll' && !myPlayer.inJail) {
    return (
      <div className="flex flex-col items-center gap-1 motion-safe:animate-[mono-event-in_260ms_ease-out_both]">
        <button
          type="button"
          disabled={busy}
          onClick={() => send({ type: 'roll' })}
          className="group flex items-center gap-2 rounded-full border border-primary/40 bg-[#0d1324]/75 py-1 pl-1 pr-4 text-sm font-semibold text-[#f4efe4] shadow-[0_8px_20px_-8px_oklch(0_0_0/0.7)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary active:scale-95 disabled:opacity-40"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:rotate-12">
            <Dice5 className="size-4" aria-hidden="true" />
          </span>
          Zar at
        </button>
        {canTrade && (
          <button type="button" onClick={onTrade} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10">
            <ArrowLeftRight className="size-3" aria-hidden="true" /> Takas
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-[min(15rem,calc(100cqw-8rem))] min-w-48 flex-col gap-1.5 rounded-2xl border border-primary/40 bg-[#0d1324]/85 p-2 text-[#f4efe4] shadow-[0_12px_30px_-8px_oklch(0_0_0/0.7)] backdrop-blur motion-safe:animate-[mono-event-in_260ms_ease-out_both]">
      {s.phase === 'roll' && (
        <>
          <ActionButton primary disabled={busy} onClick={() => send({ type: 'roll' })}>
            <Dice5 className="size-4" aria-hidden="true" /> Çift için zar at
          </ActionButton>
          {myPlayer.inJail && (
            <div className="grid grid-cols-2 gap-1.5">
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
        <>
          <button type="button" onClick={() => onOpenDeed(activeSquareIndex)} className="truncate px-1 text-left text-xs text-[#9aa6c2] hover:text-[#f4efe4]">
            {sq.name} · {ownerName ? `Sahibi ${ownerName}` : 'Sahipsiz'} · tapuyu gör
          </button>
          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <ActionButton primary disabled={busy || myPlayer.money < sq.price} onClick={() => send({ type: 'buy' })}>
              Satın al · {sq.price} ₺
            </ActionButton>
            <ActionButton disabled={busy} onClick={() => send({ type: 'pass' })}>
              <Gavel className="size-4" aria-hidden="true" /> Mezat
            </ActionButton>
          </div>
        </>
      )}
      {s.phase === 'end' && (
        <ActionButton primary disabled={busy} onClick={() => send({ type: 'end' })}>
          Turu bitir
        </ActionButton>
      )}
      {canTrade && s.phase !== 'debt' && (
        <button type="button" onClick={onTrade} className="flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-bold text-primary hover:bg-primary/10">
          <ArrowLeftRight className="size-3.5" aria-hidden="true" /> Takas teklif et
        </button>
      )}
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
