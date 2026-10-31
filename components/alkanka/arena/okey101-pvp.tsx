'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trophy, X } from 'lucide-react'
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
  PENALTY,
  rankTotals101,
  tilePoints,
  type HandResult,
  type Okey101View,
} from '@/lib/games/okey101'
import type { Remote } from './remote'
import { createPortal } from 'react-dom'
import { TileFace, useDrawDrag } from './okey'
import { Okey101Result } from './okey101-result'
import { TableBrand } from './table-brand'
import { MobileTableChat } from './mobile-table-chat'
import { SeatFace } from './seat-face'
import { isJoker, okeyFrom, sortHand, type Tile } from './okey-engine'
import { ghostTransform, layoutGroups, MockTile, OkeyRack, RACK_COLS, useRack, type SlotMark } from './okey-rack'

type OkeyValue = ReturnType<typeof okeyFrom>
type Segment = { tiles: Tile[]; slots: number[]; kind: 'run' | 'set' | 'pair'; value: number }
type MainAction = { label: string; onClick?: () => void; disabled?: boolean; discard?: boolean; giveBack?: boolean }

/** Tiles touching each other on the same rack row form one group; empty slots split groups. */
function readSegments(slots: (number | null)[], byId: Map<number, Tile>, okey: OkeyValue): Segment[] {
  const out: Segment[] = []
  for (let row = 0; row < slots.length / RACK_COLS; row++) {
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
  const rack = useRack(hand, okey, 2)
  const [localError, setLocalError] = useState<string | null>(null)
  const [scoresOpen, setScoresOpen] = useState(false)

  const autoLayout = (mode: 'seri' | 'cift') => {
    const groups = mode === 'seri' ? bestPartition(hand, okey).groups : findPairs(hand, okey)
    const used = new Set(groups.flat().map((t) => t.id))
    rack.setLayout(layoutGroups(groups, sortHand(hand.filter((t) => !used.has(t.id)), okey, 'seri'), 2))
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
  // Mirrors endHand: an okey left in an opened hand is written as 101.
  const handTotal = hand.reduce((sum, t) => sum + (isJoker(t, okey) ? PENALTY : tilePoints(t, okey)), 0)

  const myTurn = remote.myTurn
  const drawPhase = myTurn && s.phase === 'draw'
  const playPhase = myTurn && s.phase === 'play'
  const opened = mySeat >= 0 ? s.opened[mySeat] : null
  const selected = rack.selected
  const canDiscard = playPhase && selected != null && s.taken == null && !remote.busy

  const pairsAllowed = opened === 'seri' && s.opened.some((o) => o === 'cift')
  const pairMode = opened === 'cift' || (!opened && pairs.length >= PAIR_MIN && runValue < OPEN_MIN)
  const layable = pairMode ? pairs : pairsAllowed ? [...runs, ...pairs] : runs
  const marks: SlotMark[] = Array(rack.slots.length).fill(null)
  for (const g of layable) {
    g.slots.forEach((i, k) => (marks[i] = k === 0 ? { label: g.kind === 'pair' ? 'Ç' : String(g.value) } : {}))
  }

  const act = async (action: Parameters<typeof remote.send>[0]) => {
    setLocalError(null)
    const ok = await remote.send(action)
    if (ok) rack.setSelected(null)
    return ok
  }
  // A tile dragged from the deck or the side pile lands on the slot it was dropped on once the server confirms the draw.
  const [pendingSlot, setPendingSlot] = useState<number | null>(null)
  const idsKey = hand.map((t) => t.id).join(',')
  const [knownIds, setKnownIds] = useState(idsKey)
  if (idsKey !== knownIds) {
    const before = new Set(knownIds.split(',').filter(Boolean).map(Number))
    setKnownIds(idsKey)
    if (pendingSlot != null) {
      const added = hand.find((t) => !before.has(t.id))
      if (added) rack.moveTo(added.id, pendingSlot)
      setPendingSlot(null)
    }
  }
  const drawFrom = async (src: 'deck' | 'pile', slot: number | null = null) => {
    if (!drawPhase || remote.busy) return
    if (src === 'pile' && !canTakeSide) return
    setPendingSlot(slot)
    const ok = await act({ type: 'draw', from: src === 'deck' ? 'deck' : 'discard' })
    if (!ok) setPendingSlot(null)
  }
  const drawDrag = useDrawDrag((src, slot) => drawFrom(src, slot))
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
    if (s.results.length > seenResults) setHandPopup(s.results[s.results.length - 1])
  }
  const closePopup = useCallback(() => setHandPopup(null), [])
  const popupFinal = handPopup != null && handPopup.hand >= s.handsTotal
  const gameOver = s.results.length >= s.handsTotal

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
            : runValue >= OPEN_MIN
              ? `Dizili ${runValue} sayın var, El Aç'a bas.`
              : pairs.length >= PAIR_MIN
                ? `${pairs.length} çiftin var, Çifte Git'e bas.`
                : `Açmak için ${OPEN_MIN} lazım: dizili ${runValue}, ${OPEN_MIN - runValue} eksik. Çift ${pairs.length}/${PAIR_MIN}.`
      : `${nameOf(s.turn)} oynuyor`)

  // One button that always does the next sensible thing; secondary actions sit beside it.
  const main: MainAction = (() => {
    if (drawPhase) return { label: 'Ortadan Çek', onClick: () => act({ type: 'draw', from: 'deck' }), disabled: remote.busy }
    if (!playPhase) return { label: remote.spectator ? 'İzleniyor' : 'Sıra Bekleniyor', disabled: true }
    if (!opened && runValue >= OPEN_MIN) return { label: `El Aç ${runValue}`, onClick: () => act({ type: 'open', mode: 'seri', groups: ids(runs) }), disabled: remote.busy }
    if (!opened && pairs.length >= PAIR_MIN) return { label: `Çifte Git ${pairs.length}`, onClick: () => act({ type: 'open', mode: 'cift', groups: ids(pairs) }), disabled: remote.busy }
    if (opened && layable.length > 0) return { label: 'Per Aç', onClick: layDown, disabled: remote.busy }
    if (s.taken != null) return { label: 'Geri Ver', onClick: () => act({ type: 'giveBack' }), disabled: remote.busy, giveBack: true }
    return { label: selected != null ? 'Taşı At' : 'Atacağın Taşı Seç', onClick: () => selected != null && discard(selected), disabled: !canDiscard, discard: true }
  })()
  const mainIsDiscard = playPhase && s.taken == null && main.discard === true
  const showGiveBack = playPhase && s.taken != null && !main.giveBack

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
        data-fit={fits || undefined}
        disabled={!fits || remote.busy}
        onClick={() => selected != null && (swap ? swapJoker(selected, m.id) : addTile(selected, m.id))}
        aria-label={`${nameOf(m.owner)} peri${swap ? ', gerçek taşı koyup okeyi al' : fits ? ', seçili taşı buraya işle' : ''}`}
        className={cn('o1-meld', hovered && 'hot', dimmed && 'dim')}
      >
        {fits && <b>{swap ? 'Okeyi al' : 'İşle'}</b>}
        {m.tiles.map((t) => (
          <span key={t.id} className="o1-mt">
            <MockTile tile={t} okey={okey} />
          </span>
        ))}
      </button>
    )
  }

  const myTotal = mySeat >= 0 && hasStandings ? ranked[mySeat] : null
  const [dropOver, setDropOver] = useState(false)

  // Viewer-relative seat positions on the mockup table: 0 you, 1 right, 2 top, 3 left.
  const posOf = (seat: number) => {
    const k = (seat - viewer + n) % n
    return n === 2 && k === 1 ? 2 : k
  }
  const pilePos = (seat: number) => (seat === viewer ? 0 : seat === sideSeat ? 3 : posOf(seat))
  const seatList = Array.from({ length: n }, (_, k) => at(k))
  const initials = (seat: number) => (seat === mySeat ? 'SN' : nameOf(seat).slice(0, 2).toLocaleUpperCase('tr-TR'))
  const face = (seat: number) => {
    const uid = remote.userIds?.[seat] ?? null
    return <SeatFace userId={uid} botSeed={uid ? null : `${remote.id ?? 'masa'}-${seat}`} initials={initials(seat)} />
  }
  const winSeat = handPopup?.finisher ?? null
  const toastText = localError ?? (turnFlash > 0 ? 'Sıra sende' : note)
  const toastTone = localError ? 'warn' : turnFlash > 0 ? 'me' : undefined
  const penalty = opened === 'cift' ? handTotal * 2 : handTotal
  const meterPct = Math.min(100, Math.round((runValue / OPEN_MIN) * 100))

  const pile = (seat: number) => {
    const pos = pilePos(seat)
    const list = s.discards[seat] ?? []
    const t = list[list.length - 1]
    const takeHere = seat === sideSeat && canTakeSide
    const dropHere = seat === viewer && mySeat >= 0
    return (
      <div
        key={`pile-${seat}`}
        data-drop={dropHere && canDiscard ? 'discard' : undefined}
        className={cn('okt-pile okt-box', `okt-pile${pos}`, (takeHere || (dropHere && canDiscard)) && 'can', takeHere && 'take')}
      >
        {t && <MockTile key={t.id} tile={t} okey={okey} />}
        {list.length > 1 && <span className="o1-cnt">{list.length}</span>}
        {takeHere && (
          <button
            type="button"
            className="okt-hit touch-none"
            onPointerDown={(e) => drawDrag.start(e, 'pile')}
            onClick={() => !drawDrag.dragged.current && drawFrom('pile')}
            aria-label="Soldan gelen taşı al ya da ıstakaya sürükle"
          />
        )}
        {dropHere && canDiscard && (
          <button type="button" className="okt-hit" onClick={() => selected != null && discard(selected)} aria-label="Seçili taşı buraya at" />
        )}
      </div>
    )
  }

  const seatEl = (seat: number) => {
    const status = s.opened[seat] === 'cift' ? 'Çift' : s.opened[seat] ? 'Açtı' : seat === partner ? 'Eş' : null
    return (
      <div key={`seat-${seat}`} className={cn('okt-pl', `okt-p${posOf(seat)}`, s.turn === seat && !handPopup && 'active', winSeat === seat && 'win')}>
        <div className="okt-av" aria-hidden="true">
          {face(seat)}
        </div>
        <div className="okt-nm">
          {nameOf(seat)}
          {hasStandings && <s>{ranked[seat]}</s>}
          {status && <em>{status}</em>}
        </div>
        <span className="sr-only">
          {`${nameOf(seat)}, ${s.handCounts[seat]} taş${s.turn === seat ? ', sırada' : ''}${hasStandings ? `, ${rankOf(seat)}. sırada ${ranked[seat]} puan` : ''}`}
        </span>
      </div>
    )
  }

  return (
    <div data-game-table>
      <div className="okt o101 font-sans">
        <TableBrand center={false} plaque={false} corners={false} jako={false} />
        {remote.id && <MobileTableChat tableId={remote.id} placement="table" />}
        <div className="okt-logo" aria-hidden="true">
          ALKANKA · 101
        </div>
        <div className={cn('okt-drop', dropOver && 'on')} aria-hidden="true" />
        <div className="okt-rot" aria-hidden="true">
          Daha büyük taşlar için telefonu yan çevir
        </div>

        {seatList.map(seatEl)}
        {seatList.map(pile)}

        <button
          type="button"
          className={cn('okt-deck', drawPhase && 'touch-none')}
          data-on={drawPhase || undefined}
          disabled={!drawPhase || remote.busy}
          onPointerDown={(e) => drawPhase && !remote.busy && drawDrag.start(e, 'deck')}
          onClick={() => !drawDrag.dragged.current && drawFrom('deck')}
          aria-label={`Ortadan taş çek ya da ıstakaya sürükle, ${s.deckCount} taş kaldı`}
        >
          <span className="okt-stack" aria-hidden="true">
            <span className="okt-box absolute inset-0">
              <MockTile back />
            </span>
            <span className="okt-box absolute inset-0">
              <MockTile back />
            </span>
            <span className="okt-box absolute inset-0">
              <MockTile back />
            </span>
          </span>
          <span className="okt-num">{s.deckCount} taş</span>
        </button>
        <div className="okt-ind okt-box">
          <MockTile tile={s.indicator} okey={{ color: -2, num: -2 } as OkeyValue} label="Gösterge" />
        </div>
        <div className="okt-lbl" aria-hidden="true">
          Gösterge
        </div>

        {seatList
          .filter((seat) => s.melds.some((m) => m.owner === seat))
          .map((seat) => {
            const pos = posOf(seat)
            const count = s.melds.reduce((a, m) => a + (m.owner === seat ? m.tiles.length : 0), 0)
            const density = count > 16 ? 'd2' : count > 10 ? 'd1' : null
            return (
              <div
                key={`mz-${seat}`}
                className={cn('o1-mz', `o1-mz${pos}`, (pos === 0 || pos === 2) && 'c', pos === 1 && 'r', density)}
                role="group"
                aria-label={seat === mySeat ? 'Senin perlerin' : `${nameOf(seat)} perleri`}
              >
                {s.melds.filter((m) => m.owner === seat).map(renderMeld)}
              </div>
            )
          })}

        {mySeat >= 0 && (
          <div className="okt-side">
            <button type="button" className="okt-btn" onClick={() => autoLayout('seri')}>
              Seri Diz
            </button>
            <button type="button" className="okt-btn" onClick={() => autoLayout('cift')}>
              Çift Diz
            </button>
            <button type="button" className={cn('okt-btn gold', !main.disabled && myTurn && 'ready')} onClick={main.onClick} disabled={main.disabled || gameOver}>
              {main.label}
            </button>
            {playPhase && !mainIsDiscard && s.taken == null && (
              <button type="button" className="okt-btn" disabled={!canDiscard} onClick={() => selected != null && discard(selected)}>
                Taşı At
              </button>
            )}
            {showGiveBack && (
              <button type="button" className="okt-btn" disabled={remote.busy} onClick={() => act({ type: 'giveBack' })}>
                Geri Ver
              </button>
            )}
            {layOffable.length > 0 && (
              <button type="button" className="okt-btn" disabled={remote.busy} onClick={autoLayOff}>
                Hızlı İşle {layOffable.length}
              </button>
            )}
          </div>
        )}

        <button type="button" className="okt-info" onClick={() => setScoresOpen(true)} aria-label="Puan tablosunu aç">
          <span className="k">El</span>
          <span className="v">
            {s.handNo}/{s.handsTotal}
          </span>
          {mySeat >= 0 && !opened && (
            <>
              <span className="k">Dizili</span>
              <span className={cn('v', runValue >= OPEN_MIN && 'ok')}>
                {runValue}/{OPEN_MIN}
              </span>
              <span className="k">{runValue >= OPEN_MIN ? 'Durum' : 'Eksik'}</span>
              <span className={cn('v', runValue >= OPEN_MIN && 'ok')}>{runValue >= OPEN_MIN ? 'Hazır' : OPEN_MIN - runValue}</span>
              <span className="k">Çift</span>
              <span className={cn('v', pairs.length >= PAIR_MIN && 'ok')}>
                {pairs.length}/{PAIR_MIN}
              </span>
              <span className="o1-bar" aria-hidden="true">
                <i style={{ width: `${meterPct}%` }} />
              </span>
            </>
          )}
          {mySeat >= 0 && opened && (
            <>
              <span className="k">Ceza</span>
              <span className="v">{penalty}</span>
              <span className="k">Puan</span>
              <span className="v">{myTotal ?? 0}</span>
            </>
          )}
        </button>

        <div className={cn('okt-toast', toastTone)} aria-live="polite">
          {toastText}
        </div>

        {mySeat >= 0 ? (
          <OkeyRack
            variant="table"
            hand={hand}
            okey={okey}
            rack={rack}
            marks={marks}
            looseDiscard={canDiscard}
            onDoubleTile={(t) => discard(t.id)}
            onDropHover={(kind) => {
              setDragHover(kind?.startsWith('meld:') ? Number(kind.slice(5)) : null)
              setDropOver(kind === 'discard')
            }}
            onDropOut={(id, kind) => {
              setDragHover(null)
              setDropOver(false)
              if (kind === 'discard') discard(id)
              else if (kind.startsWith('meld:')) {
                const meldId = Number(kind.slice(5))
                if (!fitsMeld(id, meldId) && swapsFor(id).includes(meldId)) swapJoker(id, meldId)
                else addTile(id, meldId)
              }
            }}
          />
        ) : (
          <div className="o1-spec">İzleyici olarak bakıyorsun</div>
        )}

        {handPopup && (
          <Okey101Result
            result={handPopup}
            nameOf={nameOf}
            mySeat={mySeat}
            totals={ranked}
            final={popupFinal}
            handsTotal={s.handsTotal}
            detail={
              handPopup.opened && handPopup.penalties
                ? { opened: handPopup.opened, penalties: handPopup.penalties }
                : s.handNo === handPopup.hand
                  ? { opened: s.opened, penalties: s.penalties }
                  : null
            }
            face={face}
            onReplay={popupFinal && gameOver && remote.replay && !remote.spectator ? remote.replay : undefined}
            onClose={closePopup}
            onScores={() => {
              setHandPopup(null)
              setScoresOpen(true)
            }}
          />
        )}
      </div>

      {drawDrag.ghost &&
        createPortal(
          <div ref={drawDrag.ghostEl} aria-hidden="true" className="okt-ghost" style={{ transform: ghostTransform(drawDrag.ghost.x, drawDrag.ghost.y) }}>
            <div style={{ width: drawDrag.ghost.w, height: drawDrag.ghost.h }}>
              {drawDrag.ghost.src === 'pile' && sideTop ? <MockTile tile={sideTop} okey={okey} /> : <MockTile back />}
            </div>
          </div>,
          document.body,
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
                Son el: {lastResult.finisher != null ? `${nameOf(lastResult.finisher)} bitirdi${(lastResult.mult ?? (lastResult.double ? 2 : 1)) > 1 ? ` (cezalar ${lastResult.mult ?? 2} kat)` : ''}` : 'deste bitti'}.
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
