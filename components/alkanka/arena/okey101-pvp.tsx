'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Bot, ChevronDown, Eye, Plus, Trophy, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { analyzeMeld, leftOf101, OPEN_MIN, PAIR_MIN, type Okey101View } from '@/lib/games/okey101'
import type { Remote } from './remote'
import { FeltBranding, TileBack, TileFace } from './okey'
import { okeyFrom, sortHand, type Tile } from './okey-engine'

type OkeyValue = ReturnType<typeof okeyFrom>

export function Okey101Pvp({ remote }: { remote: Remote<Okey101View> }) {
  const s = remote.state
  const n = s.seats
  const mySeat = remote.spectator ? -1 : remote.seat
  const okey = useMemo(() => okeyFrom(s.indicator), [s.indicator])
  const rawHand = mySeat >= 0 ? s.hands[mySeat] ?? [] : []
  const [sortMode, setSortMode] = useState<'seri' | 'cift'>('seri')
  const hand = useMemo(() => sortHand(rawHand, okey, sortMode), [rawHand, okey, sortMode])
  const [selected, setSelected] = useState<number[]>([])
  const [staged, setStaged] = useState<number[][]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const stagedIds = new Set(staged.flat())
  const handIds = new Set(hand.map((t) => t.id))
  const liveStaged = staged.filter((g) => g.every((id) => handIds.has(id)))
  const liveSelected = selected.filter((id) => handIds.has(id) && !stagedIds.has(id))
  const byId = new Map(hand.map((t) => [t.id, t]))
  const tilesOf = (ids: number[]) => ids.map((id) => byId.get(id)).filter(Boolean) as Tile[]

  const myTurn = remote.myTurn
  const drawPhase = myTurn && s.phase === 'draw'
  const playPhase = myTurn && s.phase === 'play'
  const opened = mySeat >= 0 ? s.opened[mySeat] : null

  const stagedInfo = liveStaged.map((g) => analyzeMeld(tilesOf(g), okey))
  const stagedValue = stagedInfo.reduce((a, b) => a + (b?.value ?? 0), 0)
  const stagedPairs = stagedInfo.filter((a) => a?.kind === 'pair').length
  const allValid = stagedInfo.length > 0 && stagedInfo.every(Boolean)
  const canDiscard = playPhase && liveSelected.length === 1 && s.taken == null && !remote.busy

  const reset = () => {
    setSelected([])
    setStaged([])
    setLocalError(null)
  }
  const act = async (action: Parameters<typeof remote.send>[0]) => {
    setLocalError(null)
    const ok = await remote.send(action)
    if (ok) reset()
  }
  const toggle = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const makeGroup = () => {
    const tiles = tilesOf(liveSelected)
    if (tiles.length < 2) return setLocalError('Grup için en az 2 taş seç (çift 2, per en az 3 taş).')
    if (!analyzeMeld(tiles, okey)) return setLocalError('Seçtiğin taşlar geçerli bir seri, per ya da çift oluşturmuyor.')
    setStaged((g) => [...g, liveSelected])
    setSelected([])
    setLocalError(null)
  }

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
  const canTakeSide = drawPhase && !!sideTop && !s.noTake && !remote.busy

  const seatPill = (seat: number | null, vertical?: boolean) =>
    seat == null ? <span /> : (
      <SeatPill
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
        ? 'Sıra sende: ortadan çek ya da soldan gelen taşı al.'
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
              <div className="flex max-h-36 w-full flex-wrap content-start justify-center gap-1 overflow-y-auto sm:max-h-56 sm:gap-1.5" aria-label="Yerdeki perler">
                {s.melds.map((m) => {
                  const canAdd = playPhase && !!opened && m.kind !== 'pair' && liveSelected.length > 0
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!canAdd || remote.busy}
                      onClick={() => act({ type: 'add', meldId: m.id, tileIds: liveSelected })}
                      aria-label={`${nameOf(m.owner)} peri${canAdd ? ', seçili taşları işle' : ''}`}
                      className={cn(
                        'flex gap-px rounded-md bg-background/30 p-0.5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.4)] disabled:cursor-default',
                        canAdd && 'ring-2 ring-primary',
                        m.owner === mySeat && 'outline outline-1 outline-primary/50',
                      )}
                    >
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
            disabled={!canDiscard}
            onClick={() => act({ type: 'discard', tileId: liveSelected[0] })}
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
          {liveStaged.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Hazır: {stagedPairs > 0 ? `${stagedPairs} çift` : `${stagedValue} sayı`}
              </span>
              {liveStaged.map((g, i) => (
                <button
                  key={g.join('-')}
                  type="button"
                  onClick={() => setStaged((cur) => cur.filter((_, k) => k !== i))}
                  aria-label="Grubu ıstakaya geri al"
                  className="flex items-center gap-px rounded-md border border-border bg-secondary p-0.5 hover:border-destructive"
                >
                  {tilesOf(g).map((t) => (
                    <TileFace key={t.id} tile={t} okey={okey} size="xs" />
                  ))}
                  <span className="px-1 text-[10px] font-bold tabular-nums text-foreground">{stagedInfo[i]?.value ?? '?'}</span>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-wood p-1.5 shadow-[0_10px_20px_rgb(0_0_0/0.4)] sm:p-2">
            <div className="grid gap-x-0.5 sm:gap-x-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="group" aria-label={`Istakan, ${hand.length} taş`}>
              {Array.from({ length: slots }, (_, i) => {
                const t = hand[i]
                return (
                  <div key={t ? t.id : `e-${i}`} className="flex items-end border-b-4 border-background/40 pb-1 pt-2">
                    {t ? (
                      <div
                        className={cn(
                          'aspect-[3/4] w-full transition-transform',
                          liveSelected.includes(t.id) && '-translate-y-1.5',
                          stagedIds.has(t.id) && 'opacity-30',
                        )}
                      >
                        <TileFace
                          tile={t}
                          okey={okey}
                          size="fluid"
                          selected={liveSelected.includes(t.id)}
                          onClick={stagedIds.has(t.id) ? undefined : () => toggle(t.id)}
                        />
                      </div>
                    ) : (
                      <div className="aspect-[3/4] w-full" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {localError && (
            <p role="alert" className="text-xs text-destructive sm:text-sm">
              {localError}
            </p>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            <ActionButton disabled={!playPhase || liveSelected.length < 2} onClick={makeGroup}>
              <Plus className="size-3.5" aria-hidden="true" /> Grup
            </ActionButton>
            {!opened ? (
              <>
                <ActionButton
                  primary
                  disabled={!playPhase || !allValid || stagedPairs > 0 || stagedValue < OPEN_MIN || remote.busy}
                  onClick={() => act({ type: 'open', mode: 'seri', groups: liveStaged })}
                >
                  Aç <span className="tabular-nums opacity-80">{stagedValue}/{OPEN_MIN}</span>
                </ActionButton>
                <ActionButton
                  primary
                  disabled={!playPhase || !allValid || stagedPairs !== liveStaged.length || stagedPairs < PAIR_MIN || remote.busy}
                  onClick={() => act({ type: 'open', mode: 'cift', groups: liveStaged })}
                >
                  Çift <span className="tabular-nums opacity-80">{stagedPairs}/{PAIR_MIN}</span>
                </ActionButton>
              </>
            ) : (
              <div className="col-span-2">
                <ActionButton primary disabled={!playPhase || !allValid || remote.busy} onClick={() => act({ type: 'lay', groups: liveStaged })}>
                  Perleri yere aç
                </ActionButton>
              </div>
            )}
            {s.taken != null && playPhase ? (
              <ActionButton disabled={remote.busy} onClick={() => act({ type: 'giveBack' })}>
                <Undo2 className="size-3.5" aria-hidden="true" /> Geri ver
              </ActionButton>
            ) : (
              <ActionButton danger disabled={!canDiscard} onClick={() => act({ type: 'discard', tileId: liveSelected[0] })}>
                <ArrowDownToLine className="size-3.5" aria-hidden="true" /> At
              </ActionButton>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === 'seri' ? 'cift' : 'seri'))}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary"
            >
              {sortMode === 'seri' ? 'Çifte göre diz' : 'Seriye göre diz'}
            </button>
            {(liveSelected.length > 0 || liveStaged.length > 0) && (
              <button type="button" onClick={reset} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary">
                <X className="size-3.5" aria-hidden="true" /> Seçimi temizle
              </button>
            )}
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
}: {
  name: string
  bot: boolean
  turn: boolean
  count: number
  status: string | null
  vertical?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center border backdrop-blur-sm transition-colors',
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
