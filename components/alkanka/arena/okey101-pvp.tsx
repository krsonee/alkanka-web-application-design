'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDownToLine, Bot, Eye, Layers, Sparkles, Trophy, Undo2, Wand2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  analyzeMeld,
  bestPartition,
  canOpenWithTile,
  findPairs,
  jokerSwapIndex,
  leftOf101,
  OPEN_MIN,
  PAIR_MIN,
  partnerOf101,
  rankTotals101,
  type HandResult,
  type Okey101View,
} from '@/lib/games/okey101'
import type { Remote } from './remote'
import { FeltBranding, TileBack, TileFace } from './okey'
import { okeyFrom, sortHand, type Tile } from './okey-engine'
import { layoutGroups, OkeyRack, RACK_COLS, useRack, type SlotMark } from './okey-rack'

type OkeyValue = ReturnType<typeof okeyFrom>
type Segment = { tiles: Tile[]; slots: number[]; kind: 'run' | 'set' | 'pair'; value: number }
type MainAction = { label: ReactNode; onClick?: () => void; disabled?: boolean; tone: 'primary' | 'danger' | 'muted'; discard?: boolean }

/** Tiles touching each other on the same rack row form one group; empty slots split groups. */
function readSegments(slots: (number | null)[], byId: Map<number, Tile>, okey: OkeyValue): Segment[] {
  const out: Segment[] = []
  for (let row = 0; row < 2; row++) {
    let cur: number[] = []
    const flush = () => {
      if (cur.length >= 2) {
        const tiles = cur.map((i) => byId.get(slots[i]!)!).filter(Boolean)
        const a = analyzeMeld(tiles, okey)
        if (a) out.push({ tiles, slots: cur, kind: a.kind, value: a.value })
      }
      cur = []
    }
    for (let c = 0; c < RACK_COLS; c++) {
      const i = row * RACK_COLS + c
      if (slots[i] != null && byId.has(slots[i]!)) cur.push(i)
      else flush()
    }
    flush()
  }
  return out
}

/** Always-visible "how close am I to opening" gauge: series total toward 101 and pair count toward 5. */
function OpenMeter({ runValue, pairs }: { runValue: number; pairs: number }) {
  const runReady = runValue >= OPEN_MIN
  const pairReady = pairs >= PAIR_MIN
  const pct = Math.min(100, Math.round((runValue / OPEN_MIN) * 100))
  const near = !runReady && runValue >= OPEN_MIN - 20
  return (
    <div className="flex w-full max-w-md items-stretch gap-2" aria-live="polite">
      <div
        key={runReady ? 'ready' : 'wait'}
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1 rounded-xl border px-3 py-1.5',
          runReady ? 'animate-pop border-primary bg-primary/15' : near ? 'border-gold/70 bg-gold/10' : 'border-border bg-card/70',
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Elin (seri)</span>
          <span className="text-sm font-black tabular-nums text-foreground">
            <span className={cn(runReady ? 'text-primary' : near ? 'text-gold' : 'text-foreground')}>{runValue}</span>
            <span className="text-muted-foreground"> / {OPEN_MIN}</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', runReady ? 'bg-primary' : near ? 'bg-gold' : 'bg-muted-foreground/60')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="truncate text-[10px] text-muted-foreground">
          {runReady ? 'Açmaya hazırsın!' : `Açmak için ${OPEN_MIN - runValue} sayı daha`}
        </span>
      </div>
      <div
        className={cn(
          'flex shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-1.5',
          pairReady ? 'border-primary bg-primary/15' : 'border-border bg-card/70',
        )}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Çift</span>
        <span className="text-sm font-black tabular-nums">
          <span className={pairReady ? 'text-primary' : 'text-foreground'}>{pairs}</span>
          <span className="text-muted-foreground"> / {PAIR_MIN}</span>
        </span>
      </div>
    </div>
  )
}

