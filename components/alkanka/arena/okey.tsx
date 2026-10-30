'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GameApi } from './stake-gate'
import { loadSaved, useSaveGame, writeSaved } from './saved-game'
import { MockTile, OkeyRack, ghostTransform, useRack } from './okey-rack'
import { TableBrand } from './table-brand'
import { OkeyWinOverlay } from './okey-win'
import { playSound } from '@/lib/sound'
import {
  COLOR_NAMES,
  chooseDiscard,
  createDeck,
  findWinningDiscard,
  isJoker,
  okeyFrom,
  sortHand,
  wantsDiscard,
  type Okey as OkeyValue,
  type Tile,
} from './okey-engine'

const TEXT = ['text-tile-red', 'text-tile-black', 'text-tile-blue', 'text-tile-yellow']
const BOTS = ['Sağ', 'Karşı', 'Sol'] as const
const BOT_NAMES = ['Baykuş', 'Aslan', 'Goril']

type Phase = 'draw' | 'discard' | 'bots' | 'over'

export function TileFace({
  tile,
  okey,
  size = 'md',
  selected,
  onClick,
  label,
}: {
  tile: Tile
  okey: OkeyValue
  size?: 'mini' | 'xs' | 'sm' | 'md' | 'fluid'
  selected?: boolean
  onClick?: () => void
  label?: string
}) {
  if (size === 'fluid') return <FluidTile tile={tile} okey={okey} selected={selected} onClick={onClick} label={label} />
  const joker = isJoker(tile, okey)
  const Comp = onClick ? 'button' : 'span'
  const name = tile.fake ? 'Sahte okey' : `${COLOR_NAMES[tile.color]} ${tile.num}${joker ? ' (okey)' : ''}`
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label ?? name}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        'okey-tile-face relative flex shrink-0 flex-col items-center justify-start rounded-md shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_2px_4px_rgb(0_0_0/0.3)] transition-transform',
        size === 'md'
          ? 'h-16 w-11 pt-1.5 sm:h-[4.5rem] sm:w-12'
          : size === 'xs'
            ? 'h-8 w-6 rounded pt-0.5'
            : size === 'mini'
              ? 'h-7 w-5 rounded-[3px] pt-0.5 shadow-[inset_0_-2px_0_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.3)] sm:h-11 sm:w-8 sm:rounded-md sm:pt-1'
              : 'h-11 w-8 pt-1',
        selected && '-translate-y-3 ring-2 ring-primary',
        onClick && 'hover:-translate-y-1',
        joker && 'ring-2 ring-primary/80',
      )}
    >
      {tile.fake ? (
        <Sparkles className={cn('text-tile-black', size === 'md' ? 'mt-2 size-6' : size === 'mini' ? 'mt-0.5 size-3 sm:mt-1 sm:size-4' : 'mt-1 size-4')} aria-hidden="true" />
      ) : (
        <>
          <span
            className={cn(
              'font-display font-bold leading-none',
              TEXT[tile.color],
              size === 'md' ? 'text-2xl' : size === 'xs' ? 'text-sm' : size === 'mini' ? 'text-xs sm:text-base' : 'text-base',
            )}
          >
            {tile.num}
          </span>
          <span
            className={cn(
              'rounded-full',
              size === 'md' ? 'mt-1 size-2.5' : size === 'xs' || size === 'mini' ? 'mt-0.5 size-1' : 'mt-1 size-1.5',
              size === 'mini' && 'sm:mt-1 sm:size-1.5',
              ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][tile.color],
            )}
          />
        </>
      )}
      {joker && (
        <span
          className={cn(
            'absolute rounded bg-primary font-bold uppercase text-primary-foreground',
            size === 'mini' ? '-top-1.5 px-0.5 text-[6px] leading-tight sm:-top-2 sm:px-1 sm:text-[8px]' : '-top-2 px-1 text-[8px]',
          )}
        >
          Okey
        </span>
      )}
    </Comp>
  )
}

