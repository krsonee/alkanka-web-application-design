'use client'

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { FlipHorizontal2, Sparkles, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GameApi } from './stake-gate'
import { loadSaved, useSaveGame, writeSaved } from './saved-game'
import { OkeyRack, ghostTransform, useRack, type DropKind } from './okey-rack'
import { TableBrand } from './table-brand'
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
        'relative flex size-full flex-col items-center justify-center gap-[4cqh] rounded-[13cqw] pb-[3cqh] [container-type:size]',
        joker ? 'okey-tile-joker' : 'okey-tile-face okey-tile-body',
        selected && 'ring-2 ring-primary',
      )}
    >
      {tile.fake ? (
        <Sparkles className="size-1/2 text-tile-black" aria-hidden="true" />
      ) : (
        <>
          <span
            className={cn(
              'font-display font-extrabold leading-none tabular-nums',
              tile.num >= 10 ? 'text-[min(40cqh,50cqw)] tracking-[-0.1em]' : 'text-[min(44cqh,62cqw)] tracking-tight',
              TEXT[tile.color],
            )}
          >
            {tile.num}
          </span>
          <span className={cn('aspect-square w-[15cqw] rounded-full', ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][tile.color])} />
        </>
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
  const [ghost, setGhost] = useState<{ src: DrawSource; x: number; y: number } | null>(null)
  const ghostEl = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const drawRef = useRef(onDraw)
  drawRef.current = onDraw

  const start = (e: ReactPointerEvent, src: DrawSource) => {
    if (e.button !== 0) return
    const sx = e.clientX
    const sy = e.clientY
    const threshold = e.pointerType === 'touch' ? 6 : 10
    let moved = false
    dragged.current = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return
      if (!moved) {
        moved = true
        dragged.current = true
        setGhost({ src, x: ev.clientX, y: ev.clientY })
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
  const [message, setMessage] = useState(saved?.message ?? 'Elinde 15 taş var. Bir taş seçip at, oyun başlasın.')
  useSaveGame(saveKey, phase === 'over' || phase === 'bots' ? null : { game, phase, message })
  const [fresh, setFresh] = useState<number | null>(null)
  const [dropOver, setDropOver] = useState<'discard' | 'finish' | null>(null)
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

  function end(result: 'win' | 'lose' | 'draw', note: string) {
    playSound(result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'tick')
    setPhase('over')
    setMessage(note)
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
    setMessage(`Ortadan ${tileName(tile)} çektin (ıstakada "Yeni" yazıyor). Şimdi atacağın taşı seç.`)
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
    setMessage(`Yerden ${tileName(tile)} aldın. Şimdi atacağın taşı seç.`)
  }

  function discard(tileId: number | null) {
    if (phase !== 'discard' || tileId === null) return
    const tile = hand.find((t) => t.id === tileId)
    if (!tile) return
    playSound('tile')
    const next = {
      ...game,
      hands: [hand.filter((t) => t.id !== tileId), ...hands.slice(1)],
      discards: discards.map((d, i) => (i === 0 ? [...d, tile] : d)),
    }
    setGame(next)
    writeSaved(saveKey, { game: next, phase: 'bots', message: 'Rakipler oynuyor...' } satisfies OkeySave)
    setSelected(null)
    setFresh(null)
    setActive(1)
    setPhase('bots')
    setMessage('Rakipler oynuyor...')
  }

  function finishHand() {
    if (!winning) return
    const rest = hand.filter((t) => t.id !== winning.tile.id)
    setGame({ ...game, hands: [rest, ...hands.slice(1)], discards: discards.map((d, i) => (i === 0 ? [...d, winning.tile] : d)) })
    end('win', winning.kind === 'cift' ? 'Çiftten bitirdin! Masanın kralı sensin.' : 'Elini açtın! Masayı sen aldın.')
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
          setActive(bot)
          playSound('tile')
          if (win) {
            end('lose', `${BOT_NAMES[bot - 1]} elini açtı. Bu masa onun.`)
            return
          }
          if (bot < 3) step(bot + 1)
          else
            timers.push(
              setTimeout(() => {
                setActive(0)
                setLeft(TURN_SECONDS)
                setPhase('draw')
                setMessage('Sıra sende. 1. adım: ortadaki desteden çek ya da sol alttaki Goril’in attığı taşı al.')
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
      setMessage('Süren doldu, ortadan otomatik çekildi.')
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

  function onDropOut(id: number, kind: DropKind) {
    // Dropping the winning tile in the middle finishes; any other throw onto the table is a plain discard.
    if (kind === 'finish' && winning?.tile.id === id) return finishHand()
    discard(id)
  }

  const drawDrag = useDrawDrag((src, slot) => (src === 'deck' ? drawDeck(slot) : takeDiscard(slot)))
  const drawGhostTile = drawDrag.ghost?.src === 'pile' ? pileTop(3) : null

  function tryFinishWith(id: number) {
    if (!winning) return setMessage('Henüz bitemezsin. Önce perlerini tamamla, sonra taşı ortaya sürükle.')
    if (winning.tile.id === id) finishHand()
    else setMessage('Bu taşla bitemezsin. Bitiren taş parlayan butonda yazıyor.')
  }

  function dropTileId(e: DragEvent) {
    e.preventDefault()
    setDropOver(null)
    const id = Number(e.dataTransfer.getData('text/plain'))
    return Number.isFinite(id) ? id : null
  }

  function onFinishDrop(e: DragEvent) {
    const id = dropTileId(e)
    if (id != null) tryFinishWith(id)
  }

  const selectedTile = hand.find((t) => t.id === selected)
  const selectedIsJoker = selectedTile ? isJoker(selectedTile, okey) && !selectedTile.fake : false
  const canDiscard = phase === 'discard'

  const discardZone = (
    <div
      onDragOver={(e) => {
        if (!canDiscard) return
        e.preventDefault()
        setDropOver('discard')
      }}
      data-drop={canDiscard ? 'discard' : undefined}
      onDragLeave={() => setDropOver(null)}
      onDrop={(e) => {
        const id = dropTileId(e)
        if (id != null) discard(id)
      }}
      className="absolute bottom-3 right-3 flex flex-col items-center gap-1.5 rounded-xl bg-background/25 p-1.5 shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)] sm:bottom-6 sm:right-6"
    >
      <button
        type="button"
        onClick={() => discard(selected)}
        disabled={!canDiscard || selected === null}
        aria-label={selectedTile ? `Seçili taşı buraya at: ${tileName(selectedTile)}` : 'Atılacak taşı seç'}
        className={cn(
          'relative flex h-11 w-8 items-center justify-center rounded-md transition-all sm:h-14 sm:w-10',
          canDiscard ? 'border-2 border-dashed border-primary bg-primary/15' : 'border border-dashed border-foreground/20',
          dropOver === 'discard' && 'bg-primary/40 ring-2 ring-primary',
          canDiscard && selected !== null && 'animate-pulse',
        )}
      >
        {pileTop(0) && !canDiscard ? <TileFace tile={pileTop(0)} okey={okey} size="sm" /> : null}
      </button>
      <span className={cn('text-[9px] font-bold uppercase tracking-wider', canDiscard ? 'text-primary' : 'text-foreground/50')}>
        {canDiscard ? 'Buraya at' : 'Senin attığın'}
      </span>
    </div>
  )

  const seat = (bot: 1 | 2 | 3, className: string) => {
    const turn = active === bot && phase === 'bots'
    const name = BOT_NAMES[bot - 1]
    return (
      <div className={cn('flex flex-col items-center gap-1', className)}>
        <SeatAvatar initial={name.charAt(0)} turn={turn} />
        <span
          className={cn(
            'flex flex-col items-center rounded-md px-2 py-0.5 leading-tight shadow-sm',
            turn ? 'bg-primary text-primary-foreground' : 'bg-background/70 text-foreground',
          )}
        >
          <span className="text-[11px] font-bold sm:text-xs">{name}</span>
          <span className={cn('text-[9px] font-semibold uppercase tracking-wider', turn ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {turn ? 'Düşünüyor' : `${hands[bot].length} taş`}
          </span>
        </span>
        <span className="sr-only">{BOTS[bot - 1]} oyuncu</span>
      </div>
    )
  }

  const myTurn = phase === 'draw' || phase === 'discard'
  const urgent = myTurn && left <= 5

  const discardSlot = (i: number, className: string, interactive?: boolean) => {
    const t = pileTop(i)
    const canTake = interactive && phase === 'draw' && t
    return (
      <div
        className={cn(
          'absolute flex flex-col items-center gap-1.5 rounded-xl bg-background/25 p-1.5 shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)]',
          canTake && 'z-20 ring-2 ring-primary',
          className,
        )}
      >
        {t ? (
          canTake ? (
            <button
              type="button"
              onPointerDown={(e) => drawDrag.start(e, 'pile')}
              onClick={() => !drawDrag.dragged.current && takeDiscard()}
              aria-label={`Yerdeki taşı al: ${t.fake ? 'sahte okey' : `${COLOR_NAMES[t.color]} ${t.num}`}`}
              className={cn(
                '-m-1.5 flex cursor-grab touch-none select-none flex-col items-center gap-1.5 rounded-xl p-1.5 [-webkit-touch-callout:none]',
                drawDrag.ghost?.src === 'pile' && 'opacity-40',
              )}
            >
              <TileFace tile={t} okey={okey} size="sm" />
              <span className="animate-pulse text-[9px] font-bold uppercase tracking-wider text-primary">Yerden al</span>
            </button>
          ) : (
            <TileFace tile={t} okey={okey} size="sm" />
          )
        ) : (
          <span className="h-11 w-8 rounded-md border border-foreground/10 bg-background/20" aria-hidden="true" />
        )}
        {!canTake && (interactive || i === 0) && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/55">{interactive ? 'Soldan gelen' : 'Senin attığın'}</span>
        )}
      </div>
    )
  }

  return (
    <div ref={boardRef} className="flex scroll-mt-20 flex-col gap-2 sm:gap-4">
      <div data-ls-main="okey" className="ls-tall relative aspect-[3/2] w-full overflow-hidden rounded-2xl border-[6px] border-wood okey-felt shadow-[inset_0_0_80px_rgb(0_0_0/0.5),0_20px_40px_rgb(0_0_0/0.4)] sm:aspect-[16/9] sm:rounded-[2rem] sm:border-[10px]">
        <FeltBranding />
        <div className="absolute inset-x-0 top-2 flex justify-center sm:top-3">{seat(2, '')}</div>
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center sm:bottom-4">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 shadow-lg',
              myTurn ? 'border-primary/70 bg-background/80' : 'border-foreground/10 bg-background/55',
            )}
          >
            <SeatAvatar initial="S" small turn={myTurn} progress={myTurn ? left / TURN_SECONDS : undefined} urgent={urgent} />
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-bold text-foreground sm:text-sm">Sen</span>
              <span
                className={cn('text-[10px] font-bold uppercase tabular-nums tracking-wider', urgent ? 'text-destructive' : myTurn ? 'text-primary' : 'text-muted-foreground')}
                aria-live={urgent ? 'assertive' : 'off'}
              >
                {myTurn ? `${left} sn` : 'Bekliyor'}
              </span>
            </span>
          </div>
        </div>
        <div className="ls-seat-l absolute inset-y-0 left-2 flex items-center sm:left-3">{seat(3, '')}</div>
        <div className="ls-seat-r absolute inset-y-0 right-2 flex items-center sm:right-3">{seat(1, '')}</div>

        {discardSlot(3, 'bottom-2 left-2 sm:bottom-6 sm:left-6', true)}
        {discardZone}
        {discardSlot(1, 'right-2 top-2 sm:right-6 sm:top-6')}
        {discardSlot(2, 'left-2 top-2 sm:left-6 sm:top-6')}

        <div
          onDragOver={(e) => {
            if (!canDiscard) return
            e.preventDefault()
            setDropOver('finish')
          }}
          onDragLeave={() => setDropOver(null)}
          onDrop={onFinishDrop}
          data-drop={canDiscard ? 'finish' : undefined}
          title={canDiscard ? 'Bitiren taşı masanın ortasına sürükle' : undefined}
          className={cn(
            'absolute inset-0 ls-center m-auto flex h-fit w-fit items-center gap-5 rounded-2xl p-2 transition-colors phone-ls:scale-[0.82] phone-ls:gap-1',
            winning && 'ring-2 ring-primary',
            dropOver === 'finish' && 'bg-primary/25',
          )}
        >
          <button
            type="button"
            onPointerDown={(e) => phase === 'draw' && drawDrag.start(e, 'deck')}
            onClick={() => !drawDrag.dragged.current && drawDeck()}
            disabled={phase !== 'draw'}
            aria-label={`Ortadan taş çek, ${deck.length} taş kaldı`}
            className={cn(
              'group relative flex touch-none select-none flex-col items-center gap-2 rounded-xl p-2 [-webkit-touch-callout:none]',
              phase === 'draw' && 'cursor-grab ring-2 ring-primary',
            )}
          >
            <span className="relative h-11 w-9">
              <TileBack className="absolute left-1 top-1 h-11 w-8" />
              <TileBack className="absolute left-0.5 top-0.5 h-11 w-8" />
              <TileBack className="absolute left-0 top-0 h-11 w-8" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">{phase === 'draw' ? 'Çek' : `${deck.length} taş`}</span>
          </button>
          <div className="flex flex-col items-center gap-2 rounded-xl p-1">
            <TileFace tile={indicator} okey={{ color: -2, num: -2 }} size="sm" label={`Gösterge: ${COLOR_NAMES[indicator.color]} ${indicator.num}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gösterge</span>
          </div>
          <dl className="ls-split-hide hidden min-w-32 flex-col gap-1 rounded-lg bg-background/65 px-3 py-2 text-[11px] shadow-lg sm:flex phone-ls:hidden">
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold uppercase tracking-wider text-muted-foreground">Okey</dt>
              <dd className="flex items-center gap-1 font-display text-sm font-bold">
                <span className={cn('size-2 rounded-full', ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][okey.color])} aria-hidden="true" />
                <span className="text-foreground">
                  {COLOR_NAMES[okey.color]} {okey.num}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold uppercase tracking-wider text-muted-foreground">Masa</dt>
              <dd className="font-bold tabular-nums text-primary">{bet.toLocaleString('tr-TR')} KP</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold uppercase tracking-wider text-muted-foreground">Destede</dt>
              <dd className="font-bold tabular-nums text-foreground">{deck.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div data-ls-flat className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 sm:gap-3 sm:p-4">
        <div data-ls-hide className="hidden sm:block">
          <TurnSteps phase={phase === 'draw' ? 'draw' : phase === 'discard' ? 'discard' : 'wait'} />
        </div>
        <div data-ls-stack className="ls-okey-panel flex items-center justify-between gap-2 sm:flex-wrap sm:gap-3">
          <p className="ls-okey-msg min-w-0 text-xs font-semibold leading-snug text-foreground sm:text-sm" aria-live="polite">
            {message}
          </p>
          <div className="flex shrink-0 gap-1.5 sm:flex-wrap sm:gap-2">
            <button onClick={() => sort('seri')} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary sm:px-3 sm:py-2">
              Seri diz
            </button>
            <button onClick={() => sort('cift')} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary sm:px-3 sm:py-2">
              Çift diz
            </button>
            {/* Always mounted so the sideways layout keeps its height (and scale) when an okey is selected. */}
            <button
              onClick={() => selected !== null && rack.toggleFlip(selected)}
              disabled={!selectedIsJoker}
              data-on={selectedIsJoker || undefined}
              aria-hidden={!selectedIsJoker || undefined}
              tabIndex={selectedIsJoker ? undefined : -1}
              className={cn(
                'ls-okey-joker items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 sm:px-3 sm:py-2',
                selectedIsJoker ? 'flex' : 'hidden',
              )}
            >
              <FlipHorizontal2 className="size-3.5" aria-hidden="true" />
              {selected !== null && rack.flipped.has(selected) ? 'Okeyi aç' : 'Okeyi ters çevir'}
            </button>
          </div>
        </div>

        <div className="ls-okey-rack">
          <OkeyRack
            hand={hand}
            okey={okey}
            rack={rack}
            highlight={fresh}
            looseDiscard={canDiscard}
            onDoubleTile={onDoubleTile}
            onDropOut={onDropOut}
            onDropHover={(k) => setDropOver(k === 'discard' || k === 'finish' ? k : null)}
          />
        </div>
        {drawDrag.ghost &&
          createPortal(
            <div
              ref={drawDrag.ghostEl}
              aria-hidden="true"
              className="pointer-events-none fixed left-0 top-0 z-[200] h-12 w-9 drop-shadow-2xl will-change-transform sm:h-14 sm:w-10"
              style={{ transform: ghostTransform(drawDrag.ghost.x, drawDrag.ghost.y) }}
            >
              {drawGhostTile ? <TileFace tile={drawGhostTile} okey={okey} size="fluid" selected /> : <TileBack className="size-full" />}
            </div>,
            document.body,
          )}

        <div className="ls-okey-panel ls-okey-actions flex gap-2">
          <button
            onClick={() => discard(selected)}
            disabled={phase !== 'discard' || selected === null}
            className="flex-1 rounded-xl border border-primary/50 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-primary hover:bg-primary/10 disabled:opacity-40 sm:px-5 sm:py-3 sm:text-sm"
          >
            Seçili taşı at
          </button>
          <button
            onClick={finishHand}
            disabled={!winning}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40 sm:gap-2 sm:px-5 sm:py-3 sm:text-sm',
              winning && 'glow-gold animate-pulse',
            )}
          >
            <Trophy className="size-4 shrink-0" aria-hidden="true" />
            {winning ? (
              'Elini aç ve bitir'
            ) : (
              <>
                <span className="sm:hidden">Per tamamla</span>
                <span className="hidden sm:inline">Bitirmek için per tamamla</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
