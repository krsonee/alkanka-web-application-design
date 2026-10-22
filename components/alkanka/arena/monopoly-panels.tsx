'use client'

import { useState } from 'react'
import { ArrowLeftRight, Bot, Gavel, Home, Hotel, KeyRound, Skull, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BOARD,
  canTradeDeed,
  GROUP_SQUARES,
  isBuyable,
  liquidity,
  netWorth,
  type Bundle,
  type Group,
  type MonopolyState,
} from '@/lib/games/monopoly'
import type { Remote } from './remote'

// Physical board colours of the classic edition; these are game material, not UI theme.
export const GROUP_COLOR: Record<Group, string> = {
  brown: 'oklch(0.42 0.08 50)',
  lightblue: 'oklch(0.8 0.09 220)',
  pink: 'oklch(0.6 0.2 345)',
  orange: 'oklch(0.7 0.17 55)',
  red: 'oklch(0.56 0.21 27)',
  yellow: 'oklch(0.87 0.16 95)',
  green: 'oklch(0.52 0.13 150)',
  darkblue: 'oklch(0.38 0.14 265)',
}
export const GROUP_LABEL: Record<Group, string> = {
  brown: 'Kahverengi',
  lightblue: 'Açık mavi',
  pink: 'Pembe',
  orange: 'Turuncu',
  red: 'Kırmızı',
  yellow: 'Sarı',
  green: 'Yeşil',
  darkblue: 'Lacivert',
}
export const TOKEN_COLOR = [
  'oklch(0.58 0.22 27)',
  'oklch(0.52 0.17 255)',
  'oklch(0.6 0.16 150)',
  'oklch(0.78 0.16 80)',
  'oklch(0.55 0.2 320)',
  'oklch(0.68 0.14 200)',
  'oklch(0.64 0.18 50)',
  'oklch(0.45 0.05 260)',
  'oklch(0.72 0.17 130)',
  'oklch(0.5 0.12 20)',
]
const NEUTRAL_DEED = 'oklch(0.55 0.02 160)'

type Send = Remote<MonopolyState>['send']
type NameOf = (seat: number) => string

export const deedColor = (i: number) => {
  const sq = BOARD[i]
  return sq.type === 'property' ? GROUP_COLOR[sq.group] : NEUTRAL_DEED
}
export const deedsOf = (s: MonopolyState, seat: number) => BOARD.map((_, i) => i).filter((i) => s.owner[i] === seat)
export const housesOf = (s: MonopolyState, seat: number) => deedsOf(s, seat).reduce((n, i) => n + s.houses[i], 0)
const fmt = (n: number) => `${n.toLocaleString('tr-TR')} ₺`

function Token({ seat, className }: { seat: number; className?: string }) {
  return (
    <span className={cn('relative inline-block shrink-0 overflow-hidden rounded-full border-2', className ?? 'size-6')} style={{ borderColor: TOKEN_COLOR[seat], background: TOKEN_COLOR[seat] }}>
      <img src={`/images/monopoly/pawn-${seat}.png`} alt="" className="size-full scale-[1.6] object-cover object-[50%_32%]" />
    </span>
  )
}

export function DeedChip({ s, i, selected, onClick, disabled }: { s: MonopolyState; i: number; selected?: boolean; onClick?: () => void; disabled?: boolean }) {
  const sq = BOARD[i]
  const content = (
    <>
      <span className="h-5 w-1.5 shrink-0 rounded-sm" style={{ background: deedColor(i) }} aria-hidden="true" />
      <span className={cn('min-w-0 flex-1 truncate', s.mortgaged[i] && 'line-through opacity-60')}>{sq.name}</span>
      {s.houses[i] > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 font-bold text-primary">
          {s.houses[i] === 5 ? <Hotel className="size-3" aria-label="Otel" /> : <><Home className="size-3" aria-hidden="true" />{s.houses[i]}</>}
        </span>
      )}
      {isBuyable(sq) && <span className="shrink-0 tabular-nums text-muted-foreground">{sq.price}</span>}
    </>
  )
  const base = 'flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold text-foreground'
  if (!onClick) return <span className={cn(base, 'border-border bg-secondary/40')}>{content}</span>
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, 'transition-colors disabled:opacity-40', selected ? 'border-primary bg-primary/15' : 'border-border bg-card hover:bg-secondary')}
    >
      {content}
    </button>
  )
}

