'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canShowIndicator, isOkeyScored, type OkeyLast, type OkeyReveal, type OkeyState } from '@/lib/pvp/rules'
import type { Remote } from './remote'
import { TileFace, TurnSteps, useDrawDrag } from './okey'
import { MockTile, OkeyRack, ghostTransform, useRack } from './okey-rack'
import { COLOR_NAMES, findWinningDiscard, isJoker, okeyFrom, winningKindFor, type Okey as OkeyValue, type Tile } from './okey-engine'
import { TableBrand } from './table-brand'
import { ThemeDecor, themeSurfaceProps, useTableTheme } from './table-theme'
import { OkeyWinOverlay } from './okey-win'
import { MobileTableChat } from './mobile-table-chat'
import { SeatFace } from './seat-face'

type OkeyView = OkeyState & { deckCount: number; handCounts: number[]; oppSeat: number; seats: number; team: boolean; bots: number[]; last: OkeyLast[] }

const leftOf = (seat: number, n: number) => (seat - 1 + n) % n

const tileName = (t: Tile) => (t.fake ? 'sahte okey' : `${COLOR_NAMES[t.color]} ${t.num}`)

const short = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name)

/**
 * The okey table players share, drawn on the same themed felt as the table against the bots.
 * Seats are placed around the viewer: 0 the viewer, 1 right, 2 across, 3 left. With two players the
 * rival sits across, and the pile the viewer takes from stays at the viewer's left hand.
 */
