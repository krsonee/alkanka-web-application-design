'use client'

import { useMemo, useState } from 'react'
import { Bot, Dice5, Eye, Gavel, Home, Hotel, KeyRound, Lock, Train, Zap, Droplets, HelpCircle, Package, Car, Landmark } from 'lucide-react'
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
  type Group,
  type MonopolyState,
} from '@/lib/games/monopoly'
import type { Remote } from './remote'

// Physical board colours of the classic edition; these are game material, not UI theme.
const GROUP_COLOR: Record<Group, string> = {
  brown: 'oklch(0.42 0.08 50)',
  lightblue: 'oklch(0.82 0.08 220)',
  pink: 'oklch(0.62 0.2 345)',
  orange: 'oklch(0.72 0.17 55)',
  red: 'oklch(0.58 0.22 27)',
  yellow: 'oklch(0.88 0.17 95)',
  green: 'oklch(0.55 0.14 150)',
  darkblue: 'oklch(0.4 0.14 265)',
}
const TOKEN_COLOR = ['oklch(0.58 0.22 27)', 'oklch(0.5 0.17 255)', 'oklch(0.6 0.16 150)', 'oklch(0.78 0.16 80)']
const BOARD_BG = 'oklch(0.93 0.04 150)'
const INK = 'oklch(0.2 0.02 160)'

function cellPos(i: number): { row: number; col: number; side: 'bottom' | 'left' | 'top' | 'right' | 'corner' } {
  if (i === 0) return { row: 11, col: 11, side: 'corner' }
  if (i < 10) return { row: 11, col: 11 - i, side: 'bottom' }
  if (i === 10) return { row: 11, col: 1, side: 'corner' }
  if (i < 20) return { row: 11 - (i - 10), col: 1, side: 'left' }
  if (i === 20) return { row: 1, col: 1, side: 'corner' }
  if (i < 30) return { row: 1, col: 1 + (i - 20), side: 'top' }
  if (i === 30) return { row: 1, col: 11, side: 'corner' }
  return { row: 1 + (i - 30), col: 11, side: 'right' }
}

function SquareIcon({ i }: { i: number }) {
  const sq = BOARD[i]
  const cls = 'size-4 sm:size-5'
  if (sq.type === 'rail') return <Train className={cls} aria-hidden="true" />
  if (sq.type === 'utility') return sq.name.includes('Su') ? <Droplets className={cls} aria-hidden="true" /> : <Zap className={cls} aria-hidden="true" />
  if (sq.type === 'chance') return <HelpCircle className={cls} aria-hidden="true" />
  if (sq.type === 'chest') return <Package className={cls} aria-hidden="true" />
  if (sq.type === 'tax') return <Landmark className={cls} aria-hidden="true" />
  if (sq.type === 'parking') return <Car className="size-6 sm:size-8" aria-hidden="true" />
  if (sq.type === 'gotojail') return <Gavel className="size-6 sm:size-8" aria-hidden="true" />
  if (sq.type === 'jail') return <Lock className="size-6 sm:size-8" aria-hidden="true" />
  return null
}

const DIE_DOTS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
function Die({ value }: { value: number }) {
  return (
    <div className="grid size-11 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg border-2 p-1.5 shadow-md" style={{ background: 'oklch(0.98 0 0)', borderColor: INK }} aria-label={`Zar ${value}`}>
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} className={cn('rounded-full', DIE_DOTS[value]?.includes(k) ? 'opacity-100' : 'opacity-0')} style={{ background: INK }} />
      ))}
    </div>
  )
}