export function TurnSteps({ phase }: { phase: 'draw' | 'discard' | 'wait' }) {
  const steps = [
    { key: 'draw', label: '1. Taş çek', hint: 'Ortadaki desteye ya da yerdeki taşa dokun' },
    { key: 'discard', label: '2. Taş at', hint: 'Taşa çift dokun ya da "Buraya at" alanına sürükle' },
  ] as const
  return (
    <ol className="grid grid-cols-2 gap-2" aria-label="Hamle adımları">
      {steps.map((s) => {
        const on = phase === s.key
        return (
          <li
            key={s.key}
            aria-current={on ? 'step' : undefined}
            className={cn('flex flex-col rounded-lg border px-3 py-2', on ? 'border-primary bg-primary/15' : 'border-border opacity-60')}
          >
            <span className={cn('text-xs font-bold uppercase tracking-wide', on ? 'text-primary' : 'text-foreground')}>{s.label}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">{s.hint}</span>
          </li>
        )
      })}
    </ol>
  )
}

function FluidTile({ tile, okey, selected, onClick, label }: { tile: Tile; okey: OkeyValue; selected?: boolean; onClick?: () => void; label?: string }) {
  const joker = isJoker(tile, okey)
  const name = tile.fake ? 'Sahte okey' : `${COLOR_NAMES[tile.color]} ${tile.num}${joker ? ' (okey)' : ''}`
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? name}
      aria-pressed={selected}
      className={cn(
        'relative block size-full rounded-[13%/9%] [container-type:size]',
        joker ? 'okey-tile-joker' : 'okey-tile-face okey-tile-body',
        selected && 'ring-2 ring-primary',
      )}
    >
      {tile.fake ? (
        <span className="flex size-full items-center justify-center">
          <Sparkles className="size-1/2 text-tile-black" aria-hidden="true" />
        </span>
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-[4cqh] pb-[3cqh]">
          <span
            className={cn(
              'font-display font-extrabold leading-none tabular-nums',
              tile.num >= 10 ? 'text-[min(38cqh,46cqw)] tracking-[-0.04em]' : 'text-[min(44cqh,62cqw)] tracking-tight',
              TEXT[tile.color],
            )}
          >
            {tile.num}
          </span>
          <span className={cn('aspect-square w-[15cqw] rounded-full', ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][tile.color])} />
        </span>
      )}
    </button>
  )
}

/** Subtle house branding: an engraved ring in the felt and a brass plaque on the rail, like a real club table. */
export function FeltBranding() {
  return <TableBrand />
}

export function TileBack({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('h-8 w-6 rounded-sm border border-primary/30 bg-wood shadow', className)} />
}

function deal() {
  const deck = createDeck()
  const idx = deck.findIndex((t) => !t.fake)
  const indicator = deck.splice(idx, 1)[0]
  const okey = okeyFrom(indicator)
  const hands = [deck.splice(0, 15), deck.splice(0, 14), deck.splice(0, 14), deck.splice(0, 14)]
  hands[0] = sortHand(hands[0], okey, 'seri')
  return { deck, indicator, okey, hands, discards: [[], [], [], []] as Tile[][] }
}

type OkeySave = { game: ReturnType<typeof deal>; phase: Phase; message: string }

const TURN_SECONDS = 30

function SeatAvatar({ initial, turn, progress, urgent, small }: { initial: string; turn: boolean; progress?: number; urgent?: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full bg-background/50 p-[3px] shadow-[0_4px_10px_rgb(0_0_0/0.4)]',
        small ? 'size-10 sm:size-12' : 'size-11 sm:size-14',
        turn && progress == null && 'glow-gold ring-2 ring-primary',
      )}
      style={
        progress != null
          ? { background: `conic-gradient(${urgent ? 'var(--destructive)' : 'var(--primary)'} ${progress}turn, color-mix(in oklch, var(--background) 55%, transparent) 0)` }
          : undefined
      }
    >
      <span
        className={cn(
          'flex size-full items-center justify-center rounded-full border-2 font-display font-bold',
          small ? 'text-base sm:text-lg' : 'text-lg sm:text-xl',
          turn ? 'border-primary/60 bg-primary text-primary-foreground' : 'border-tile/30 bg-secondary text-foreground',
        )}
      >
        {initial}
      </span>
    </span>
  )
}