export function OkeyPvp({ remote }: { remote: Remote<OkeyView> }) {
  const { theme: tableTheme } = useTableTheme('okey')
  const s = remote.state
  const n = s.seats ?? s.hands.length
  const spectator = remote.seat < 0
  const seat = spectator ? 0 : remote.seat
  const okey = useMemo(() => okeyFrom(s.indicator), [s.indicator])
  const hand = spectator ? [] : (s.hands[seat] ?? [])
  const rack = useRack(hand, okey, 2, `${s.hand ?? 1}:${s.indicator.id}:${hand.length > 0}`)
  const selected = rack.selected
  const [knownIds, setKnownIds] = useState<string>(() => hand.map((t) => t.id).join(','))
  const [fresh, setFresh] = useState<number | null>(null)
  // A tile dragged from the deck or the pile lands on the slot it was dropped on once the server confirms the draw.
  const [pendingSlot, setPendingSlot] = useState<number | null>(null)
  // Start with the hand already on screen at load as "seen", so a refresh doesn't replay an old finish.
  const [seenHand, setSeenHand] = useState<number | undefined>(() => s.reveal?.hand)
  const [closedReveal, setClosedReveal] = useState<number | null>(null)
  const [dropOver, setDropOver] = useState(false)
  const [warning, setWarning] = useState<{ version: number; text: string } | null>(null)
  const idsKey = hand.map((t) => t.id).join(',')
  if (idsKey !== knownIds) {
    const prev = new Set(knownIds.split(',').filter(Boolean).map(Number))
    // A fresh deal changes every tile at once; only a hand that grew by one tile was a draw.
    const drawn = hand.length === prev.size + 1 ? hand.find((t) => !prev.has(t.id)) : undefined
    setKnownIds(idsKey)
    setFresh(drawn ? drawn.id : null)
    if (drawn && pendingSlot != null) rack.moveTo(drawn.id, pendingSlot)
    if (pendingSlot != null) setPendingSlot(null)
    // A tile taken from the discard pile can't be thrown back this turn, so pre-selecting it only locked the throw.
    if (drawn && drawn.id !== s.takenId) rack.setSelected(drawn.id)
    else if (drawn) rack.setSelected(null)
  }

  const bots = s.bots ?? []
  const nameOf = (i: number) => remote.names[i] || (bots.includes(i) ? 'Bot' : `Oyuncu ${i + 1}`)
  const fromSeat = leftOf(seat, n)
  const myDraw = !spectator && remote.myTurn && s.phase === 'draw'
  const myDiscard = !spectator && remote.myTurn && s.phase === 'discard'
  const takenId = s.takenId ?? null
  const winning = myDiscard ? findWinningDiscard(hand, okey, takenId) : null
  const selectedIsTaken = selected != null && selected === takenId
  const scored = isOkeyScored(s)
  const canShow = !spectator && canShowIndicator(s, seat)
  const lowDeck = s.deckCount > 0 && s.deckCount <= 8
  const takeTop = s.discards[fromSeat]?.at(-1)
  const canTake = myDraw && Boolean(takeTop) && !remote.busy
  const canThrow = myDiscard && !remote.busy
  const partner = s.team ? (seat + 2) % 4 : -1

  const posOf = (i: number) => {
    const k = (i - seat + n) % n
    return n === 2 && k === 1 ? 2 : k
  }
  const pilePos = (i: number) => (i === seat ? 0 : i === fromSeat ? 3 : posOf(i))
  const seatList = Array.from({ length: n }, (_, k) => (seat + k) % n)

  const warn = (text: string) => setWarning({ version: remote.version, text })

  const drawFrom = async (src: 'deck' | 'pile', slot: number | null = null) => {
    if (!myDraw || remote.busy) return
    if (src === 'pile' && !takeTop) return
    setPendingSlot(slot)
    const ok = await remote.send({ type: 'draw', from: src === 'deck' ? 'pile' : 'discard' })
    if (!ok) setPendingSlot(null)
  }
  const drawDrag = useDrawDrag((src, slot) => void drawFrom(src, slot))

  const discard = (tileId: number) => {
    if (!canThrow) return
    if (tileId === takenId) return warn('Yerden aldığın taşı bu elde geri atamazsın')
    void remote.send({ type: 'discard', tileId })
  }
  const finishWith = (tileId: number) => {
    if (!canThrow) return
    if (tileId === takenId) return warn('Yerden aldığın taşı bu elde geri atamazsın')
    if (!winningKindFor(hand, tileId, okey)) return warn(winning ? `Bu taşla bitmiyor – ${tileName(winning.tile)} taşını at` : 'Bu elle henüz bitemezsin')
    void remote.send({ type: 'finish', tileId })
  }
  /** The tile "Eli Bitir" throws: the selected one if it ends the hand, otherwise the tile that does. */
  const finishTile = winning ? (selected != null && !selectedIsTaken && winningKindFor(hand, selected, okey) ? selected : winning.tile.id) : null

  const warningText = warning && warning.version === remote.version ? warning.text : null
  let message: string
  if (spectator) message = `İzliyorsun · sıra ${short(nameOf(s.turn))} oyuncusunda`
  else if (myDraw) message = takeTop ? 'Ortadan çek ya da yerdeki taşı al' : 'Ortadan taş çek'
  else if (myDiscard) message = winning ? `Bitirebilirsin – ${tileName(winning.tile)} taşını at` : 'Şimdi bir taş at'
  else message = `${short(nameOf(s.turn))} oynuyor`
  const toastTone = warningText ? 'warn' : myDraw || (myDiscard && winning) ? 'me' : undefined

  const finished = s.reveal && s.reveal.kind !== 'deste' ? s.reveal : null
  const showWin = finished != null && seenHand !== finished.hand

  const seatEl = (i: number) => {
    const mine = !spectator && i === seat
    const name = mine ? 'Sen' : nameOf(i)
    const uid = remote.userIds?.[i] ?? null
    const count = s.handCounts[i] ?? 0
    const points = scored ? (s.scores?.[i] ?? s.target ?? 0) : null
    const tag = s.team ? (i === partner ? 'Eş' : i % 2 === 0 ? 'A' : 'B') : bots.includes(i) ? 'Bot' : null
    return (
      <div key={`seat-${i}`} className={cn('okt-pl', `okt-p${posOf(i)}`, s.turn === i && !showWin && 'active')}>
        <div className="okt-av" aria-hidden="true">
          <SeatFace userId={uid} botSeed={uid ? null : `${remote.id ?? 'masa'}-${i}`} initials={mine ? 'SN' : name.slice(0, 2).toLocaleUpperCase('tr-TR')} />
        </div>
        <div className="okt-nm" aria-hidden="true">
          {short(name)}
          <s>{points != null ? `${points}p` : count}</s>
          {tag && <em>{tag}</em>}
        </div>
        <span className="sr-only">
          {`${name}${bots.includes(i) ? ' (bot)' : ''}${s.team ? `, ${i === partner ? 'eşin' : `${i % 2 === 0 ? 'A' : 'B'} takımı`}` : ''}, ${count} taş${points != null ? `, ${points} puan` : ''}${s.turn === i ? ', sırada' : ''}`}
        </span>
      </div>
    )
  }

  const pile = (i: number) => {
    const t = s.discards[i]?.at(-1)
    const takeHere = !spectator && i === fromSeat && canTake
    const dropHere = !spectator && i === seat
    return (
      <div
        key={`pile-${i}`}
        data-drop={dropHere && canThrow ? 'discard' : undefined}
        className={cn('okt-pile okt-box', `okt-pile${pilePos(i)}`, (takeHere || (dropHere && canThrow)) && 'can')}
      >
        {t && <MockTile key={t.id} tile={t} okey={okey} />}
        {takeHere && (
          <button
            type="button"
            className="okt-hit touch-none"
            onPointerDown={(e) => drawDrag.start(e, 'pile')}
            onClick={() => !drawDrag.dragged.current && void drawFrom('pile')}
            aria-label={`${nameOf(fromSeat)} oyuncusunun attığı taşı al ya da ıstakaya sürükle`}
          />
        )}
        {dropHere && canThrow && selected != null && (
          <button type="button" className="okt-hit" onClick={() => discard(selected)} aria-label="Seçili taşı buraya at" />
        )}
      </div>
    )
  }

  return (
    <div data-game-table className="flex flex-col gap-3 sm:gap-4">
      {scored && (
        <div data-ls-hide>
          <ScoreBoard s={s} n={n} nameOf={nameOf} seat={spectator ? -1 : seat} />
        </div>
      )}
      {s.reveal && closedReveal !== s.reveal.hand && (
        <div data-ls-hide>
          <HandReveal
            reveal={s.reveal}
            okey={s.reveal.indicator ? okeyFrom(s.reveal.indicator) : okey}
            nameOf={nameOf}
            scored={scored}
            onClose={() => setClosedReveal(s.reveal?.hand ?? null)}
          />
        </div>
      )}
      {showWin && (
        <OkeyWinOverlay
          winner={nameOf(finished.seat)}
          mine={!spectator && finished.seat === seat}
          detail={[
            finished.kind === 'cift' ? 'Çiftten bitti' : 'Seriden bitti',
            finished.okeyFinish ? 'okey atarak' : null,
            scored ? `rakipler −${finished.penalty}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          tiles={finished.tiles}
          okey={okeyFrom(finished.indicator ?? s.indicator)}
          onClose={() => setSeenHand(finished.hand)}
          autoCloseMs={12000}
        />
      )}
      {spectator && (
        <p data-ls-hide className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Oyuncuların elleri gizli, atılan taşlar canlı görünür.
        </p>
      )}

      <div data-fit-end className="okt okp font-sans" {...themeSurfaceProps(tableTheme)}>
        <TableBrand center={false} plaque={false} corners={false} jako={false} />
        <ThemeDecor theme={tableTheme} />
        {remote.id && <MobileTableChat tableId={remote.id} placement="table" />}
        <div className="okt-logo" aria-hidden="true">
          {scored ? `ALKANKA · ${s.hand ?? 1}. EL` : 'ALKANKA'}
        </div>
        <div className={cn('okt-drop', dropOver && 'on')} aria-hidden="true" />
        <div className="okt-rot" aria-hidden="true">
          Daha büyük taşlar için telefonu yan çevir
        </div>

        {seatList.map(seatEl)}
        {seatList.map(pile)}

        <button
          type="button"
          className={cn('okt-deck', myDraw && 'touch-none')}
          data-on={myDraw || undefined}
          disabled={!myDraw || remote.busy}
          onPointerDown={(e) => myDraw && !remote.busy && drawDrag.start(e, 'deck')}
          onClick={() => !drawDrag.dragged.current && void drawFrom('deck')}
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
          <span className={cn('okt-num', lowDeck && 'low')}>{lowDeck ? `Son ${s.deckCount} taş` : `${s.deckCount} taş`}</span>
        </button>
        <div className="okt-ind okt-box">
          <MockTile tile={s.indicator} okey={{ color: -2, num: -2 } as OkeyValue} label={`Gösterge: ${tileName(s.indicator)}`} />
        </div>
        <div className="okt-lbl" aria-hidden="true">
          Gösterge
        </div>

        {!spectator && (
          <div className="okt-side">
            {finishTile != null && (
              <button type="button" className="okt-btn gold" data-drop="finish" disabled={remote.busy} onClick={() => finishWith(finishTile)}>
                Eli Bitir
              </button>
            )}
            <button type="button" className="okt-btn" onClick={() => rack.arrange('seri')}>
              Seri Diz
            </button>
            <button type="button" className="okt-btn" onClick={() => rack.arrange('cift')}>
              Çift Diz
            </button>
            {myDiscard && (
              <button type="button" className="okt-btn gold" disabled={selected == null || selectedIsTaken || remote.busy} onClick={() => selected != null && discard(selected)}>
                Taşı At
              </button>
            )}
            {canShow && (
              <button type="button" className="okt-btn" disabled={remote.busy} onClick={() => void remote.send({ type: 'show' })}>
                Göster (rakip −1)
              </button>
            )}
          </div>
        )}

        <div className={cn('okt-toast', toastTone)} aria-live="polite">
          {warningText ?? message}
        </div>

        {spectator ? (
          <div className="o1-spec">İzleyici olarak bakıyorsun</div>
        ) : (
          <OkeyRack
            variant="table"
            hand={hand}
            okey={okey}
            rack={rack}
            highlight={myDiscard ? fresh : null}
            looseDiscard={canThrow}
            onDoubleTile={(tile) => {
              if (myDiscard) discard(tile.id)
              else if (isJoker(tile, okey) && !tile.fake) rack.toggleFlip(tile.id)
            }}
            onDropHover={(kind) => setDropOver(kind === 'discard' || kind === 'finish')}
            onDropOut={(tileId, kind) => {
              setDropOver(false)
              if (kind === 'finish') finishWith(tileId)
              else if (kind === 'discard') discard(tileId)
            }}
          />
        )}
      </div>

      {drawDrag.ghost &&
        createPortal(
          <div ref={drawDrag.ghostEl} aria-hidden="true" className="okt-ghost" style={{ transform: ghostTransform(drawDrag.ghost.x, drawDrag.ghost.y) }}>
            <div style={{ width: drawDrag.ghost.w, height: drawDrag.ghost.h }}>
              {drawDrag.ghost.src === 'pile' && takeTop ? <MockTile tile={takeTop} okey={okey} /> : <MockTile back />}
            </div>
          </div>,
          document.body,
        )}

      {!spectator && (
        <div data-ls-hide>
          <TurnSteps phase={myDraw ? 'draw' : myDiscard ? 'discard' : 'wait'} />
        </div>
      )}

      <div data-ls-hide>
        <LastMoves last={s.last ?? []} nameOf={nameOf} okey={okey} />
      </div>
    </div>
  )
}

function ScoreBoard({ s, n, nameOf, seat }: { s: OkeyView; n: number; nameOf: (i: number) => string; seat: number }) {
  const scores = s.scores ?? []
  const target = s.target ?? 0
  return (
    <section aria-label="Puan durumu" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span>{s.hand ?? 1}. el</span>
        <span>{target} puandan düşüş · sıfırlanan bitirir</span>
      </div>
      <div className={cn('grid gap-2', n === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}>
        {Array.from({ length: n }, (_, i) => {
          const v = scores[i] ?? target
          const pct = target ? Math.max(0, Math.min(100, (v / target) * 100)) : 0
          return (
            <div key={i} className={cn('flex flex-col gap-1 rounded-xl bg-secondary px-3 py-2', i === seat && 'ring-1 ring-primary')}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-foreground">
                  {i === seat ? 'Sen' : nameOf(i)}
                  {s.team ? ` · ${i % 2 === 0 ? 'A' : 'B'}` : ''}
                </span>
                <span className={cn('font-mono text-sm font-bold tabular-nums', v <= 4 ? 'text-destructive' : 'text-foreground')}>{v}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-background" aria-hidden="true">
                <div className={cn('h-full rounded-full', v <= 4 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HandReveal({
  reveal,
  okey,
  nameOf,
  scored,
  onClose,
}: {
  reveal: OkeyReveal
  okey: OkeyValue
  nameOf: (i: number) => string
  scored: boolean
  onClose: () => void
}) {
  const close = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Biten eli kapat"
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
  if (reveal.kind === 'deste') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card py-1 pl-3 pr-1 text-sm text-muted-foreground" aria-live="polite">
        <p className="flex-1">{reveal.hand}. el: deste bitti, kimse bitiremedi. El puansız geçti.</p>
        {close}
      </div>
    )
  }
  const tags = [reveal.kind === 'cift' ? 'Çiftten' : 'Seriden', reveal.okeyFinish ? 'okey atarak' : null].filter(Boolean).join(', ')
  return (
    <section aria-label="Biten el" className="flex flex-col gap-2 rounded-2xl border border-primary/40 bg-card p-3" aria-live="polite">
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm font-semibold text-foreground">
          {reveal.hand}. eli {nameOf(reveal.seat)} bitirdi · {tags}
          {scored && <span className="text-primary"> · rakipler −{reveal.penalty}</span>}
        </p>
        {close}
      </div>
      <div className="flex flex-wrap gap-1">
        {reveal.tiles.map((t) => (
          <TileFace key={t.id} tile={t} okey={okey} size="sm" />
        ))}
      </div>
    </section>
  )
}

function LastMoves({ last, nameOf, okey }: { last: OkeyLast[]; nameOf: (i: number) => string; okey: OkeyValue }) {
  if (!last.length) return null
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Son hamleler</span>
      <ol className="flex flex-col gap-1 text-xs text-foreground">
        {last
          .slice(-4)
          .reverse()
          .map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-semibold">{nameOf(l.seat)}</span>
              <span className="text-muted-foreground">
                {l.type === 'pile' ? 'desteden taş çekti' : l.type === 'discard' ? 'yerden taş aldı' : 'taş attı'}
              </span>
              {l.tile && <TileFace tile={l.tile} okey={okey} size="sm" />}
            </li>
          ))}
      </ol>
    </div>
  )
}
