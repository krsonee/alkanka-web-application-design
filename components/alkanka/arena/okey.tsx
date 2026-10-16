'use client'

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { FlipHorizontal2, Sparkles, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GameApi } from './stake-gate'
import { OkeyRack, useRack, type DropKind } from './okey-rack'
import { TableBrand } from './table-brand'
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
  size?: 'xs' | 'sm' | 'md' | 'fluid'
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
        'relative flex shrink-0 flex-col items-center justify-start rounded-md bg-tile shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_2px_4px_rgb(0_0_0/0.3)] transition-transform',
        size === 'md' ? 'h-16 w-11 pt-1.5 sm:h-[4.5rem] sm:w-12' : size === 'xs' ? 'h-8 w-6 rounded pt-0.5' : 'h-11 w-8 pt-1',
        selected && '-translate-y-3 ring-2 ring-primary',
        onClick && 'hover:-translate-y-1',
        joker && 'ring-2 ring-primary/80',
      )}
    >
      {tile.fake ? (
        <Sparkles className={cn('text-tile-black', size === 'md' ? 'mt-2 size-6' : 'mt-1 size-4')} aria-hidden="true" />
      ) : (
        <>
          <span className={cn('font-display font-bold leading-none', TEXT[tile.color], size === 'md' ? 'text-2xl' : size === 'xs' ? 'text-sm' : 'text-base')}>{tile.num}</span>
          <span className={cn('rounded-full', size === 'md' ? 'mt-1 size-2.5' : size === 'xs' ? 'mt-0.5 size-1' : 'mt-1 size-1.5', ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][tile.color])} />
        </>
      )}
      {joker && <span className="absolute -top-2 rounded bg-primary px-1 text-[8px] font-bold uppercase text-primary-foreground">Okey</span>}
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
        'relative flex size-full flex-col items-center justify-start gap-[8%] rounded-[3px] bg-tile pt-[12%] shadow-[inset_0_-3px_0_rgb(0_0_0/0.12),0_2px_3px_rgb(0_0_0/0.3)] sm:rounded-md',
        selected && 'ring-2 ring-primary',
        joker && !selected && 'ring-1 ring-primary/80',
      )}
    >
      {tile.fake ? (
        <Sparkles className="size-1/2 text-tile-black" aria-hidden="true" />
      ) : (
        <>
          <span className={cn('font-display text-[clamp(0.7rem,3.2vw,1.5rem)] font-bold leading-none', TEXT[tile.color])}>{tile.num}</span>
          <span className={cn('aspect-square w-[22%] rounded-full', ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][tile.color])} />
        </>
      )}
      {joker && <span className="absolute -top-1.5 rounded bg-primary px-0.5 text-[7px] font-bold uppercase leading-tight text-primary-foreground sm:text-[8px]">Okey</span>}
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

