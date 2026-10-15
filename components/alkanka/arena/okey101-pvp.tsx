'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, Bot, Eye, Layers, Plus, Trophy, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { analyzeMeld, leftOf101, OPEN_MIN, PAIR_MIN, type Okey101View } from '@/lib/games/okey101'
import type { Remote } from './remote'
import { TileBack, TileFace } from './okey'
import { okeyFrom, sortHand, type Tile } from './okey-engine'

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
  const leftSeat = mySeat >= 0 ? leftOf101(mySeat, n) : 0
  const sideTop = s.discards[leftSeat]?.[s.discards[leftSeat].length - 1]

  const stagedInfo = liveStaged.map((g) => analyzeMeld(tilesOf(g), okey))
  const stagedValue = stagedInfo.reduce((a, b) => a + (b?.value ?? 0), 0)
  const stagedPairs = stagedInfo.filter((a) => a?.kind === 'pair').length
  const allValid = stagedInfo.length > 0 && stagedInfo.every(Boolean)

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

  const nameOf = (seat: number) => remote.names[seat] ?? `Oyuncu ${seat + 1}`
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== mySeat)
  const lastResult = s.results[s.results.length - 1]

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {remote.spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Eller gizli, yere açılan perler canlı görünür.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-4">
        {Array.from({ length: n }, (_, i) => i).map((seat) => (
          <div
            key={seat}
            className={cn(
              'flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm',
              s.turn === seat ? 'border-primary ring-2 ring-primary/30' : 'border-border',
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
              {s.bots.includes(seat) && <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bot" />}
              <span className="truncate">{seat === mySeat ? 'Sen' : nameOf(seat)}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end text-xs leading-tight">
              <span className={cn('font-bold', s.opened[seat] ? 'text-primary' : 'text-muted-foreground')}>
                {s.opened[seat] === 'cift' ? 'Çifte gitti' : s.opened[seat] ? 'Açtı' : 'Açmadı'}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {s.handCounts[seat]} taş · ceza {s.totals[seat] + s.penalties[seat]}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-wood p-2 shadow-xl sm:p-3">
        <div className="relative flex min-h-80 flex-col gap-4 rounded-xl bg-felt p-3 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gösterge</span>
                <TileFace tile={s.indicator} okey={okey} size="sm" />
              </div>
              <button
                type="button"
                disabled={!drawPhase || remote.busy}
                onClick={() => act({ type: 'draw', from: 'deck' })}
                className={cn('flex flex-col items-center gap-1 rounded-xl p-2 disabled:cursor-default', drawPhase && 'animate-pulse ring-2 ring-primary')}
                aria-label={`Desteden çek, ${s.deckCount} taş kaldı`}
              >
                <span className="relative">
                  <TileBack className="h-14 w-10" />
                  <Layers className="absolute inset-0 m-auto size-4 text-primary" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.deckCount} taş</span>
              </button>
              <button
                type="button"
                disabled={!drawPhase || !sideTop || s.noTake || remote.busy}
                onClick={() => act({ type: 'draw', from: 'discard' })}
                className={cn('flex flex-col items-center gap-1 rounded-xl p-2 disabled:cursor-default', drawPhase && sideTop && !s.noTake && 'ring-2 ring-primary/60')}
                aria-label="Yandan al"
              >
                {sideTop ? <TileFace tile={sideTop} okey={okey} size="sm" /> : <span className="h-11 w-8 rounded-md border border-dashed border-border" />}
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Yandan al</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {others.map((seat) => {
                const top = s.discards[seat]?.[s.discards[seat].length - 1]
                return (
                  <div key={seat} className="flex flex-col items-center gap-1">
                    <span className="max-w-20 truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{nameOf(seat)}</span>
                    {top ? <TileFace tile={top} okey={okey} size="sm" /> : <span className="h-11 w-8 rounded-md border border-dashed border-border" />}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Yerdeki perler {opened && liveSelected.length > 0 ? '· işlemek için bir pere dokun' : ''}
            </span>
            {s.melds.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Henüz el açan yok.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
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
                        'flex items-center gap-0.5 rounded-lg bg-background/30 p-1 disabled:cursor-default',
                        canAdd && 'ring-2 ring-primary hover:bg-background/50',
                        m.owner === mySeat && 'outline outline-1 outline-primary/40',
                      )}
                    >
                      {m.tiles.map((t) => (
                        <TileFace key={t.id} tile={t} okey={okey} size="sm" />
                      ))}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <p className="text-center text-sm font-semibold text-foreground" aria-live="polite">
            {s.note ||
              (myTurn
                ? s.phase === 'draw'
                  ? 'Sıra sende: desteden çek ya da yandan al.'
                  : s.taken != null
                    ? 'Yandan aldığın taşla elini açmalısın, yoksa geri ver (101 ceza).'
                    : opened
                      ? 'Per aç, işle, sonra bir taş at.'
                      : `El açmak için ${OPEN_MIN} sayı ya da ${PAIR_MIN} çift gerekir. Hazır değilsen bir taş at.`
                : `${nameOf(s.turn)} oynuyor`)}
          </p>
        </div>
      </div>

      {mySeat >= 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Istakan · {hand.length} taş</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortMode((m) => (m === 'seri' ? 'cift' : 'seri'))}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary"
              >
                {sortMode === 'seri' ? 'Çifte göre diz' : 'Seriye göre diz'}
              </button>
              {(liveSelected.length > 0 || liveStaged.length > 0) && (
                <button type="button" onClick={reset} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary">
                  <X className="size-3.5" aria-hidden="true" /> Temizle
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl bg-wood p-2">
            {hand.map((t) => {
              const inGroup = stagedIds.has(t.id)
              return (
                <span key={t.id} className={cn(inGroup && 'opacity-30')}>
                  <TileFace
                    tile={t}
                    okey={okey}
                    selected={liveSelected.includes(t.id)}
                    onClick={inGroup ? undefined : () => toggle(t.id)}
                  />
                </span>
              )
            })}
          </div>

          {liveStaged.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Hazırlanan perler · {stagedPairs > 0 ? `${stagedPairs} çift` : `${stagedValue} sayı`}
              </span>
              <div className="flex flex-wrap gap-2">
                {liveStaged.map((g, i) => (
                  <button
                    key={g.join('-')}
                    type="button"
                    onClick={() => setStaged((cur) => cur.filter((_, k) => k !== i))}
                    aria-label="Grubu ıstakaya geri al"
                    className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-1 hover:border-destructive"
                  >
                    {tilesOf(g).map((t) => (
                      <TileFace key={t.id} tile={t} okey={okey} size="sm" />
                    ))}
                    <span className="px-1 text-xs font-bold tabular-nums text-foreground">{stagedInfo[i]?.value ?? '?'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {localError && (
            <p role="alert" className="text-sm text-destructive">
              {localError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <ActionButton disabled={!playPhase || liveSelected.length < 2} onClick={makeGroup}>
              <Plus className="size-4" aria-hidden="true" /> Grup yap
            </ActionButton>
            {!opened ? (
              <>
                <ActionButton
                  primary
                  disabled={!playPhase || !allValid || stagedPairs > 0 || stagedValue < OPEN_MIN || remote.busy}
                  onClick={() => act({ type: 'open', mode: 'seri', groups: liveStaged })}
                >
                  Elini aç ({stagedValue}/{OPEN_MIN})
                </ActionButton>
                <ActionButton
                  primary
                  disabled={!playPhase || !allValid || stagedPairs !== liveStaged.length || stagedPairs < PAIR_MIN || remote.busy}
                  onClick={() => act({ type: 'open', mode: 'cift', groups: liveStaged })}
                >
                  Çifte git ({stagedPairs}/{PAIR_MIN})
                </ActionButton>
              </>
            ) : (
              <ActionButton primary disabled={!playPhase || !allValid || remote.busy} onClick={() => act({ type: 'lay', groups: liveStaged })}>
                Perleri yere aç
              </ActionButton>
            )}
            {s.taken != null && playPhase && (
              <ActionButton disabled={remote.busy} onClick={() => act({ type: 'giveBack' })}>
                <Undo2 className="size-4" aria-hidden="true" /> Taşı geri ver
              </ActionButton>
            )}
            <ActionButton
              danger
              disabled={!playPhase || liveSelected.length !== 1 || s.taken != null || remote.busy}
              onClick={() => act({ type: 'discard', tileId: liveSelected[0] })}
            >
              <ArrowDownToLine className="size-4" aria-hidden="true" /> Seçili taşı at
            </ActionButton>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Trophy className="size-4 text-primary" aria-hidden="true" /> Puan tablosu · {s.handNo}/{s.handsTotal}. el
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">El</th>
                  {Array.from({ length: n }, (_, i) => (
                    <th key={i} className="max-w-20 truncate py-1 pr-2 font-semibold">
                      {i === mySeat ? 'Sen' : nameOf(i)}
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
            <p className="mt-2 text-xs text-muted-foreground">
              Son el: {lastResult.finisher != null ? `${nameOf(lastResult.finisher)} bitirdi${lastResult.double ? ' (ceza ikiye katlandı)' : ''}` : 'deste bitti'}.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="mb-2 text-sm font-bold text-foreground">Masa akışı</h3>
          <ol className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-sm" aria-live="polite">
            {[...s.log].reverse().slice(0, 14).map((l, i) => (
              <li key={`${i}-${l.text}`} className="flex items-center gap-2 text-muted-foreground">
                <span className="font-semibold text-foreground">{l.seat === mySeat ? 'Sen' : nameOf(l.seat)}</span>
                <span>{l.text}</span>
                {l.tile && <TileFace tile={l.tile} okey={okey} size="sm" />}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
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
        'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide disabled:opacity-40',
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