type DrawSource = 'deck' | 'pile'

/**
 * Drag a tile from the deck or the left player's pile onto the rack. Releasing over a rack slot places it there;
 * releasing anywhere a clear distance away still draws, so the player never has to aim precisely.
 */
function useDrawDrag(onDraw: (src: DrawSource, slot: number | null) => void) {
  const [ghost, setGhost] = useState<{ src: DrawSource; x: number; y: number; w: number; h: number } | null>(null)
  const ghostEl = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const drawRef = useRef(onDraw)
  drawRef.current = onDraw

  const start = (e: ReactPointerEvent, src: DrawSource) => {
    if (e.button !== 0) return
    const sx = e.clientX
    const sy = e.clientY
    const threshold = e.pointerType === 'touch' ? 6 : 10
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const size = src === 'deck' ? { w: box.width * 0.9, h: box.width * 1.26 } : { w: box.width, h: box.height }
    let moved = false
    dragged.current = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return
      if (!moved) {
        moved = true
        dragged.current = true
        setGhost({ src, x: ev.clientX, y: ev.clientY, ...size })
      }
      if (ghostEl.current) ghostEl.current.style.transform = ghostTransform(ev.clientX, ev.clientY)
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (!moved) return
      setGhost(null)
      setTimeout(() => (dragged.current = false), 400)
      if (ev.type === 'pointercancel') return
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const slot = el?.closest<HTMLElement>('[data-rack-slot]')
      const far = Math.hypot(ev.clientX - sx, ev.clientY - sy) > 48
      if (slot || el?.closest('[data-rack]') || far) drawRef.current(src, slot ? Number(slot.dataset.rackSlot) : null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return { ghost, ghostEl, start, dragged }
}

export function Okey({ finish, saveKey, bet }: GameApi) {
  const [saved] = useState(() => loadSaved<OkeySave>(saveKey))
  const [game, setGame] = useState(() => saved?.game ?? deal())
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? 'discard')
  const [active, setActive] = useState(saved?.phase === 'bots' ? 1 : 0)
  const [message, setMessage] = useState(saved?.message ?? 'Sıra sende – bir taş at')
  useSaveGame(saveKey, phase === 'over' || phase === 'bots' ? null : { game, phase, message })
  const [fresh, setFresh] = useState<number | null>(null)
  const [dropOver, setDropOver] = useState(false)
  const [cifte, setCifte] = useState(false)
  const [left, setLeft] = useState(TURN_SECONDS)

  const { deck, indicator, okey, hands, discards } = game
  const hand = hands[0]
  const rack = useRack(hand, okey)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) {
      boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])
  const selected = rack.selected
  const setSelected = rack.setSelected
  const tileName = (t: Tile) => (t.fake ? 'sahte okey' : `${COLOR_NAMES[t.color]} ${t.num}`)
  const winning = useMemo(() => (phase === 'discard' ? findWinningDiscard(hand, okey) : null), [hand, okey, phase])

  const [win, setWin] = useState<{ winner: string; mine: boolean; detail: string; tiles: Tile[]; result: 'win' | 'lose'; note: string } | null>(null)

  function end(result: 'win' | 'lose' | 'draw', note: string, reveal?: { winner: string; tiles: Tile[]; kind: 'seri' | 'cift' }) {
    playSound(result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'tick')
    setPhase('over')
    setMessage(note)
    if (reveal && result !== 'draw') {
      setWin({
        winner: reveal.winner,
        mine: result === 'win',
        detail: reveal.kind === 'cift' ? 'Çiftten bitti' : 'Seriden bitti',
        tiles: reveal.tiles,
        result,
        note,
      })
      return
    }
    setTimeout(() => finish(result, note), 1200)
  }

  function drawDeck(slot: number | null = null) {
    if (phase !== 'draw') return
    if (!deck.length) return end('draw', 'Ortada taş kalmadı, el berabere bitti.')
    const nextDeck = [...deck]
    const tile = nextDeck.pop()!
    playSound('tile')
    setGame({ ...game, deck: nextDeck, hands: [[...hand, tile], ...hands.slice(1)] })
    if (slot != null) rack.placeAt(tile.id, slot)
    if (isJoker(tile, okey)) rack.hide(tile.id)
    setSelected(tile.id)
    setFresh(tile.id)
    setPhase('discard')
    setMessage(isJoker(tile, okey) ? 'Okey geldi! Açmak için taşa dokun' : 'Şimdi bir taş at')
  }

  function takeDiscard(slot: number | null = null) {
    if (phase !== 'draw') return
    const pile = discards[3]
    if (!pile.length) return
    const tile = pile[pile.length - 1]
    const nextDiscards = discards.map((d, i) => (i === 3 ? d.slice(0, -1) : d))
    playSound('tile')
    setGame({ ...game, discards: nextDiscards, hands: [[...hand, tile], ...hands.slice(1)] })
    if (slot != null) rack.placeAt(tile.id, slot)
    setSelected(tile.id)
    setFresh(tile.id)
    setPhase('discard')
    setMessage('Şimdi bir taş at')
  }

  function discard(tileId: number | null) {
    if (phase !== 'discard' || tileId === null) return
    const tile = hand.find((t) => t.id === tileId)
    if (!tile) return
    // Throwing the winning tile ends the hand, just like closing out at a real table.
    if (winning?.tile.id === tileId) return finishHand()
    playSound('tile')
    const next = {
      ...game,
      hands: [hand.filter((t) => t.id !== tileId), ...hands.slice(1)],
      discards: discards.map((d, i) => (i === 0 ? [...d, tile] : d)),
    }
    setGame(next)
    writeSaved(saveKey, { game: next, phase: 'bots', message: `${BOT_NAMES[0]} oynuyor…` } satisfies OkeySave)
    setSelected(null)
    setFresh(null)
    setActive(1)
    setPhase('bots')
    setMessage(`${BOT_NAMES[0]} oynuyor…`)
  }

  function finishHand() {
    if (!winning) return
    const rest = hand.filter((t) => t.id !== winning.tile.id)
    setGame({ ...game, hands: [rest, ...hands.slice(1)], discards: discards.map((d, i) => (i === 0 ? [...d, winning.tile] : d)) })
    end('win', winning.kind === 'cift' ? 'Çiftten bitirdin! Masanın kralı sensin.' : 'Elini açtın! Masayı sen aldın.', {
      winner: 'Sen',
      tiles: rest,
      kind: winning.kind,
    })
  }

  function sort(mode: 'seri' | 'cift') {
    rack.arrange(mode)
  }

  useEffect(() => {
    if (phase !== 'bots') return
    const timers: ReturnType<typeof setTimeout>[] = []
    let state = game
    const step = (bot: number) => {
      timers.push(
        setTimeout(() => {
          const h = [...state.hands[bot]]
          const prevPile = state.discards[bot - 1]
          const top = prevPile[prevPile.length - 1]
          let deckNext = state.deck
          let discardsNext = state.discards
          if (top && wantsDiscard(h, top, state.okey)) {
            h.push(top)
            discardsNext = discardsNext.map((d, i) => (i === bot - 1 ? d.slice(0, -1) : d))
          } else {
            if (!deckNext.length) {
              end('draw', 'Ortada taş kalmadı, el berabere bitti.')
              return
            }
            deckNext = [...deckNext]
            h.push(deckNext.pop()!)
          }
          const win = findWinningDiscard(h, state.okey)
          const out = win ? win.tile : chooseDiscard(h, state.okey)
          const rest = h.filter((t) => t.id !== out.id)
          state = {
            ...state,
            deck: deckNext,
            hands: state.hands.map((x, i) => (i === bot ? rest : x)),
            discards: discardsNext.map((d, i) => (i === bot ? [...d, out] : d)),
          }
          setGame(state)
          playSound('tile')
          if (win) {
            end('lose', `${BOT_NAMES[bot - 1]} elini açtı. Bu masa onun.`, { winner: BOT_NAMES[bot - 1], tiles: rest, kind: win.kind })
            return
          }
          if (bot < 3) {
            setActive(bot + 1)
            setMessage(`${BOT_NAMES[bot]} oynuyor…`)
            step(bot + 1)
          } else
            timers.push(
              setTimeout(() => {
                setActive(0)
                setLeft(TURN_SECONDS)
                setPhase('draw')
                setMessage(`Sıra sende – desteden ya da ${BOT_NAMES[2]}’in taşından çek`)
              }, 500),
            )
        }, 850),
      )
    }
    step(1)
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const autoPlay = useRef<() => void>(() => {})
  autoPlay.current = () => {
    if (phase === 'draw') {
      setMessage('Süren doldu, otomatik çekildi')
      drawDeck()
    } else if (phase === 'discard') {
      const id = fresh != null && hand.some((t) => t.id === fresh) ? fresh : chooseDiscard(hand, okey).id
      discard(id)
    }
  }

  useEffect(() => {
    if (phase !== 'draw' && phase !== 'discard') return
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'draw' && phase !== 'discard') return
    if (left === 0) autoPlay.current()
    else if (left <= 5) playSound('tick')
  }, [left, phase])

  const pileTop = (i: number) => discards[i][discards[i].length - 1]

  function onDoubleTile(tile: Tile) {
    if (phase === 'discard') discard(tile.id)
    else if (isJoker(tile, okey) && !tile.fake) rack.toggleFlip(tile.id)
  }

  const drawDrag = useDrawDrag((src, slot) => (src === 'deck' ? drawDeck(slot) : takeDiscard(slot)))
  const drawGhostTile = drawDrag.ghost?.src === 'pile' ? pileTop(3) : null

  const canDiscard = phase === 'discard'
  const myTurn = phase === 'draw' || phase === 'discard'
  const urgent = myTurn && left <= 5
  const toast = winning && canDiscard ? `Bitirebilirsin – ${tileName(winning.tile)} taşını at` : message

  const seat = (p: 0 | 1 | 2 | 3) => {
    const name = p === 0 ? 'Sen' : BOT_NAMES[p - 1]
    const initials = p === 0 ? 'SN' : name.slice(0, 2).toLocaleUpperCase('tr-TR')
    const isActive = p === 0 ? myTurn : phase === 'bots' && active === p
    return (
      <div
        className={cn('okt-pl', `okt-p${p}`, isActive && 'active', p === 0 && urgent && 'urgent')}
        style={{ '--p': p === 0 && myTurn ? left / TURN_SECONDS : 1 } as CSSProperties}
      >
        <div className="okt-av" aria-hidden="true">
          {initials}
        </div>
        <div className="okt-nm">{name}</div>
        <span className="sr-only">
          {p === 0 ? (myTurn ? `Sıra sende, ${left} saniye` : 'Bekliyorsun') : `${BOTS[p - 1]} oyuncu, ${hands[p].length} taş${isActive ? ', oynuyor' : ''}`}
        </span>
      </div>
    )
  }

  const pile = (i: 0 | 1 | 2 | 3) => {
    const t = pileTop(i)
    const canTake = i === 3 && phase === 'draw' && !!t
    const canDrop = i === 0 && canDiscard && selected !== null
    return (
      <div className={cn('okt-pile okt-box', `okt-pile${i}`, canTake && 'can')}>
        {t && <MockTile tile={t} okey={okey} />}
        {canTake && (
          <button
            type="button"
            onPointerDown={(e) => drawDrag.start(e, 'pile')}
            onClick={() => !drawDrag.dragged.current && takeDiscard()}
            aria-label={`Yerdeki taşı al: ${tileName(t)}`}
            className="okt-hit"
          />
        )}
        {canDrop && <button type="button" onClick={() => discard(selected)} aria-label="Seçili taşı at" className="okt-hit" />}
      </div>
    )
  }

  return (
    <div ref={boardRef} className="scroll-mt-20">
      <div className="okt font-sans">
        <TableBrand center={false} plaque={false} corners={false} jako={false} />
        <div className="okt-logo" aria-hidden="true">
          ALKANKA
        </div>
        <div className={cn('okt-drop', dropOver && 'on')} aria-hidden="true" />
        <div className="okt-rot" aria-hidden="true">
          Daha büyük taşlar için telefonu yan çevir
        </div>

        {seat(2)}
        {seat(3)}
        {seat(1)}
        {seat(0)}

        {pile(2)}
        {pile(1)}
        {pile(3)}
        {pile(0)}

        <button
          type="button"
          className="okt-deck"
          data-on={phase === 'draw' || undefined}
          onPointerDown={(e) => phase === 'draw' && drawDrag.start(e, 'deck')}
          onClick={() => !drawDrag.dragged.current && drawDeck()}
          disabled={phase !== 'draw'}
          aria-label={`Ortadan taş çek, ${deck.length} taş kaldı`}
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
          <span className="okt-num">{deck.length} taş</span>
        </button>
        <div className="okt-ind okt-box">
          <MockTile tile={indicator} okey={{ color: -2, num: -2 }} label={`Gösterge: ${tileName(indicator)}`} />
        </div>
        <div className="okt-lbl" aria-hidden="true">
          Gösterge
        </div>

        <div className="okt-side">
          <button type="button" className="okt-btn" onClick={() => rack.arrange('seri')}>
            Seri Diz
          </button>
          <button type="button" className="okt-btn" onClick={() => rack.arrange('cift')}>
            Çift Diz
          </button>
          <button
            type="button"
            className="okt-btn gold"
            aria-pressed={cifte}
            onClick={() => {
              const on = !cifte
              setCifte(on)
              if (on) rack.arrange('cift')
              setMessage(on ? 'Çifte gidiyorsun – 7 çift topla' : 'Çifte gitmekten vazgeçtin')
            }}
          >
            Çifte Git
          </button>
        </div>
        <dl className="okt-info">
          <dt>Masa</dt>
          <dd>{bet.toLocaleString('tr-TR')}</dd>
          <dt>Çanak</dt>
          <dd>{(bet * 4).toLocaleString('tr-TR')}</dd>
        </dl>
        <div className="okt-toast" aria-live="polite">
          {toast}
        </div>

        <OkeyRack
          variant="table"
          hand={hand}
          okey={okey}
          rack={rack}
          highlight={fresh}
          looseDiscard={canDiscard}
          onDoubleTile={onDoubleTile}
          onDropOut={(id) => discard(id)}
          onDropHover={(k) => setDropOver(k === 'discard' || k === 'finish')}
        />
      </div>

      {win && (
        <OkeyWinOverlay
          winner={win.winner}
          mine={win.mine}
          detail={win.detail}
          tiles={win.tiles}
          okey={okey}
          actionLabel="Sonucu gör"
          onClose={() => {
            setWin(null)
            finish(win.result, win.note)
          }}
        />
      )}

      {drawDrag.ghost &&
        createPortal(
          <div
            ref={drawDrag.ghostEl}
            aria-hidden="true"
            className="okt-ghost"
            style={{ transform: ghostTransform(drawDrag.ghost.x, drawDrag.ghost.y) }}
          >
            <div style={{ width: drawDrag.ghost.w, height: drawDrag.ghost.h }}>
              {drawGhostTile ? <MockTile tile={drawGhostTile} okey={okey} /> : <MockTile back />}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