export function Okey101Pvp({ remote }: { remote: Remote<Okey101View> }) {
  const s = remote.state
  const n = s.seats
  const mySeat = remote.spectator ? -1 : remote.seat
  const okey = useMemo(() => okeyFrom(s.indicator), [s.indicator])
  const hand = useMemo(() => (mySeat >= 0 ? s.hands[mySeat] ?? [] : []), [s.hands, mySeat])
  const rack = useRack(hand, okey)
  const [localError, setLocalError] = useState<string | null>(null)
  const [scoresOpen, setScoresOpen] = useState(false)

  const autoLayout = (mode: 'seri' | 'cift') => {
    const groups = mode === 'seri' ? bestPartition(hand, okey).groups : findPairs(hand, okey)
    const used = new Set(groups.flat().map((t) => t.id))
    rack.setLayout(layoutGroups(groups, sortHand(hand.filter((t) => !used.has(t.id)), okey, 'seri')))
  }

  // Each new hand starts with the best possible layout; after that the player's own arrangement is kept turn to turn.
  const [arrangedHand, setArrangedHand] = useState<number | null>(null)
  if (hand.length > 0 && arrangedHand !== s.handNo) {
    setArrangedHand(s.handNo)
    autoLayout(s.opened[mySeat] === 'cift' ? 'cift' : 'seri')
  }

  const byId = new Map(hand.map((t) => [t.id, t]))
  const segments = readSegments(rack.slots, byId, okey)
  const runs = segments.filter((g) => g.kind !== 'pair')
  const pairs = segments.filter((g) => g.kind === 'pair')
  const runValue = runs.reduce((a, g) => a + g.value, 0)

  const myTurn = remote.myTurn
  const drawPhase = myTurn && s.phase === 'draw'
  const playPhase = myTurn && s.phase === 'play'
  const opened = mySeat >= 0 ? s.opened[mySeat] : null
  const selected = rack.selected
  const canDiscard = playPhase && selected != null && s.taken == null && !remote.busy

  const pairsAllowed = opened === 'seri' && s.opened.some((o) => o === 'cift')
  const pairMode = opened === 'cift' || (!opened && pairs.length >= PAIR_MIN && runValue < OPEN_MIN)
  const layable = pairMode ? pairs : pairsAllowed ? [...runs, ...pairs] : runs
  const marks: SlotMark[] = Array(RACK_COLS * 2).fill(null)
  for (const g of layable) {
    g.slots.forEach((i, k) => (marks[i] = k === 0 ? { label: g.kind === 'pair' ? 'Ç' : String(g.value) } : {}))
  }

  const act = async (action: Parameters<typeof remote.send>[0]) => {
    setLocalError(null)
    const ok = await remote.send(action)
    if (ok) rack.setSelected(null)
    return ok
  }
  const discard = (tileId: number) => {
    if (!playPhase || s.taken != null || remote.busy) return
    act({ type: 'discard', tileId })
  }
  // Which table melds can take a given hand tile — drives highlighting, drag targets and one-tap işleme.
  const canLayOff = playPhase && !!opened && s.taken == null
  const fitsMeld = (tileId: number, meldId: number) => {
    const t = byId.get(tileId)
    const m = s.melds.find((x) => x.id === meldId)
    if (!t || !m || m.kind === 'pair') return false
    const an = analyzeMeld([...m.tiles, t], okey)
    return an != null && an.kind === m.kind
  }
  const fitsFor = (tileId: number | null) => (tileId == null ? [] : s.melds.filter((m) => fitsMeld(tileId, m.id)).map((m) => m.id))
  const selectedFits = canLayOff ? fitsFor(selected) : []
  const swapsFor = (tileId: number | null) => {
    const t = tileId == null ? undefined : byId.get(tileId)
    return t ? s.melds.filter((m) => jokerSwapIndex(t, m, okey) >= 0).map((m) => m.id) : []
  }
  const selectedSwaps = canLayOff ? swapsFor(selected) : []
  const swapJoker = (tileId: number, meldId: number) => {
    if (!canLayOff || remote.busy) return
    act({ type: 'swapJoker', meldId, tileId })
  }
  const [dragHover, setDragHover] = useState<number | null>(null)
  const addTile = (tileId: number, meldId: number) => {
    if (!canLayOff || remote.busy) return
    if (hand.length <= 1) return setLocalError('Atmak için elinde en az bir taş kalmalı.')
    if (!fitsMeld(tileId, meldId)) return setLocalError('Bu taş bu pere işlenmiyor. Sarı yanan perlerden birine bırak.')
    act({ type: 'add', meldId, tileIds: [tileId] })
  }
  const layOffable = canLayOff && hand.length > 1 ? hand.filter((t) => s.melds.some((m) => fitsMeld(t.id, m.id))) : []
  const autoLayOff = () => {
    const t = layOffable[0]
    if (!t) return
    const target = fitsFor(t.id)[0]
    if (target != null) addTile(t.id, target)
  }
  const ids = (list: Segment[]) => list.map((g) => g.tiles.map((t) => t.id))
  const layDown = () => {
    const list = opened === 'cift' ? pairs : pairsAllowed ? [...runs, ...pairs] : runs
    if (list.length === 0) {
      const hint = opened === 'seri' && pairs.length > 0 ? ' Çiftleri yere açabilmen için masada çiftten açan biri olmalı.' : ''
      return setLocalError(`Istakada geçerli grup yok. Taşları boşlukla ayırıp yan yana diz.${hint}`)
    }
    act({ type: 'lay', groups: ids(list) })
  }

  // Hand-over popup: shows each finished hand's scores without having to open the score sheet.
  const [seenResults, setSeenResults] = useState(s.results.length)
  const [handPopup, setHandPopup] = useState<HandResult | null>(null)
  if (s.results.length !== seenResults) {
    setSeenResults(s.results.length)
    const finalHand = s.results.length >= s.handsTotal
    if (s.results.length > seenResults && !finalHand) setHandPopup(s.results[s.results.length - 1])
  }
  useEffect(() => {
    if (!handPopup) return
    const t = setTimeout(() => setHandPopup(null), 5000)
    return () => clearTimeout(t)
  }, [handPopup])

  // Turn hand-over cue: buzz the phone and flash a banner (the chime itself comes from useTableSounds).
  const [prevMyTurn, setPrevMyTurn] = useState(remote.myTurn)
  const [turnFlash, setTurnFlash] = useState(0)
  if (remote.myTurn !== prevMyTurn) {
    setPrevMyTurn(remote.myTurn)
    if (remote.myTurn && !remote.spectator) setTurnFlash((k) => k + 1)
  }
  useEffect(() => {
    if (!turnFlash) return
    if (typeof navigator !== 'undefined') navigator.vibrate?.([40, 60, 40])
    const t = setTimeout(() => setTurnFlash(0), 1400)
    return () => clearTimeout(t)
  }, [turnFlash])

  const nameOf = (seat: number) => (seat === mySeat ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const lastResult = s.results[s.results.length - 1]

  // Seats around the table, counter-clockwise like a real okey table: you take from the player on your left.
  const viewer = mySeat >= 0 ? mySeat : 0
  const at = (off: number) => (viewer + off) % n
  const leftSeat = n >= 2 ? at(n - 1) : null
  const rightSeat = n >= 3 ? at(1) : null
  const topSeat = n === 4 ? at(2) : n === 2 ? at(1) : null
  const top = (seat: number | null) => (seat == null ? undefined : s.discards[seat]?.[s.discards[seat].length - 1])
  const sideSeat = mySeat >= 0 ? leftOf101(mySeat, n) : leftSeat
  const sideTop = top(sideSeat)
  const sideOpens = !!sideTop && (!!opened || canOpenWithTile(hand, sideTop, okey))
  const canTakeSide = drawPhase && !!sideTop && !s.noTake && !remote.busy && sideOpens

  // 101: lowest running total leads (team mode adds the partner's score). Ties share the same rank.
  const hasStandings = s.results.length > 0
  const ranked = rankTotals101(s)
  const rankOf = (seat: number) => 1 + ranked.filter((t) => t < ranked[seat]).length
  const partner = s.team && mySeat >= 0 ? partnerOf101(mySeat, n) : null

  const seatPill = (seat: number | null, vertical?: boolean) =>
    seat == null ? <span /> : (
      <SeatPill
        rank={hasStandings ? rankOf(seat) : undefined}
        total={hasStandings ? ranked[seat] : undefined}
        name={nameOf(seat)}
        bot={s.bots.includes(seat)}
        turn={s.turn === seat}
        count={s.handCounts[seat]}
        status={s.opened[seat] === 'cift' ? 'Çifte gitti' : s.opened[seat] ? 'Açtı' : null}
        partner={seat === partner}
        vertical={vertical}
      />
    )

  const note =
    s.note ||
    (myTurn
      ? s.phase === 'draw'
        ? sideTop && !sideOpens
          ? 'Elin açmadığı için yandan alamazsın, ortadan çek.'
          : 'Ortadan çek ya da soldan gelen taşı al.'
        : s.taken != null
          ? 'Yandan aldığın taşla elini aç, yoksa geri ver (+101 ceza).'
          : opened
            ? 'Per aç, işle, sonra bir taş at.'
            : `Açmak için ${OPEN_MIN} sayı ya da ${PAIR_MIN} çift. Hazır değilsen taş at.`
      : `${nameOf(s.turn)} oynuyor`)

  // One button that always does the next sensible thing; secondary actions sit beside it.
  const main: MainAction = (() => {
    if (drawPhase) return { label: 'Ortadan çek', onClick: () => act({ type: 'draw', from: 'deck' }), disabled: remote.busy, tone: 'primary' }
    if (!playPhase) return { label: `${nameOf(s.turn)} oynuyor`, disabled: true, tone: 'muted' }
    if (!opened && runValue >= OPEN_MIN)
      return { label: <>Elini aç <span className="tabular-nums opacity-80">{runValue}</span></>, onClick: () => act({ type: 'open', mode: 'seri', groups: ids(runs) }), disabled: remote.busy, tone: 'primary' }
    if (!opened && pairs.length >= PAIR_MIN)
      return { label: <>Çifte git <span className="tabular-nums opacity-80">{pairs.length}</span></>, onClick: () => act({ type: 'open', mode: 'cift', groups: ids(pairs) }), disabled: remote.busy, tone: 'primary' }
    if (opened && layable.length > 0) return { label: 'Perleri yere aç', onClick: layDown, disabled: remote.busy, tone: 'primary' }
    if (s.taken != null) return { label: <><Undo2 className="size-4" aria-hidden="true" /> Geri ver</>, onClick: () => act({ type: 'giveBack' }), disabled: remote.busy, tone: 'danger' }
    return {
      label: <><ArrowDownToLine className="size-4" aria-hidden="true" /> {selected != null ? 'Seçili taşı at' : 'Atacağın taşı seç'}</>,
      onClick: () => selected != null && discard(selected),
      disabled: !canDiscard,
      tone: selected != null ? 'primary' : 'muted',
      discard: true,
    }
  })()
  const mainIsDiscard = playPhase && s.taken == null && main.discard === true
  const showGiveBack = playPhase && s.taken != null && main.tone !== 'danger'

  // Melds grouped by owner so it's clear who opened what; you first, then counter-clockwise.
  const owners = Array.from({ length: n }, (_, k) => at(k)).filter((seat) => s.melds.some((m) => m.owner === seat))

  const renderMeld = (m: Okey101View['melds'][number]) => {
    const swap = !selectedFits.includes(m.id) && selectedSwaps.includes(m.id)
    const fits = selectedFits.includes(m.id) || swap
    const dimmed = selected != null && canLayOff && !fits
    const hovered = dragHover === m.id
    return (
      <button
        key={m.id}
        type="button"
        data-drop={canLayOff && m.kind !== 'pair' ? `meld:${m.id}` : undefined}
        disabled={!fits || remote.busy}
        onClick={() => selected != null && (swap ? swapJoker(selected, m.id) : addTile(selected, m.id))}
        aria-label={`${nameOf(m.owner)} peri${swap ? ', gerçek taşı koyup okeyi al' : fits ? ', seçili taşı buraya işle' : ''}`}
        className={cn(
          'relative flex shrink-0 gap-px rounded-md bg-background/30 p-0.5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.4)] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 disabled:cursor-default sm:p-1',
          fits && 'cursor-pointer ring-2 ring-primary hover:-translate-y-0.5 hover:bg-primary/25',
          hovered && 'scale-105 bg-primary/30 ring-4 ring-primary',
          dimmed && 'opacity-40',
        )}
      >
        {fits && (
          <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-1.5 text-[9px] font-bold uppercase leading-4 text-primary-foreground shadow">
            {swap ? 'Okeyi al' : 'İşle'}
          </span>
        )}
        {m.tiles.map((t) => (
          <MeldTile key={t.id} tile={t} okey={okey} />
        ))}
      </button>
    )
  }

  const myTotal = mySeat >= 0 && hasStandings ? ranked[mySeat] : null

  return (
    <div data-game-table className="flex flex-col gap-2 sm:gap-3">
      <div className="flex items-center gap-2">
        {remote.spectator && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
            <Eye className="size-3 text-primary" aria-hidden="true" /> İzleyici
          </span>
        )}
        <p
          className={cn(
            'min-w-0 flex-1 truncate rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm',
            myTurn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
          )}
          aria-live="polite"
        >
          {note}
        </p>
        <button
          type="button"
          onClick={() => setScoresOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary"
          aria-label="Puan tablosunu aç"
        >
          <Trophy className="size-3.5 text-primary" aria-hidden="true" />
          <span className="tabular-nums">
            {s.handNo}/{s.handsTotal}
          </span>
          {myTotal != null && <span className="tabular-nums text-primary">{myTotal}</span>}
        </button>
      </div>

      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border-[6px] border-wood bg-felt shadow-[inset_0_0_80px_rgb(0_0_0/0.55),0_20px_40px_rgb(0_0_0/0.4)] sm:rounded-[2rem] sm:border-[10px]">
        <FeltBranding />
        {turnFlash > 0 && (
          <div key={turnFlash} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden="true">
            <span className="turn-flash rounded-full bg-primary px-5 py-2 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-lg">
              Sıra sende
            </span>
          </div>
        )}
        <div className="relative grid flex-1 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 p-2 pt-4 sm:gap-3 sm:p-4 sm:pt-6">
          <Pile tile={top(topSeat)} count={topSeat != null && n === 4 ? s.discards[topSeat].length : 0} okey={okey} hidden={n !== 4} from={[110, -10]} />
          <div className="flex justify-center">{seatPill(topSeat)}</div>
          <Pile tile={top(rightSeat)} count={rightSeat != null ? s.discards[rightSeat].length : 0} okey={okey} hidden={rightSeat == null} from={[10, 110]} />

          <div className="flex items-center">{seatPill(n >= 3 ? leftSeat : null, true)}</div>

          <div className="flex min-w-0 flex-col items-center gap-2 py-1">
            <div className="flex items-end gap-3">
              <button
                type="button"
                disabled={!drawPhase || remote.busy}
                onClick={() => act({ type: 'draw', from: 'deck' })}
                aria-label={`Ortadan çek, ${s.deckCount} taş kaldı`}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg p-1 transition-transform disabled:cursor-default',
                  drawPhase && 'ring-2 ring-primary hover:-translate-y-0.5 active:scale-95',
                )}
              >
                <span className="relative h-11 w-9">
                  <TileBack className="absolute left-1 top-1 h-10 w-7" />
                  <TileBack className="absolute left-0.5 top-0.5 h-10 w-7" />
                  <TileBack className={cn('absolute left-0 top-0 h-10 w-7', drawPhase && 'animate-bounce')} />
                </span>
                <span className={cn('text-[9px] font-bold uppercase tracking-wider tabular-nums', drawPhase ? 'text-primary' : 'text-foreground/60')}>
                  {drawPhase ? 'Çek' : `${s.deckCount} taş`}
                </span>
              </button>
              <div className="flex flex-col items-center gap-1 p-1">
                <TileFace tile={s.indicator} okey={{ color: -2, num: -2 } as OkeyValue} size="sm" label="Gösterge" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/60">Gösterge</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">{seatPill(rightSeat, true)}</div>

          <Pile
            tile={sideTop}
            count={sideSeat != null ? s.discards[sideSeat].length : 0}
            okey={okey}
            from={n === 2 ? [90, -160] : [10, -110]}
            label={canTakeSide ? 'Yandan al' : 'Soldan'}
            active={canTakeSide}
            onClick={canTakeSide ? () => act({ type: 'draw', from: 'discard' }) : undefined}
          />
          <div className="flex items-end justify-center">{seatPill(viewer)}</div>
          <button
            type="button"
            data-drop="discard"
            disabled={!canDiscard}
            onClick={() => selected != null && discard(selected)}
            aria-label="Seçili taşı buraya at"
            className="flex flex-col items-center gap-1 self-end rounded-lg bg-background/25 p-1 shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)] disabled:cursor-default"
          >
            <span
              className={cn(
                'flex h-8 w-6 items-center justify-center rounded transition-colors sm:h-11 sm:w-8',
                canDiscard ? 'border-2 border-dashed border-primary bg-primary/20' : 'border border-dashed border-foreground/20',
              )}
            >
              {!canDiscard && top(viewer) && (
                <span key={top(viewer)!.id} className="animate-in fade-in zoom-in-75 slide-in-from-top-3 duration-300">
                  <TileFace tile={top(viewer)!} okey={okey} size="xs" />
                </span>
              )}
            </span>
            <span className={cn('text-[8px] font-bold uppercase tracking-wider sm:text-[9px]', canDiscard ? 'text-primary' : 'text-foreground/50')}>
              {canDiscard ? 'Buraya at' : 'Attığın'}
            </span>
          </button>
        </div>

        {owners.length > 0 && (
          <section className="relative z-10 flex flex-col gap-2 border-t border-foreground/10 bg-background/30 p-2 sm:p-3" aria-label="Yerdeki perler">
            {owners.map((seat) => {
              const own = s.melds.filter((m) => m.owner === seat)
              return (
                <div
                  key={seat}
                  className={cn(
                    'flex flex-col gap-1 rounded-xl p-2',
                    seat === mySeat ? 'bg-primary/10 ring-1 ring-primary/40' : seat === partner ? 'bg-foreground/5 ring-1 ring-foreground/15' : 'bg-background/25',
                  )}
                >
                  <p className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider">
                    <span className={cn('truncate', seat === mySeat ? 'text-primary' : 'text-foreground')}>
                      {seat === mySeat ? 'Senin perlerin' : nameOf(seat)}
                    </span>
                    <span className="shrink-0 text-foreground/60">
                      {s.opened[seat] === 'cift' ? 'Çifte gitti' : 'Açtı'} · {own.length} per
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-3 pt-2">{own.map(renderMeld)}</div>
                </div>
              )
            })}
          </section>
        )}
      </div>

      {mySeat >= 0 && (
        <div className={cn('flex flex-col gap-2 rounded-2xl p-1 transition-shadow', myTurn && 'ring-2 ring-primary/60')}>
          <OkeyRack
            hand={hand}
            okey={okey}
            rack={rack}
            marks={marks}
            onDoubleTile={(t) => discard(t.id)}
            onDropHover={(kind) => setDragHover(kind?.startsWith('meld:') ? Number(kind.slice(5)) : null)}
            onDropOut={(id, kind) => {
              setDragHover(null)
              if (kind === 'discard') discard(id)
              else if (kind.startsWith('meld:')) {
                const meldId = Number(kind.slice(5))
                if (!fitsMeld(id, meldId) && swapsFor(id).includes(meldId)) swapJoker(id, meldId)
                else addTile(id, meldId)
              }
            }}
          />

          {localError && (
            <p role="alert" className="px-1 text-xs text-destructive sm:text-sm">
              {localError}
            </p>
          )}

          <div className="flex items-stretch gap-1.5">
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => autoLayout('seri')}
                aria-label="Perlere göre diz"
                className="flex flex-col items-center justify-center gap-0.5 px-2.5 text-[9px] font-bold uppercase text-foreground hover:bg-secondary"
              >
                <Wand2 className="size-4 text-primary" aria-hidden="true" /> Seri
              </button>
              <button
                type="button"
                onClick={() => autoLayout('cift')}
                aria-label="Çiftlere göre diz"
                className="flex flex-col items-center justify-center gap-0.5 border-l border-border px-2.5 text-[9px] font-bold uppercase text-foreground hover:bg-secondary"
              >
                <Layers className="size-4 text-primary" aria-hidden="true" /> Çift
              </button>
            </div>

            <button
              type="button"
              onClick={main.onClick}
              disabled={main.disabled}
              className={cn(
                'flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-50',
                main.tone === 'primary' && 'bg-primary text-primary-foreground shadow-lg shadow-primary/25',
                main.tone === 'danger' && 'bg-destructive text-primary-foreground',
                main.tone === 'muted' && 'bg-secondary text-muted-foreground',
              )}
            >
              {main.label}
            </button>

            {playPhase && !mainIsDiscard && s.taken == null && (
              <button
                type="button"
                disabled={!canDiscard}
                onClick={() => selected != null && discard(selected)}
                className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-destructive/60 px-3 text-[10px] font-bold uppercase text-destructive disabled:opacity-40"
              >
                <ArrowDownToLine className="size-4" aria-hidden="true" /> At
              </button>
            )}
            {showGiveBack && (
              <button
                type="button"
                disabled={remote.busy}
                onClick={() => act({ type: 'giveBack' })}
                className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-border px-3 text-[10px] font-bold uppercase text-foreground disabled:opacity-40"
              >
                <Undo2 className="size-4" aria-hidden="true" /> Geri ver
              </button>
            )}
          </div>

          <div className="flex min-h-6 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {!opened && <OpenMeter runValue={runValue} pairs={pairs.length} />}
            {layOffable.length > 0 && (
              <button
                type="button"
                disabled={remote.busy}
                onClick={autoLayOff}
                className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 font-bold text-primary disabled:opacity-50"
              >
                <Sparkles className="size-3" aria-hidden="true" /> {layOffable.length} taş işlenir · Hızlı işle
              </button>
            )}
          </div>
        </div>
      )}

      {handPopup && (
        <div className="fixed inset-x-0 top-20 z-[75] flex justify-center px-4" role="status">
          <div className="w-full max-w-sm animate-in fade-in slide-in-from-top-4 zoom-in-95 rounded-2xl border border-primary/60 bg-card p-4 shadow-2xl duration-300">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-primary">{handPopup.hand}. el bitti</p>
            <p className="mt-1 text-center text-base font-bold text-foreground">
              {handPopup.finisher != null
                ? handPopup.finisher === mySeat
                  ? 'Eli sen bitirdin!'
                  : `${nameOf(handPopup.finisher)} eli bitirdi`
                : 'Deste bitti'}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
              {handPopup.scores.map((sc, i) => (
                <li key={i} className={cn('flex justify-between rounded-lg bg-secondary px-2.5 py-1.5', i === mySeat && 'ring-1 ring-primary')}>
                  <span className="truncate text-muted-foreground">{nameOf(i)}</span>
                  <span className="font-bold tabular-nums text-foreground">{sc}</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setHandPopup(null)} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground">
              Devam
            </button>
          </div>
        </div>
      )}

      {scoresOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" onClick={() => setScoresOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Puan tablosu"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-lg animate-in slide-in-from-bottom-8 fade-in flex-col gap-3 overflow-y-auto rounded-t-3xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] duration-300 sm:rounded-3xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Trophy className="size-4 text-primary" aria-hidden="true" /> Puan tablosu · {s.handNo}/{s.handsTotal}. el
              </h3>
              <button type="button" onClick={() => setScoresOpen(false)} aria-label="Kapat" className="flex size-8 items-center justify-center rounded-full hover:bg-secondary">
                <X className="size-4 text-foreground" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Az puan önde.{s.team ? ' Eşli oyunda sıralama ortağınla toplam puana göre.' : ''}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-semibold">El</th>
                    {Array.from({ length: n }, (_, i) => (
                      <th key={i} className="max-w-20 truncate py-1 pr-2 font-semibold">
                        {nameOf(i)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {s.results.map((r) => (
                    <tr key={r.hand} className="border-t border-border">
                      <td className="py-1 pr-2 text-muted-foreground">{r.hand}</td>
                      {r.scores.map((sc, i) => (
                        <td key={i} className={cn('py-1 pr-2', r.finisher === i ? 'font-bold text-primary' : 'text-foreground')}>
                          {sc}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-border font-bold">
                    <td className="py-1 pr-2 text-muted-foreground">Toplam</td>
                    {s.totals.map((t, i) => (
                      <td key={i} className={cn('py-1 pr-2', hasStandings && rankOf(i) === 1 ? 'text-primary' : 'text-foreground')}>
                        {t + s.penalties[i]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {lastResult && (
              <p className="text-xs text-muted-foreground">
                Son el: {lastResult.finisher != null ? `${nameOf(lastResult.finisher)} bitirdi${lastResult.double ? ' (ceza ikiye katlandı)' : ''}` : 'deste bitti'}.
              </p>
            )}
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Masa akışı</h4>
              <ol className="flex flex-col gap-1.5 text-sm">
                {[...s.log].reverse().slice(0, 20).map((l, i) => (
                  <li key={`${i}-${l.text}`} className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-semibold text-foreground">{nameOf(l.seat)}</span>
                    <span>{l.text}</span>
                    {l.tile && <TileFace tile={l.tile} okey={okey} size="xs" />}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MeldTile({ tile, okey }: { tile: Tile; okey: OkeyValue }) {
  return <TileFace tile={tile} okey={okey} size="sm" />
}

function SeatPill({
  name,
  bot,
  turn,
  count,
  status,
  vertical,
  rank,
  total,
  partner,
}: {
  name: string
  bot: boolean
  turn: boolean
  count: number
  status: string | null
  vertical?: boolean
  rank?: number
  total?: number
  partner?: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex items-center border backdrop-blur-sm transition-all duration-300',
        vertical ? 'w-14 flex-col gap-1 rounded-2xl px-1 py-1.5 text-center sm:w-auto sm:flex-row sm:gap-2 sm:rounded-full sm:py-1 sm:pl-1 sm:pr-3 sm:text-left' : 'gap-2 rounded-full py-1 pl-1 pr-3',
        turn ? 'scale-105 border-primary bg-background/85 glow-gold' : 'border-foreground/10 bg-background/55',
      )}
    >
      <span
        className={cn(
          'relative flex size-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold sm:size-8',
          turn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
        )}
        aria-hidden="true"
      >
        {bot ? <Bot className="size-3.5" /> : name.charAt(0)}
        {turn && <span className="absolute -inset-1 animate-ping rounded-full border border-primary/60" />}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn('truncate text-[11px] font-bold text-foreground sm:text-xs', vertical ? 'max-w-12 sm:max-w-24' : 'max-w-24')}>{name}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {turn ? <span className="text-primary">Sırada</span> : partner ? 'Eşin' : `${count} taş`}
        </span>
        {status && <span className="text-[9px] font-bold uppercase tracking-wider text-primary">{status}</span>}
      </span>
      {rank != null && (
        <span
          className={cn(
            'absolute -right-1.5 -top-2 rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums shadow',
            rank === 1 ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground ring-1 ring-border',
          )}
          aria-label={`${rank}. sırada, ${total} puan`}
        >
          {rank}. · {total}
        </span>
      )}
    </div>
  )
}

function Pile({
  tile,
  count,
  okey,
  label,
  active,
  onClick,
  hidden,
  from,
}: {
  tile?: Tile
  count: number
  okey: OkeyValue
  label?: string
  active?: boolean
  onClick?: () => void
  hidden?: boolean
  /** Offset (px) the newest tile flies in from — points back at the player who threw it. */
  from?: [number, number]
}) {
  if (hidden) return <span />
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick ? 'Soldan gelen taşı al' : undefined}
      className={cn(
        'flex flex-col items-center gap-1 self-start rounded-lg bg-background/25 p-1 shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)] transition-transform',
        label && 'self-end',
        active && 'ring-2 ring-primary hover:-translate-y-0.5 active:scale-95',
      )}
    >
      <span className="relative">
        {tile ? (
          <span
            key={tile.id}
            className={cn('block', from ? 'tile-fly' : 'animate-in fade-in zoom-in-75 slide-in-from-top-3 duration-300')}
            style={from ? ({ '--fx': `${from[0]}px`, '--fy': `${from[1]}px` } as CSSProperties) : undefined}
          >
            <MeldTile tile={tile} okey={okey} />
          </span>
        ) : (
          <span className="block h-8 w-6 rounded border border-foreground/10 bg-background/20 sm:h-11 sm:w-8" aria-hidden="true" />
        )}
        {count > 1 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-background px-1 text-[8px] font-bold tabular-nums text-foreground">{count}</span>
        )}
      </span>
      {label && (
        <span className={cn('text-[8px] font-bold uppercase tracking-wider sm:text-[9px]', active ? 'animate-pulse text-primary' : 'text-foreground/50')}>{label}</span>
      )}
    </Comp>
  )
}