/** Every player's portfolio, ranked by net worth, with a trade shortcut. */
export function PlayersPanel({ s, me, nameOf, canTrade, onTrade }: { s: MonopolyState; me: number; nameOf: NameOf; canTrade: boolean; onTrade: (seat: number) => void }) {
  const ranked = s.players.map((_, i) => i).sort((a, b) => Number(s.players[a].out) - Number(s.players[b].out) || netWorth(s, b) - netWorth(s, a))
  return (
    <ol className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
      {ranked.map((seat, rank) => {
        const p = s.players[seat]
        const deeds = deedsOf(s, seat)
        const groups = (Object.keys(GROUP_SQUARES) as Group[]).filter((g) => GROUP_SQUARES[g].every((i) => s.owner[i] === seat))
        return (
          <li key={seat} className={cn('flex flex-col gap-2 rounded-xl border border-border p-2.5', p.out && 'opacity-50')}>
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs font-black tabular-nums text-muted-foreground">{p.out ? '–' : rank + 1}</span>
              <Token seat={seat} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
                  {s.bots.includes(seat) && <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bot" />}
                  {nameOf(seat)}
                  {p.cards > 0 && <KeyRound className="size-3.5 shrink-0 text-primary" aria-label="Çıkış kartı" />}
                </p>
                <p className="truncate text-xs tabular-nums text-muted-foreground">
                  {p.out ? 'İflas etti' : `${fmt(p.money)} kasa · servet ${fmt(netWorth(s, seat))}`}
                </p>
              </div>
              {canTrade && seat !== me && !p.out && (
                <button
                  type="button"
                  onClick={() => onTrade(seat)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs font-bold text-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  <ArrowLeftRight className="size-3.5" aria-hidden="true" /> Takas
                </button>
              )}
            </div>
            {!p.out && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  {deeds.length} tapu · {housesOf(s, seat)} ev
                  {groups.length > 0 && <span className="font-semibold text-foreground"> · Tam renk: {groups.map((g) => GROUP_LABEL[g]).join(', ')}</span>}
                </p>
                {deeds.length > 0 && (
                  <div className="grid grid-cols-2 gap-1">
                    {deeds.map((i) => (
                      <DeedChip key={i} s={s} i={i} />
                    ))}
                  </div>
                )}
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** All 28 deeds by colour with their owners and "one away from a set" alerts. */
export function AllDeedsPanel({ s, me, nameOf }: { s: MonopolyState; me: number; nameOf: NameOf }) {
  const sets: { label: string; cells: number[]; color: string }[] = [
    ...(Object.keys(GROUP_SQUARES) as Group[]).map((g) => ({ label: GROUP_LABEL[g], cells: GROUP_SQUARES[g], color: GROUP_COLOR[g] })),
    { label: 'İstasyonlar', cells: BOARD.map((b, i) => (b.type === 'rail' ? i : -1)).filter((i) => i >= 0), color: NEUTRAL_DEED },
    { label: 'İdareler', cells: BOARD.map((b, i) => (b.type === 'utility' ? i : -1)).filter((i) => i >= 0), color: NEUTRAL_DEED },
  ]
  return (
    <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
      {sets.map((set) => {
        const owners = set.cells.map((i) => s.owner[i])
        const counts = new Map<number, number>()
        owners.forEach((o) => o != null && counts.set(o, (counts.get(o) ?? 0) + 1))
        const full = [...counts].find(([, n]) => n === set.cells.length)?.[0]
        const near = [...counts].find(([, n]) => n === set.cells.length - 1 && set.cells.length > 1)?.[0]
        return (
          <li key={set.label} className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderLeft: `6px solid ${set.color}` }}>
              <span className="flex-1 text-xs font-bold text-foreground">{set.label}</span>
              {full != null ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{nameOf(full)} tamamladı</span>
              ) : near != null ? (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', near === me ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive')}>
                  {near === me ? 'Tamamlamana 1 tapu kaldı' : `${nameOf(near)}: 1 tapu kaldı`}
                </span>
              ) : null}
            </div>
            <ul className="flex flex-col border-t border-border">
              {set.cells.map((i) => {
                const o = s.owner[i]
                return (
                  <li key={i} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                    <span className={cn('min-w-0 flex-1 truncate font-medium text-foreground', s.mortgaged[i] && 'line-through opacity-60')}>{BOARD[i].name}</span>
                    {s.houses[i] > 0 && (
                      <span className="flex items-center gap-0.5 font-bold text-primary">
                        {s.houses[i] === 5 ? <Hotel className="size-3" aria-label="Otel" /> : <><Home className="size-3" aria-hidden="true" />{s.houses[i]}</>}
                      </span>
                    )}
                    {o != null ? (
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <Token seat={o} className="size-4" />
                        <span className="max-w-24 truncate">{nameOf(o)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Bankada</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

const emptyBundle = (): Bundle => ({ props: [], money: 0, cards: 0 })

function BundleEditor({ s, seat, value, onChange, title }: { s: MonopolyState; seat: number; value: Bundle; onChange: (b: Bundle) => void; title: string }) {
  const p = s.players[seat]
  const deeds = deedsOf(s, seat)
  const toggle = (i: number) => onChange({ ...value, props: value.props.includes(i) ? value.props.filter((x) => x !== i) : [...value.props, i] })
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2">
      <legend className="px-1 text-xs font-bold text-foreground">{title}</legend>
      {deeds.length === 0 ? (
        <p className="text-xs text-muted-foreground">Tapu yok</p>
      ) : (
        <div className="grid max-h-44 gap-1 overflow-y-auto">
          {deeds.map((i) => (
            <DeedChip key={i} s={s} i={i} selected={value.props.includes(i)} disabled={!canTradeDeed(s, seat, i)} onClick={() => toggle(i)} />
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Para
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={p.money}
          step={10}
          value={value.money || ''}
          placeholder="0"
          onChange={(e) => onChange({ ...value, money: Math.max(0, Math.min(p.money, Math.floor(Number(e.target.value) || 0))) })}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-bold tabular-nums text-foreground"
        />
        <span className="shrink-0 tabular-nums">/ {fmt(p.money)}</span>
      </label>
      {p.cards > 0 && (
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={value.cards > 0} onChange={(e) => onChange({ ...value, cards: e.target.checked ? 1 : 0 })} className="size-4 accent-primary" />
          Hapisten çıkış kartı
        </label>
      )}
    </fieldset>
  )
}

/** Builds a trade offer (or a counter-offer) between me and one other player. */
export function TradeComposer({
  s,
  me,
  initialTarget,
  counter,
  nameOf,
  busy,
  send,
  onClose,
}: {
  s: MonopolyState
  me: number
  initialTarget: number | null
  counter?: { give: Bundle; take: Bundle; to: number }
  nameOf: NameOf
  busy: boolean
  send: Send
  onClose: () => void
}) {
  const others = s.players.map((p, i) => (i !== me && !p.out ? i : -1)).filter((i) => i >= 0)
  const [target, setTarget] = useState<number>(counter?.to ?? initialTarget ?? others[0] ?? -1)
  const [give, setGive] = useState<Bundle>(counter?.give ?? emptyBundle())
  const [take, setTake] = useState<Bundle>(counter?.take ?? emptyBundle())
  const has = (b: Bundle) => b.props.length > 0 || b.money > 0 || b.cards > 0
  const valid = target >= 0 && has(give) && has(take)

  const submit = async () => {
    const ok = await send(counter ? { type: 'counterTrade', give, take } : { type: 'propose', to: target, give, take })
    if (ok) onClose()
  }

  if (target < 0) return <p className="text-sm text-muted-foreground">Takas yapılacak oyuncu yok.</p>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <ArrowLeftRight className="size-4 text-primary" aria-hidden="true" /> {counter ? 'Karşı teklif' : 'Takas teklifi'}
        </h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary" aria-label="Kapat">
          <X className="size-4" />
        </button>
      </div>
      {!counter && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Takas yapılacak oyuncu">
          {others.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={target === i}
              onClick={() => {
                setTarget(i)
                setTake(emptyBundle())
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-bold',
                target === i ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <Token seat={i} className="size-5" />
              {nameOf(i)}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <BundleEditor s={s} seat={me} value={give} onChange={setGive} title="Senin verdiğin" />
        <BundleEditor s={s} seat={target} value={take} onChange={setTake} title={`${nameOf(target)} verecek`} />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Üzerinde ev olan renk grubundaki tapular takas edilemez. İpotekli tapu ipotekli olarak geçer. Botlar adil olmayan teklifi reddeder ve ne kadar daha istediğini söyler.
      </p>
      <button
        type="button"
        disabled={!valid || busy}
        onClick={submit}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
      >
        {counter ? 'Karşı teklifi gönder' : 'Teklifi gönder'}
      </button>
    </div>
  )
}

/** A pending trade, as seen by the receiver (with answer buttons) or by everyone else. */
export function TradeOfferCard({ s, me, nameOf, busy, send, onCounter }: { s: MonopolyState; me: number; nameOf: NameOf; busy: boolean; send: Send; onCounter: () => void }) {
  const t = s.trade!
  const mine = t.to === me
  const Side = ({ seat, b }: { seat: number; b: Bundle }) => (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border p-2">
      <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <Token seat={seat} className="size-5" /> {nameOf(seat)} verir
      </p>
      {b.props.map((i) => (
        <DeedChip key={i} s={s} i={i} />
      ))}
      {b.money > 0 && <p className="text-sm font-black tabular-nums text-foreground">{fmt(b.money)}</p>}
      {b.cards > 0 && <p className="text-xs font-semibold text-foreground">Hapisten çıkış kartı</p>}
    </div>
  )
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
        <ArrowLeftRight className="size-4 text-primary" aria-hidden="true" />
        {mine ? `${nameOf(t.from)} sana ${t.counter ? 'karşı teklif' : 'takas teklif'} etti` : `${nameOf(t.from)} → ${nameOf(t.to)} takas teklifi`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Side seat={t.from} b={t.give} />
        <Side seat={t.to} b={t.take} />
      </div>
      {mine ? (
        <div className={cn('grid gap-2', t.counter ? 'grid-cols-2' : 'grid-cols-3')}>
          <button type="button" disabled={busy} onClick={() => send({ type: 'acceptTrade' })} className="min-h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40">
            Kabul et
          </button>
          {!t.counter && (
            <button type="button" disabled={busy} onClick={onCounter} className="min-h-11 rounded-xl border border-border bg-secondary text-sm font-bold text-foreground disabled:opacity-40">
              Karşı teklif
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => send({ type: 'rejectTrade' })} className="min-h-11 rounded-xl border border-border bg-secondary text-sm font-bold text-foreground disabled:opacity-40">
            Reddet
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-secondary px-3 py-2 text-center text-xs font-semibold text-muted-foreground">{nameOf(t.to)} yanıt veriyor…</p>
      )}
    </div>
  )
}

export function AuctionPanel({ s, me, nameOf, busy, send }: { s: MonopolyState; me: number; nameOf: NameOf; busy: boolean; send: Send }) {
  const a = s.auction!
  const sq = BOARD[a.pos]
  const actor = a.active[a.idx]
  const myMoney = me >= 0 ? s.players[me].money : 0
  const mine = actor === me
  const steps = [10, 50, 100]
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground" style={{ background: deedColor(a.pos) }}>
          <Gavel className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mezat</p>
          <p className="truncate font-bold text-foreground">
            {sq.name} {isBuyable(sq) && <span className="text-xs font-semibold text-muted-foreground">· değeri {sq.price} ₺</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-black tabular-nums text-foreground">{fmt(a.bid)}</p>
          <p className="truncate text-xs text-muted-foreground">{a.leader != null ? `Önde: ${nameOf(a.leader)}` : 'Teklif yok'}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {a.active.map((i) => (
          <span key={i} className={cn('flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-[11px] font-semibold', i === actor ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground')}>
            <Token seat={i} className="size-4" />
            {nameOf(i)}
          </span>
        ))}
      </div>
      {mine ? (
        <div className="grid grid-cols-4 gap-1.5">
          {steps.map((d) => {
            const amount = a.bid + d
            return (
              <button
                key={d}
                type="button"
                disabled={busy || amount > myMoney}
                onClick={() => send({ type: 'bid', amount })}
                className="flex min-h-11 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              >
                <span className="text-sm font-black tabular-nums">{amount}</span>
                <span className="text-[10px] font-semibold opacity-80">+{d}</span>
              </button>
            )
          })}
          <button type="button" disabled={busy} onClick={() => send({ type: 'fold' })} className="min-h-11 rounded-xl border border-border bg-secondary text-sm font-bold text-foreground disabled:opacity-40">
            Çekil
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-secondary px-3 py-2 text-center text-xs font-semibold text-muted-foreground">{actor != null ? `${nameOf(actor)} teklif düşünüyor…` : 'Mezat kapanıyor…'}</p>
      )}
    </div>
  )
}

export function DebtPanel({ s, me, busy, send, nameOf }: { s: MonopolyState; me: number; busy: boolean; send: Send; nameOf: NameOf }) {
  const d = s.debt!
  const p = s.players[me]
  const [confirm, setConfirm] = useState(false)
  const short = Math.max(0, d.amount - p.money)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
        <p className="text-sm font-bold text-foreground">
          {d.to != null ? `${nameOf(d.to)} oyuncusuna` : 'Bankaya'} {fmt(d.amount)} borcun var
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Kasanda {fmt(p.money)} var{short > 0 ? `, ${fmt(short)} eksik` : ''}. Mülklerim sekmesinden ev sat, ipotek et ya da takas teklif et. Hepsini satsan en fazla {fmt(liquidity(s, me))} toplayabilirsin.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy || short > 0} onClick={() => send({ type: 'payDebt' })} className="min-h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40">
          Borcu öde
        </button>
        {confirm ? (
          <button type="button" disabled={busy} onClick={() => send({ type: 'bankrupt' })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-destructive text-sm font-bold text-primary-foreground disabled:opacity-40">
            <Skull className="size-4" aria-hidden="true" /> Eminim, iflas
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => setConfirm(true)} className="min-h-11 rounded-xl border border-border bg-secondary text-sm font-bold text-foreground disabled:opacity-40">
            İflas et
          </button>
        )}
      </div>
      <button type="button" disabled={busy} onClick={() => send({ type: 'autoDebt' })} className="text-xs font-semibold text-muted-foreground underline underline-offset-2">
        Benim yerime otomatik sat
      </button>
    </div>
  )
}

/** Shown once only one player is left (or rounds ran out): final standings by net worth. */
export function FinalStandings({ s, nameOf }: { s: MonopolyState; nameOf: NameOf }) {
  const ranked = s.players.map((_, i) => i).sort((a, b) => Number(s.players[a].out) - Number(s.players[b].out) || netWorth(s, b) - netWorth(s, a))
  return (
    <ol className="flex flex-col gap-1.5">
      {ranked.map((seat, k) => (
        <li key={seat} className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-2', k === 0 ? 'border-primary bg-primary/10' : 'border-border')}>
          {k === 0 ? <Trophy className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <span className="w-4 text-center text-xs font-black text-muted-foreground">{k + 1}</span>}
          <Token seat={seat} className="size-6" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{nameOf(seat)}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{s.players[seat].out ? 'İflas' : fmt(netWorth(s, seat))}</span>
        </li>
      ))}
    </ol>
  )
}