export function MonopolyPvp({ remote }: { remote: Remote<MonopolyState> }) {
  const s = remote.state
  const me = remote.spectator ? -1 : remote.seat
  const myTurn = remote.myTurn
  const [focus, setFocus] = useState<number | null>(null)
  const nameOf = (seat: number) => (seat === me ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const fill = (t: string) => t.replace(/@(\d)/g, (_, d) => nameOf(Number(d)))
  const tokensAt = useMemo(() => {
    const m = new Map<number, number[]>()
    s.players.forEach((p, i) => {
      if (p.out) return
      m.set(p.pos, [...(m.get(p.pos) ?? []), i])
    })
    return m
  }, [s.players])

  const myPlayer = me >= 0 ? s.players[me] : null
  const here = myPlayer ? BOARD[myPlayer.pos] : null
  const myProps = me >= 0 ? BOARD.map((_, i) => i).filter((i) => s.owner[i] === me) : []
  const focusSq = focus != null ? BOARD[focus] : null

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {remote.spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {s.players.map((p, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card px-3 py-2',
              s.turn === i && !p.out ? 'border-primary ring-2 ring-primary/30' : 'border-border',
              p.out && 'opacity-50',
            )}
          >
            <span className="size-4 shrink-0 rounded-full border-2 border-card shadow" style={{ background: TOKEN_COLOR[i] }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
                {s.bots.includes(i) && <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bot" />}
                <span className="truncate">{nameOf(i)}</span>
                {p.inJail && <Lock className="size-3.5 shrink-0 text-destructive" aria-label="Hapiste" />}
                {p.cards > 0 && <KeyRound className="size-3.5 shrink-0 text-primary" aria-label="Hapisten çıkış kartı" />}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">{p.out ? 'İflas etti' : `${p.money.toLocaleString('tr-TR')} ₺ · servet ${netWorth(s, i).toLocaleString('tr-TR')} ₺`}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-wood p-2 shadow-xl sm:p-3">
        <div
          className="relative mx-auto grid aspect-square w-full min-w-[640px] max-w-[880px] grid-cols-[1.6fr_repeat(9,1fr)_1.6fr] grid-rows-[1.6fr_repeat(9,1fr)_1.6fr] gap-px border-2"
          style={{ background: INK, borderColor: INK }}
        >
          {BOARD.map((sq, i) => {
            const { row, col, side } = cellPos(i)
            const owner = s.owner[i]
            const houses = s.houses[i]
            const tokens = tokensAt.get(i) ?? []
            const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : null
            const barSide = side === 'bottom' ? 'top' : side === 'top' ? 'bottom' : side === 'left' ? 'right' : 'left'
            return (
              <button
                key={i}
                type="button"
                onClick={() => setFocus(i)}
                style={{ gridRow: row, gridColumn: col, background: BOARD_BG, color: INK }}
                aria-label={`${sq.name}${owner != null ? `, sahibi ${nameOf(owner)}` : ''}`}
                className={cn('relative flex overflow-hidden text-center', focus === i && 'z-10 outline outline-2 outline-primary')}
              >
                {color && (
                  <span
                    className={cn('absolute flex items-center justify-center gap-px', barSide === 'top' || barSide === 'bottom' ? 'inset-x-0 h-[22%]' : 'inset-y-0 w-[22%] flex-col')}
                    style={{ background: color, [barSide]: 0 }}
                  >
                    {houses > 0 &&
                      (houses === 5 ? (
                        <Hotel className="size-3 text-[oklch(0.98_0_0)] drop-shadow" aria-label="Otel" />
                      ) : (
                        Array.from({ length: houses }, (_, k) => <Home key={k} className="size-2.5 text-[oklch(0.98_0_0)] drop-shadow" aria-hidden="true" />)
                      ))}
                  </span>
                )}
                <span
                  className={cn(
                    'flex size-full flex-col items-center justify-center gap-0.5 p-1 text-[8px] font-bold uppercase leading-tight sm:text-[9px]',
                    color && barSide === 'top' && 'pt-[26%]',
                    color && barSide === 'bottom' && 'pb-[26%]',
                    color && barSide === 'left' && 'pl-[26%]',
                    color && barSide === 'right' && 'pr-[26%]',
                    side === 'corner' && 'text-[10px] sm:text-xs',
                  )}
                >
                  <SquareIcon i={i} />
                  <span className="line-clamp-2 text-balance">{sq.name}</span>
                  {isBuyable(sq) && <span className="font-semibold normal-case opacity-80">{sq.price} ₺</span>}
                  {sq.type === 'tax' && <span className="font-semibold normal-case opacity-80">{sq.amount} ₺ öde</span>}
                  {i === 0 && <span className="font-semibold normal-case opacity-80">200 ₺ al</span>}
                </span>
                {owner != null && (
                  <span
                    className={cn('absolute right-0.5 top-0.5 size-2.5 rounded-full border border-[oklch(0.98_0_0)]', s.mortgaged[i] && 'opacity-40')}
                    style={{ background: TOKEN_COLOR[owner] }}
                    aria-hidden="true"
                  />
                )}
                {tokens.length > 0 && (
                  <span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
                    {tokens.map((t) => (
                      <span
                        key={t}
                        className={cn('size-3 rounded-full border-2 border-[oklch(0.98_0_0)] shadow sm:size-3.5', s.turn === t && 'animate-bounce')}
                        style={{ background: TOKEN_COLOR[t] }}
                        aria-label={nameOf(t)}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}

          <div className="flex flex-col items-center justify-center gap-3 p-4" style={{ gridRow: '2 / 11', gridColumn: '2 / 11', background: BOARD_BG, color: INK }}>
            <div className="-rotate-12 rounded-md border-4 px-6 py-2 shadow-lg" style={{ background: GROUP_COLOR.red, borderColor: 'oklch(0.98 0 0)' }}>
              <span className="font-display text-3xl font-black uppercase tracking-wider text-[oklch(0.98_0_0)] sm:text-4xl">Monopoly</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide opacity-70">
              Tur {Math.min(s.round, s.maxRounds)}/{s.maxRounds}
            </span>
            {s.dice && (
              <div className="flex gap-2">
                <Die value={s.dice[0]} />
                <Die value={s.dice[1]} />
              </div>
            )}
            {s.card && (
              <div
                className="w-full max-w-xs rounded-lg border-2 p-3 text-center text-xs font-semibold shadow-md"
                style={{ background: s.card.deck === 'chance' ? GROUP_COLOR.orange : GROUP_COLOR.lightblue, borderColor: INK }}
              >
                <p className="mb-1 font-black uppercase tracking-wider">{s.card.deck === 'chance' ? 'Şans' : 'Kamu Fonu'}</p>
                <p className="text-pretty">{s.card.text}</p>
              </div>
            )}
            <p className="max-w-sm text-pretty text-center text-sm font-semibold" aria-live="polite">
              {s.note ? fill(s.note) : myTurn ? 'Sıra sende.' : `${nameOf(s.turn)} oynuyor`}
            </p>

            {myTurn && myPlayer && (
              <div className="flex flex-wrap justify-center gap-2">
                {s.phase === 'roll' && (
                  <>
                    <BoardButton primary disabled={remote.busy} onClick={() => remote.send({ type: 'roll' })}>
                      <Dice5 className="size-4" aria-hidden="true" /> {myPlayer.inJail ? 'Çift için zar at' : 'Zar at'}
                    </BoardButton>
                    {myPlayer.inJail && (
                      <BoardButton disabled={remote.busy || myPlayer.money < JAIL_FINE} onClick={() => remote.send({ type: 'payJail' })}>
                        {JAIL_FINE} ₺ öde, çık
                      </BoardButton>
                    )}
                    {myPlayer.inJail && myPlayer.cards > 0 && (
                      <BoardButton disabled={remote.busy} onClick={() => remote.send({ type: 'useCard' })}>
                        <KeyRound className="size-4" aria-hidden="true" /> Kartı kullan
                      </BoardButton>
                    )}
                  </>
                )}
                {s.phase === 'buy' && here && isBuyable(here) && (
                  <>
                    <BoardButton primary disabled={remote.busy || myPlayer.money < here.price} onClick={() => remote.send({ type: 'buy' })}>
                      {here.name} · {here.price} ₺ satın al
                    </BoardButton>
                    <BoardButton disabled={remote.busy} onClick={() => remote.send({ type: 'pass' })}>
                      Alma
                    </BoardButton>
                  </>
                )}
                {s.phase === 'end' && (
                  <BoardButton primary disabled={remote.busy} onClick={() => remote.send({ type: 'end' })}>
                    Turu bitir
                  </BoardButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="mb-2 text-sm font-bold text-foreground">Tapu kartı</h3>
          {focusSq && focus != null ? (
            <DeedCard i={focus} s={s} ownerName={s.owner[focus] != null ? nameOf(s.owner[focus]!) : null} />
          ) : (
            <p className="text-sm text-muted-foreground">Ayrıntılarını görmek için tahtada bir kareye dokun.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="mb-2 text-sm font-bold text-foreground">Mülklerim {myProps.length > 0 && `· ${myProps.length}`}</h3>
          {me < 0 ? (
            <p className="text-sm text-muted-foreground">İzleyici modundasın.</p>
          ) : myProps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz tapun yok. Sahipsiz bir kareye gelince satın alabilirsin.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {myProps.map((i) => {
                const sq = BOARD[i]
                const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : 'oklch(0.6 0 0)'
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs">
                    <span className="h-4 w-1.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />
                    <span className={cn('min-w-0 flex-1 truncate font-semibold text-foreground', s.mortgaged[i] && 'line-through opacity-60')}>
                      {sq.name}
                      {s.houses[i] > 0 && ` · ${s.houses[i] === 5 ? 'otel' : `${s.houses[i]} ev`}`}
                    </span>
                    {myTurn && (
                      <span className="flex gap-1">
                        {canBuild(s, me, i) && (
                          <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'build', pos: i })}>
                            {s.houses[i] === 4 ? 'Otel' : 'Ev'} +
                          </MiniButton>
                        )}
                        {canSell(s, me, i) && (
                          <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'sell', pos: i })}>
                            Sat
                          </MiniButton>
                        )}
                        {canMortgage(s, me, i) && (
                          <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'mortgage', pos: i })}>
                            İpotek
                          </MiniButton>
                        )}
                        {s.mortgaged[i] && (
                          <MiniButton disabled={remote.busy || (myPlayer?.money ?? 0) < unmortgageCost(i)} onClick={() => remote.send({ type: 'unmortgage', pos: i })}>
                            Kaldır {unmortgageCost(i)} ₺
                          </MiniButton>
                        )}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="mb-2 text-sm font-bold text-foreground">Oyun akışı</h3>
          <ol className="flex max-h-72 flex-col gap-1.5 overflow-y-auto text-xs leading-relaxed text-muted-foreground" aria-live="polite">
            {[...s.log].reverse().slice(0, 30).map((l, k) => (
              <li key={`${k}-${l}`}>{fill(l)}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function DeedCard({ i, s, ownerName }: { i: number; s: MonopolyState; ownerName: string | null }) {
  const sq = BOARD[i]
  if (!isBuyable(sq)) {
    return (
      <div className="rounded-lg border border-border p-3 text-sm">
        <p className="font-bold text-foreground">{sq.name}</p>
        <p className="text-muted-foreground">
          {sq.type === 'tax' ? `Buraya gelen ${sq.amount} ₺ vergi öder.` : sq.type === 'chance' || sq.type === 'chest' ? 'Buraya gelen bir kart çeker.' : sq.type === 'gotojail' ? 'Buraya gelen doğrudan hapse girer.' : sq.type === 'jail' ? 'Hapis ya da sadece ziyaret.' : sq.type === 'go' ? "Başla'dan her geçişte 200 ₺ maaş alınır." : 'Burada bir şey olmaz, dinlen.'}
        </p>
      </div>
    )
  }
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : 'oklch(0.6 0 0)'
  return (
    <div className="overflow-hidden rounded-lg border-2 text-xs" style={{ borderColor: INK, background: 'oklch(0.98 0 0)', color: INK }}>
      <div className="p-2 text-center" style={{ background: color, color: sq.type === 'property' && ['lightblue', 'yellow'].includes(sq.group) ? INK : 'oklch(0.98 0 0)' }}>
        <p className="text-[10px] font-semibold uppercase">Tapu senedi</p>
        <p className="text-sm font-black uppercase">{sq.name}</p>
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        {sq.type === 'property' ? (
          <>
            {['Kira', '1 evli', '2 evli', '3 evli', '4 evli', 'Otelli'].map((label, k) => (
              <p key={label} className={cn('flex justify-between', s.houses[i] === k && s.owner[i] != null && 'font-black')}>
                <span>{label}</span>
                <span className="tabular-nums">{sq.rent[k]} ₺</span>
              </p>
            ))}
            <p className="mt-1 text-[10px] opacity-75">Grubun tamamı sende ise boş arsa kirası iki katıdır. Ev / otel: {sq.house} ₺</p>
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
        <p className="mt-1 flex justify-between border-t pt-1" style={{ borderColor: INK }}>
          <span>Fiyat {sq.price} ₺ · ipotek {sq.price / 2} ₺</span>
        </p>
        <p className="font-bold">{ownerName ? `Sahibi: ${ownerName}${s.mortgaged[i] ? ' (ipotekli)' : ''}` : 'Sahipsiz'}</p>
      </div>
    </div>
  )
}

function BoardButton({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide shadow-md disabled:opacity-40',
        primary ? 'bg-primary text-primary-foreground' : 'border-2 bg-card text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function MiniButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-md border border-border px-2 py-1 font-bold text-foreground hover:bg-secondary disabled:opacity-40">
      {children}
    </button>
  )
}
