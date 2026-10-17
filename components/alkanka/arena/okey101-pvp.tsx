'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Bot, ChevronDown, Eye, Trophy, Undo2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { analyzeMeld, bestPartition, canOpenWithTile, findPairs, jokerSwapIndex, leftOf101, OPEN_MIN, PAIR_MIN, type HandResult, type Okey101View } from '@/lib/games/okey101'
import type { Remote } from './remote'
import { FeltBranding, TileBack, TileFace } from './okey'
import { okeyFrom, sortHand, type Tile } from './okey-engine'
import { layoutGroups, OkeyRack, RACK_COLS, useRack, type SlotMark } from './okey-rack'

type OkeyValue = ReturnType<typeof okeyFrom>
type Segment = { tiles: Tile[]; slots: number[]; kind: 'run' | 'set' | 'pair'; value: number }

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

export function Okey101Pvp({ remote }: { remote: Remote<Okey101View> }) {
  const s = remote.state
  const n = s.seats
  const mySeat = remote.spectator ? -1 : remote.seat
  const okey = useMemo(() => okeyFrom(s.indicator), [s.indicator])
  const hand = useMemo(() => (mySeat >= 0 ? s.hands[mySeat] ?? [] : []), [s.hands, mySeat])
  const rack = useRack(hand, okey)
  const [localError, setLocalError] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

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

  // Hand-over popup: shows each finished hand's scores without having to scroll to the score table.
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

  const nameOf = (seat: number) => (seat === mySeat ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const lastResult = s.results[s.results.length - 1]

  // Seats around the table, counter-clockwise like a real okey table: you take from the player on your left.
  const viewer = mySeat >= 0 ? mySeat : 0
  const at = (off: number) => (viewer + off) % n
  const leftSeat = n >= 2 ? at(n - 1) : null
  const rightSeat = n >= 3 ? at(1) : null
  const topSeat = n === 4 ? at(2) : n === 2 ? at(1) : null
  const top = (seat: number | null) => (seat == null ? undefined : s.discards[seat]?.[s.discards[seat].length - 1])
  const sideTop = mySeat >= 0 ? top(leftOf101(mySeat, n)) : top(leftSeat)
  const sideOpens = !!sideTop && (!!opened || canOpenWithTile(hand, sideTop, okey))
  const canTakeSide = drawPhase && !!sideTop && !s.noTake && !remote.busy && sideOpens

  // 101: lowest running total leads. Ties share the same rank.
  const hasStandings = s.results.length > 0
  const rankOf = (seat: number) => 1 + s.totals.filter((t) => t < s.totals[seat]).length
  const standings = s.totals
    .map((total, seat) => ({ seat, total, rank: rankOf(seat) }))
    .sort((a, b) => a.total - b.total || a.seat - b.seat)

  const seatPill = (seat: number | null, vertical?: boolean) =>
    seat == null ? <span /> : (
      <SeatPill
        rank={hasStandings ? rankOf(seat) : undefined}
        total={hasStandings ? s.totals[seat] : undefined}
        name={nameOf(seat)}
        bot={s.bots.includes(seat)}
        turn={s.turn === seat}
        count={s.handCounts[seat]}
        status={s.opened[seat] === 'cift' ? 'Çifte gitti' : s.opened[seat] ? 'Açtı' : null}
        vertical={vertical}
      />
    )

  const note =
    s.note ||
    (myTurn
      ? s.phase === 'draw'
        ? sideTop && !sideOpens
          ? 'Sıra sende: elin açmadığı için yandan alamazsın, ortadan çek.'
          : 'Sıra sende: ortadan çek ya da soldan gelen taşı al.'
        : s.taken != null
          ? 'Yandan aldığın taşla elini açmalısın, yoksa geri ver (101 ceza).'
          : opened
            ? 'Per aç, işle, sonra bir taş at.'
            : `Açmak için ${OPEN_MIN} sayı ya da ${PAIR_MIN} çift. Hazır değilsen taş at.`
      : `${nameOf(s.turn)} oynuyor`)

  const cols = Math.max(11, Math.ceil(hand.length / 2))
  const slots = cols * 2

  return (
    <div ref={boardRef} className="flex scroll-mt-20 flex-col gap-2 sm:gap-3">
      {remote.spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Eller gizli, yere açılan perler canlı görünür.
        </p>
      )}

      {hasStandings && (
        <section aria-label="Sıralama" className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Trophy className="size-3.5 text-primary" aria-hidden="true" /> Sıralama
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.handNo}/{s.handsTotal}. el · az puan önde
            </span>
          </div>
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {standings.map(({ seat, total, rank }) => {
              const leader = rank === 1
              const gap = total - standings[0].total
              return (
                <li
                  key={seat}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5',
                    leader ? 'border-primary bg-primary/15' : 'border-border bg-secondary',
                    seat === mySeat && !leader && 'border-foreground/30',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      leader ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground',
                    )}
                  >
                    {rank}
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate text-xs', seat === mySeat ? 'font-bold text-foreground' : 'font-semibold text-foreground')}>
                    {nameOf(seat)}
                  </span>
                  <span className="flex flex-col items-end leading-tight">
                    <span className={cn('text-xs font-bold tabular-nums', leader ? 'text-primary' : 'text-foreground')}>{total}</span>
                    {!leader && <span className="text-[9px] tabular-nums text-muted-foreground">+{gap}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <div className="relative overflow-hidden rounded-2xl border-[6px] border-wood bg-felt shadow-[inset_0_0_80px_rgb(0_0_0/0.55),0_20px_40px_rgb(0_0_0/0.4)] sm:rounded-[2rem] sm:border-[10px]">
        <FeltBranding />
        <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 p-2 pt-4 sm:gap-3 sm:p-4 sm:pt-6">
          <Pile tile={top(topSeat)} count={topSeat != null && n === 4 ? s.discards[topSeat].length : 0} okey={okey} hidden={n !== 4} />
          <div className="flex justify-center">{seatPill(topSeat)}</div>
          <Pile tile={top(rightSeat)} count={rightSeat != null ? s.discards[rightSeat].length : 0} okey={okey} hidden={rightSeat == null} />

          <div className="flex items-center">{seatPill(n >= 3 ? leftSeat : null, true)}</div>

          <div className="flex min-w-0 flex-col items-center gap-2 py-1">
            <div className="flex items-end gap-3">
              <button
                type="button"
                disabled={!drawPhase || remote.busy}
                onClick={() => act({ type: 'draw', from: 'deck' })}
                aria-label={`Ortadan çek, ${s.deckCount} taş kaldı`}
                className={cn('flex flex-col items-center gap-1 rounded-lg p-1 disabled:cursor-default', drawPhase && 'animate-pulse ring-2 ring-primary')}
              >
                <span className="relative h-11 w-9">
                  <TileBack className="absolute left-1 top-1 h-10 w-7" />
                  <TileBack className="absolute left-0.5 top-0.5 h-10 w-7" />
                  <TileBack className="absolute left-0 top-0 h-10 w-7" />
                </span>
                <span className={cn('text-[9px] font-bold uppercase tracking-wider', drawPhase ? 'text-primary' : 'text-foreground/60')}>
                  {drawPhase ? 'Çek' : `${s.deckCount} taş`}
                </span>
              </button>
              <div className="flex flex-col items-center gap-1 p-1">
                <TileFace tile={s.indicator} okey={{ color: -2, num: -2 } as OkeyValue} size="sm" label="Gösterge" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/60">Gösterge</span>
              </div>
            </div>

            {s.melds.length > 0 && (
              <div className="flex max-h-40 w-full flex-wrap content-start justify-center gap-1.5 overflow-y-auto p-1 sm:max-h-64 sm:gap-2" aria-label="Yerdeki perler">
                {s.melds.map((m) => {
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
                        'relative flex gap-px rounded-md bg-background/30 p-1 shadow-[inset_0_1px_3px_rgb(0_0_0/0.4)] transition-all duration-150 disabled:cursor-default',
                        fits && 'cursor-pointer ring-2 ring-primary hover:-translate-y-0.5 hover:bg-primary/25',
                        hovered && 'scale-105 bg-primary/30 ring-4 ring-primary',
                        dimmed && 'opacity-40',
                        m.owner === mySeat && !fits && 'outline outline-1 outline-primary/50',
                      )}
                    >
                      {fits && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-[9px] font-bold uppercase leading-4 text-primary-foreground shadow">
                          {swap ? 'Okeyi al' : 'İşle'}
                        </span>
                      )}
                      {m.tiles.map((t) => (
                        <TileFace key={t.id} tile={t} okey={okey} size="xs" />
                      ))}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">{seatPill(rightSeat, true)}</div>

          <Pile
            tile={sideTop}
            count={leftSeat != null ? s.discards[mySeat >= 0 ? leftOf101(mySeat, n) : leftSeat].length : 0}
            okey={okey}
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
                'flex h-8 w-6 items-center justify-center rounded sm:h-11 sm:w-8',
                canDiscard ? 'animate-pulse border-2 border-dashed border-primary bg-primary/20' : 'border border-dashed border-foreground/20',
              )}
            >
              {!canDiscard && top(viewer) && <TileFace tile={top(viewer)!} okey={okey} size="xs" />}
            </span>
            <span className={cn('text-[8px] font-bold uppercase tracking-wider sm:text-[9px]', canDiscard ? 'text-primary' : 'text-foreground/50')}>
              {canDiscard ? 'Buraya at' : 'Attığın'}
            </span>
          </button>
        </div>
      </div>

      <p className={cn('rounded-lg px-3 py-1.5 text-center text-xs font-semibold sm:text-sm', myTurn ? 'bg-primary/15 text-primary' : 'bg-secondary text-foreground')} aria-live="polite">
        {note}
      </p>

      {mySeat >= 0 && (
        <div className="flex flex-col gap-2">
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
          {layOffable.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">
                {layOffable.length} taşın yere işlenebilir. Taşı seç, sarı yanan pere dokun ya da sürükleyip bırak.
              </span>
              <button
                type="button"
                disabled={remote.busy}
                onClick={autoLayOff}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                Hızlı işle
              </button>
            </div>
          )}
          <p className="text-center text-[11px] leading-snug text-muted-foreground">
            Taşları sürükleyip diz. Yan yana duran taşlar bir grup sayılır, boşluk grubu ayırır; geçerli perlerin altı sarı çizilir.
          </p>

          {localError && (
            <p role="alert" className="text-xs text-destructive sm:text-sm">
              {localError}
            </p>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {!opened ? (
              <>
                <ActionButton
                  primary
                  disabled={!playPhase || runValue < OPEN_MIN || remote.busy}
                  onClick={() => act({ type: 'open', mode: 'seri', groups: ids(runs) })}
                >
                  Aç <span className="tabular-nums opacity-80">{runValue}/{OPEN_MIN}</span>
                </ActionButton>
                <ActionButton
                  primary
                  disabled={!playPhase || pairs.length < PAIR_MIN || remote.busy}
                  onClick={() => act({ type: 'open', mode: 'cift', groups: ids(pairs) })}
                >
                  Çift <span className="tabular-nums opacity-80">{pairs.length}/{PAIR_MIN}</span>
                </ActionButton>
              </>
            ) : (
              <div className="col-span-2">
                <ActionButton primary disabled={!playPhase || remote.busy} onClick={layDown}>
                  Perleri yere aç
                </ActionButton>
              </div>
            )}
            {s.taken != null && playPhase ? (
              <ActionButton disabled={remote.busy} onClick={() => act({ type: 'giveBack' })}>
                <Undo2 className="size-3.5" aria-hidden="true" /> Geri ver
              </ActionButton>
            ) : (
              <ActionButton danger disabled={!canDiscard} onClick={() => selected != null && discard(selected)}>
                <ArrowDownToLine className="size-3.5" aria-hidden="true" /> At
              </ActionButton>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => autoLayout('seri')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary"
            >
              <Wand2 className="size-3.5 text-primary" aria-hidden="true" /> Perlere göre diz
            </button>
            <button
              type="button"
              onClick={() => autoLayout('cift')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary"
            >
              <Wand2 className="size-3.5 text-primary" aria-hidden="true" /> Çiftlere göre diz
            </button>
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


      <details className="group rounded-2xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold text-foreground sm:px-4">
          <span className="flex items-center gap-2">
            <Trophy className="size-4 text-primary" aria-hidden="true" /> Puan tablosu · {s.handNo}/{s.handsTotal}. el
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="flex flex-col gap-3 px-3 pb-3 sm:px-4">
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
                    <td key={i} className="py-1 pr-2 text-foreground">
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
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Masa akışı</h3>
            <ol className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-sm" aria-live="polite">
              {[...s.log].reverse().slice(0, 14).map((l, i) => (
                <li key={`${i}-${l.text}`} className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-semibold text-foreground">{nameOf(l.seat)}</span>
                  <span>{l.text}</span>
                  {l.tile && <TileFace tile={l.tile} okey={okey} size="xs" />}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </div>
  )
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
}: {
  name: string
  bot: boolean
  turn: boolean
  count: number
  status: string | null
  vertical?: boolean
  rank?: number
  total?: number
}) {
  return (
    <div
      className={cn(
        'relative flex items-center border backdrop-blur-sm transition-colors',
        vertical ? 'w-14 flex-col gap-1 rounded-2xl px-1 py-1.5 text-center sm:w-auto sm:flex-row sm:gap-2 sm:rounded-full sm:py-1 sm:pl-1 sm:pr-3 sm:text-left' : 'gap-2 rounded-full py-1 pl-1 pr-3',
        turn ? 'border-primary bg-background/85 glow-gold' : 'border-foreground/10 bg-background/55',
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
          {turn ? <span className="text-primary">Sırada</span> : `${count} taş`}
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
}: {
  tile?: Tile
  count: number
  okey: OkeyValue
  label?: string
  active?: boolean
  onClick?: () => void
  hidden?: boolean
}) {
  if (hidden) return <span />
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick ? 'Soldan gelen taşı al' : undefined}
      className={cn(
        'flex flex-col items-center gap-1 self-start rounded-lg bg-background/25 p-1 shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)]',
        label && 'self-end',
        active && 'ring-2 ring-primary',
      )}
    >
      <span className="relative">
        {tile ? (
          <>
            <span className="sm:hidden">
              <TileFace tile={tile} okey={okey} size="xs" />
            </span>
            <span className="hidden sm:block">
              <TileFace tile={tile} okey={okey} size="sm" />
            </span>
          </>
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

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40 sm:text-xs',
        primary
          ? 'bg-primary text-primary-foreground'
          : danger
            ? 'bg-destructive text-primary-foreground'
            : 'border border-border text-foreground hover:bg-secondary',
      )}
    >
      {children}
    </button>
  )
}