export function Okey({ finish }: GameApi) {
  const [game, setGame] = useState(deal)
  const [phase, setPhase] = useState<Phase>('discard')
  const [active, setActive] = useState(0)
  const [message, setMessage] = useState('Elinde 15 taş var. Bir taş seçip at, oyun başlasın.')
  const [fresh, setFresh] = useState<number | null>(null)
  const [dropOver, setDropOver] = useState<'discard' | 'finish' | null>(null)

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
    setPhase('over')
    setMessage(note)
    setTimeout(() => finish(result, note), 1200)
  }

  function drawDeck() {
    if (phase !== 'draw') return
    if (!deck.length) return end('draw', 'Ortada taş kalmadı, el berabere bitti.')
    const nextDeck = [...deck]
    const tile = nextDeck.pop()!
    setGame({ ...game, deck: nextDeck, hands: [[...hand, tile], ...hands.slice(1)] })
    setSelected(tile.id)
    setFresh(tile.id)
    setPhase('discard')
    setMessage(`Ortadan ${tileName(tile)} çektin (ıstakada "Yeni" yazıyor). Şimdi atacağın taşı seç.`)
  }

  function takeDiscard() {
    if (phase !== 'draw') return
    const pile = discards[3]
    if (!pile.length) return
    const tile = pile[pile.length - 1]
    const nextDiscards = discards.map((d, i) => (i === 3 ? d.slice(0, -1) : d))
    setGame({ ...game, discards: nextDiscards, hands: [[...hand, tile], ...hands.slice(1)] })
    setSelected(tile.id)
    setFresh(tile.id)
    setPhase('discard')
    setMessage(`Yerden ${tileName(tile)} aldın. Şimdi atacağın taşı seç.`)
  }

  function discard(tileId: number | null) {
    if (phase !== 'discard' || tileId === null) return
    const tile = hand.find((t) => t.id === tileId)
    if (!tile) return
    setGame({
      ...game,
      hands: [hand.filter((t) => t.id !== tileId), ...hands.slice(1)],
      discards: discards.map((d, i) => (i === 0 ? [...d, tile] : d)),
    })
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
          if (win) {
            end('lose', `${BOT_NAMES[bot - 1]} elini açtı. Bu masa onun.`)
            return
          }
          if (bot < 3) step(bot + 1)
          else
            timers.push(
              setTimeout(() => {
                setActive(0)
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

  const pileTop = (i: number) => discards[i][discards[i].length - 1]

  function onDoubleTile(tile: Tile) {
    if (phase === 'discard') discard(tile.id)
    else if (isJoker(tile, okey) && !tile.fake) rack.toggleFlip(tile.id)
  }

  function onDropOut(id: number, kind: DropKind) {
    if (kind === 'discard') return discard(id)
    if (!winning) return
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
    if (id == null || !winning) return
    if (winning.tile.id === id) finishHand()
    else setMessage('Bu taşla bitemezsin. Bitiren taş parlayan butonda yazıyor.')
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
          dropOver === 'discard' && 'scale-110 bg-primary/40',
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
      <div className={cn('flex items-center', className)}>
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-full border py-1 pl-1 pr-3.5 backdrop-blur-sm transition-colors',
            turn ? 'border-primary bg-background/85 glow-gold' : 'border-foreground/10 bg-background/55',
          )}
        >
          <span
            className={cn(
              'relative flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold sm:size-9',
              turn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
            )}
            aria-hidden="true"
          >
            {name.charAt(0)}
            {turn && <span className="absolute -inset-1 animate-ping rounded-full border border-primary/60" />}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-xs font-bold text-foreground sm:text-sm">{name}</span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="hidden gap-px sm:flex" aria-hidden="true">
                {Array.from({ length: Math.min(hands[bot].length, 7) }).map((_, i) => (
                  <span key={i} className="h-2.5 w-1.5 rounded-[1px] bg-wood ring-1 ring-foreground/10" />
                ))}
              </span>
              {turn ? <span className="text-primary">Düşünüyor</span> : `${hands[bot].length} taş`}
            </span>
          </span>
          <span className="sr-only">{BOTS[bot - 1]} oyuncu</span>
        </div>
      </div>
    )
  }

  const discardSlot = (i: number, className: string, interactive?: boolean) => {
    const t = pileTop(i)
    const canTake = interactive && phase === 'draw' && t
    return (
      <div className={cn('absolute flex flex-col items-center gap-1.5 rounded-xl bg-background/25 p-1.5 shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)]', className)}>
        {t ? (
          canTake ? (
            <TileFace tile={t} okey={okey} size="sm" onClick={takeDiscard} label={`Yerdeki taşı al: ${t.fake ? 'sahte okey' : `${COLOR_NAMES[t.color]} ${t.num}`}`} selected={false} />
          ) : (
            <TileFace tile={t} okey={okey} size="sm" />
          )
        ) : (
          <span className="h-11 w-8 rounded-md border border-foreground/10 bg-background/20" aria-hidden="true" />
        )}
        {(canTake || interactive || i === 0) && (
          <span className={cn('text-[9px] font-bold uppercase tracking-wider', canTake ? 'animate-pulse text-primary' : 'text-foreground/55')}>
            {canTake ? 'Yerden al' : interactive ? 'Soldan gelen' : 'Senin attığın'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div ref={boardRef} className="flex scroll-mt-20 flex-col gap-2 sm:gap-4">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border-[6px] border-wood bg-felt shadow-[inset_0_0_80px_rgb(0_0_0/0.55),0_20px_40px_rgb(0_0_0/0.4)] sm:aspect-[16/9] sm:rounded-[2rem] sm:border-[10px]">
        <FeltBranding />
        <div className="absolute inset-x-0 top-2 flex justify-center sm:top-3">{seat(2, '')}</div>
        <div className="absolute inset-y-0 left-2 flex items-center sm:left-3">{seat(3, '')}</div>
        <div className="absolute inset-y-0 right-2 flex items-center sm:right-3">{seat(1, '')}</div>

        {discardSlot(3, 'bottom-2 left-2 sm:bottom-6 sm:left-6', true)}
        {discardZone}
        {discardSlot(1, 'right-2 top-2 sm:right-6 sm:top-6')}
        {discardSlot(2, 'left-2 top-2 sm:left-6 sm:top-6')}

        <div className="absolute inset-0 m-auto flex h-fit w-fit items-center gap-5">
          <button
            type="button"
            onClick={drawDeck}
            disabled={phase !== 'draw'}
            aria-label={`Ortadan taş çek, ${deck.length} taş kaldı`}
            className={cn('group relative flex flex-col items-center gap-2 rounded-xl p-2', phase === 'draw' && 'ring-2 ring-primary animate-pulse')}
          >
            <span className="relative h-11 w-9">
              <TileBack className="absolute left-1 top-1 h-11 w-8" />
              <TileBack className="absolute left-0.5 top-0.5 h-11 w-8" />
              <TileBack className="absolute left-0 top-0 h-11 w-8" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">{phase === 'draw' ? 'Çek' : `${deck.length} taş`}</span>
          </button>
          <div
            onDragOver={(e) => {
              if (!winning) return
              e.preventDefault()
              setDropOver('finish')
            }}
            onDragLeave={() => setDropOver(null)}
            onDrop={onFinishDrop}
            data-drop={winning ? 'finish' : undefined}
            title={winning ? 'Bitiren taşı göstergenin üstüne sürükle' : undefined}
            className={cn('flex flex-col items-center gap-2 rounded-xl p-1 transition-all', winning && 'ring-2 ring-primary', dropOver === 'finish' && 'scale-110 bg-primary/30')}
          >
            <TileFace tile={indicator} okey={{ color: -2, num: -2 }} size="sm" label={`Gösterge: ${COLOR_NAMES[indicator.color]} ${indicator.num}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gösterge</span>
          </div>
          <div className="hidden flex-col items-start gap-0.5 rounded-lg bg-background/60 px-3 py-2 sm:flex">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Okey taşı</span>
            <span className={cn('font-display text-lg font-bold', TEXT[okey.color])}>
              {COLOR_NAMES[okey.color]} {okey.num}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 sm:gap-3 sm:p-4">
        <div className="hidden sm:block">
          <TurnSteps phase={phase === 'draw' ? 'draw' : phase === 'discard' ? 'discard' : 'wait'} />
        </div>
        <div className="flex items-center justify-between gap-2 sm:flex-wrap sm:gap-3">
          <p className="min-w-0 text-xs font-semibold leading-snug text-foreground sm:text-sm" aria-live="polite">
            {message}
          </p>
          <div className="flex shrink-0 gap-1.5 sm:flex-wrap sm:gap-2">
            <button onClick={() => sort('seri')} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary sm:px-3 sm:py-2">
              Seri diz
            </button>
            <button onClick={() => sort('cift')} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary sm:px-3 sm:py-2">
              Çift diz
            </button>
            {selectedIsJoker && selected !== null && (
              <button
                onClick={() => rack.toggleFlip(selected)}
                aria-label={rack.flipped.has(selected) ? 'Okeyi aç' : 'Okeyi ters çevir'}
                className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 sm:px-3 sm:py-2"
              >
                <FlipHorizontal2 className="size-3.5" aria-hidden="true" />
                {rack.flipped.has(selected) ? 'Okeyi aç' : 'Okeyi ters çevir'}
              </button>
            )}
          </div>
        </div>

        <OkeyRack hand={hand} okey={okey} rack={rack} highlight={fresh} onDoubleTile={onDoubleTile} onDropOut={onDropOut} onDropHover={(k) => setDropOver(k === 'discard' || k === 'finish' ? k : null)} />

        <div className="flex gap-2">
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
