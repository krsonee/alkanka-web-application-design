'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Ban,
  Building2,
  Dice5,
  Gavel,
  HandCoins,
  HelpCircle,
  Home,
  KeyRound,
  Landmark,
  Lock,
  LockOpen,
  Package,
  Skull,
  Stamp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type EventKind =
  | 'rent'
  | 'tax'
  | 'go'
  | 'buy'
  | 'pass'
  | 'chance'
  | 'chest'
  | 'jail'
  | 'free'
  | 'bankrupt'
  | 'build'
  | 'sell'
  | 'mortgage'
  | 'unmortgage'
  | 'roll'
  | 'stuck'
  | 'info'

export type GameEvent = {
  id: number
  raw: string
  kind: EventKind
  actor: number | null
  target: number | null
  amount: number | null
  title: string
  detail: string
}

type Meta = { icon: LucideIcon; tone: 'gain' | 'loss' | 'warn' | 'neutral' | 'chance' | 'chest'; priority: number }

export const EVENT_META: Record<EventKind, Meta> = {
  bankrupt: { icon: Skull, tone: 'loss', priority: 10 },
  rent: { icon: HandCoins, tone: 'loss', priority: 9 },
  jail: { icon: Gavel, tone: 'warn', priority: 8 },
  tax: { icon: Landmark, tone: 'loss', priority: 7 },
  chance: { icon: HelpCircle, tone: 'chance', priority: 6 },
  chest: { icon: Package, tone: 'chest', priority: 6 },
  buy: { icon: Stamp, tone: 'neutral', priority: 5 },
  go: { icon: ArrowLeft, tone: 'gain', priority: 4 },
  free: { icon: LockOpen, tone: 'gain', priority: 4 },
  build: { icon: Home, tone: 'neutral', priority: 3 },
  stuck: { icon: Lock, tone: 'warn', priority: 3 },
  pass: { icon: Ban, tone: 'neutral', priority: 2 },
  sell: { icon: Building2, tone: 'neutral', priority: 2 },
  mortgage: { icon: KeyRound, tone: 'neutral', priority: 2 },
  unmortgage: { icon: KeyRound, tone: 'neutral', priority: 2 },
  roll: { icon: Dice5, tone: 'neutral', priority: 1 },
  info: { icon: Dice5, tone: 'neutral', priority: 0 },
}

const num = (v: string | undefined) => (v ? Number(v) : null)

function cardAmount(text: string) {
  const pay = text.match(/(\d+) ₺ öde\.$/)
  if (pay) return -Number(pay[1])
  const gain = text.match(/: (\d+) ₺ al\.$/) ?? text.match(/(\d+) ₺ (?:kazandın|temettü)/)
  return gain ? Number(gain[1]) : null
}

export function parseEvent(raw: string, id: number): GameEvent {
  const base = { id, raw, actor: num(raw.match(/^@(\d)/)?.[1]), target: null, amount: null, detail: '' }
  let m: RegExpMatchArray | null

  if ((m = raw.match(/^@(\d), (.+) için @(\d) oyuncusuna (\d+) ₺ kira ödedi/)))
    return { ...base, kind: 'rent', target: Number(m[3]), amount: -Number(m[4]), title: 'Kira ödendi', detail: m[2] }
  if ((m = raw.match(/^@\d (.+) ödedi: (\d+) ₺/))) return { ...base, kind: 'tax', amount: -Number(m[2]), title: 'Vergi ödendi', detail: m[1] }
  if (/Başla'dan geçti/.test(raw)) return { ...base, kind: 'go', amount: 200, title: 'Maaş alındı', detail: "Başla'dan geçti" }
  if ((m = raw.match(/^@\d (.+) tapusunu (\d+) ₺'ye aldı/))) return { ...base, kind: 'buy', amount: -Number(m[2]), title: 'Tapu alındı', detail: m[1] }
  if ((m = raw.match(/^@\d (.+) tapusunu almadı/))) return { ...base, kind: 'pass', title: 'Tapu alınmadı', detail: m[1] }
  if ((m = raw.match(/^@\d (Şans|Kamu Fonu) kartı çekti: (.+)$/))) {
    const chance = m[1] === 'Şans'
    return { ...base, kind: chance ? 'chance' : 'chest', amount: cardAmount(m[2]), title: chance ? 'Şans kartı' : 'Kamu fonu kartı', detail: m[2] }
  }
  if (/hapse girdi/.test(raw)) return { ...base, kind: 'jail', title: 'Hapse girdi', detail: 'Kodese tıkıldı' }
  if ((m = raw.match(/(\d+) ₺ ödeyip/))) return { ...base, kind: 'free', amount: -Number(m[1]), title: 'Hapisten çıktı', detail: 'Ceza ödendi' }
  if (/hapisten çıktı|kartını kullandı/.test(raw)) return { ...base, kind: 'free', title: 'Hapisten çıktı', detail: /kart/.test(raw) ? 'Çıkış kartı kullanıldı' : 'Çift attı' }
  if (/çıkamadı/.test(raw)) return { ...base, kind: 'stuck', title: 'Hapiste kaldı', detail: 'Çift gelmedi' }
  if (/üst üste 3 çift/.test(raw)) return { ...base, kind: 'jail', title: '3 kez çift', detail: 'Doğrudan hapse' }
  if (/iflas etti/.test(raw)) return { ...base, kind: 'bankrupt', title: 'İflas etti', detail: 'Mülkler bankaya döndü' }
  if ((m = raw.match(/^@\d (.+) üzerine (otel|ev) dikti/))) return { ...base, kind: 'build', title: m[2] === 'otel' ? 'Otel dikildi' : 'Ev dikildi', detail: m[1] }
  if ((m = raw.match(/^@\d (.+) üzerindeki bir yapıyı sattı/))) return { ...base, kind: 'sell', title: 'Yapı satıldı', detail: m[1] }
  if ((m = raw.match(/^@\d (.+) tapusunu ipotek etti/))) return { ...base, kind: 'mortgage', title: 'İpotek edildi', detail: m[1] }
  if ((m = raw.match(/^@\d (.+) ipoteğini kaldırdı/))) return { ...base, kind: 'unmortgage', title: 'İpotek kalktı', detail: m[1] }
  if ((m = raw.match(/(\d)-(\d) attı/))) return { ...base, kind: 'roll', title: 'Zar atıldı', detail: `${m[1]} + ${m[2]} = ${Number(m[1]) + Number(m[2])}` }
  return { ...base, kind: 'info', title: 'Bilgi', detail: raw }
}

/** Entries appended since `prev`, given the engine keeps a sliding window of the latest log lines. */
function appended(prev: string[], next: string[]) {
  for (let k = Math.min(prev.length, next.length); k > 0; k--) {
    let match = true
    for (let j = 0; j < k; j++) {
      if (prev[prev.length - k + j] !== next[j]) {
        match = false
        break
      }
    }
    if (match) return next.slice(k)
  }
  return next
}

/**
 * Turns the engine log into parsed events. New lines are held back while pawns are
 * still walking so the result appears exactly when the pawn reaches its square.
 */
export function useEventFeed(log: string[], walking: boolean) {
  const idRef = useRef(0)
  const prevRef = useRef(log)
  const pendingRef = useRef<GameEvent[]>([])
  const [feed, setFeed] = useState<GameEvent[]>(() => log.map((l) => parseEvent(l, idRef.current++)).reverse())
  const [batch, setBatch] = useState<GameEvent[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const key = log.join('\u0001')

  useEffect(() => {
    const next = key ? key.split('\u0001') : []
    const added = appended(prevRef.current, next)
    prevRef.current = next
    if (!added.length) return
    pendingRef.current = [...pendingRef.current, ...added.map((l) => parseEvent(l, idRef.current++))]
    setPendingCount(pendingRef.current.length)
  }, [key])

  useEffect(() => {
    if (walking || pendingCount === 0) return
    const fresh = pendingRef.current
    pendingRef.current = []
    setPendingCount(0)
    setFeed((f) => [...[...fresh].reverse(), ...f].slice(0, 40))
    setBatch(fresh)
  }, [walking, pendingCount])

  return { feed, batch }
}

/** Remembers each player's last settled balance and reports the change once pawns stop. */
export function useMoneyDeltas(money: number[], walking: boolean) {
  const settledRef = useRef(money)
  const [settled, setSettled] = useState(money)
  const [deltas, setDeltas] = useState<{ id: number; values: number[] } | null>(null)
  const key = money.join(',')

  useEffect(() => {
    if (walking) return
    const now = key.split(',').map(Number)
    const prev = settledRef.current
    if (prev.length === now.length && prev.every((v, i) => v === now[i])) return
    settledRef.current = now
    setSettled(now)
    if (prev.length === now.length) setDeltas({ id: Date.now(), values: now.map((v, i) => v - prev[i]) })
  }, [key, walking])

  useEffect(() => {
    if (!deltas) return
    const t = window.setTimeout(() => setDeltas(null), 2600)
    return () => window.clearTimeout(t)
  }, [deltas])

  return { displayMoney: walking ? settled : money, deltas }
}

export const formatAmount = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('tr-TR')} ₺`

// Game-material palette for the paper board surface.
const ON_PAPER = {
  ink: 'oklch(0.22 0.02 160)',
  white: 'oklch(0.985 0 0)',
  gain: 'oklch(0.5 0.14 150)',
  loss: 'oklch(0.55 0.21 27)',
  warn: 'oklch(0.42 0.03 260)',
  neutral: 'oklch(0.32 0.03 160)',
  chance: 'oklch(0.7 0.17 55)',
  chest: 'oklch(0.62 0.1 225)',
}

function toneColor(tone: Meta['tone']) {
  return ON_PAPER[tone]
}

/** Big centre-of-board card describing what just happened on the square. */
export function EventSpotlight({
  events,
  nameOf,
  tokenColor,
}: {
  events: GameEvent[]
  nameOf: (seat: number) => string
  tokenColor: string[]
}) {
  const ranked = events
    .filter((e) => e.kind !== 'roll' && e.kind !== 'info')
    .map((e, order) => ({ e, order }))
    .sort((a, b) => EVENT_META[b.e.kind].priority - EVENT_META[a.e.kind].priority || b.order - a.order)
    .map((r) => r.e)
  const [main, ...rest] = ranked
  if (!main) return null
  const meta = EVENT_META[main.kind]
  const color = toneColor(meta.tone)
  const Icon = meta.icon
  const extra = rest.slice(0, 2)

  return (
    <div
      key={main.id}
      role="status"
      className="flex w-full max-w-[92%] flex-col overflow-hidden rounded-[1.6cqw] shadow-[0_1.2cqw_2.4cqw_-0.8cqw_oklch(0_0_0/0.45)] motion-safe:animate-[mono-event-in_480ms_cubic-bezier(.2,.9,.3,1.2)_both]"
      style={{ background: ON_PAPER.white, color: ON_PAPER.ink }}
    >
      <div className="flex items-center gap-[1.8cqw] p-[1.8cqw]">
        <span
          className="relative flex aspect-square w-[9cqw] min-w-9 max-w-20 shrink-0 items-center justify-center rounded-[1.4cqw] motion-safe:animate-[mono-icon-ring_1.2s_ease-out_2]"
          style={{ background: color, color: ON_PAPER.white, '--ring-color': color } as React.CSSProperties}
        >
          <Icon className="size-[55%]" aria-hidden="true" />
          {main.actor != null && (
            <img
              src={`/images/monopoly/pawn-${main.actor}.png`}
              alt=""
              className="absolute -bottom-[18%] -right-[18%] aspect-square w-[52%] rounded-full border-2 object-cover object-[50%_30%]"
              style={{ borderColor: tokenColor[main.actor] ?? ON_PAPER.white, background: tokenColor[main.actor] }}
            />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[0.3cqw]">
          <p className="truncate text-[clamp(8px,1.5cqw,12px)] font-bold uppercase tracking-widest opacity-60">
            {main.actor != null ? nameOf(main.actor) : 'Masa'}
            {main.target != null ? ` → ${nameOf(main.target)}` : ''}
          </p>
          <p className="truncate font-display text-[clamp(12px,2.9cqw,24px)] font-black leading-tight">{main.title}</p>
          {main.detail && <p className="line-clamp-2 text-pretty text-[clamp(9px,1.7cqw,14px)] font-medium leading-snug opacity-80">{main.detail}</p>}
        </div>
        {main.amount != null && main.amount !== 0 && (
          <span
            className="shrink-0 rounded-full px-[1.6cqw] py-[0.6cqw] font-display text-[clamp(11px,2.4cqw,20px)] font-black tabular-nums"
            style={{ background: main.amount > 0 ? ON_PAPER.gain : ON_PAPER.loss, color: ON_PAPER.white }}
          >
            {formatAmount(main.amount)}
          </span>
        )}
      </div>
      {extra.length > 0 && (
        <ul className="flex flex-col border-t" style={{ borderColor: 'oklch(0.22 0.02 160 / 0.1)' }}>
          {extra.map((e) => {
            const m = EVENT_META[e.kind]
            const ExtraIcon = m.icon
            return (
              <li key={e.id} className="flex items-center gap-[1.2cqw] px-[1.8cqw] py-[0.9cqw] text-[clamp(8px,1.5cqw,13px)]">
                <ExtraIcon className="size-[2.2cqw] min-h-3 min-w-3 shrink-0" style={{ color: toneColor(m.tone) }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {e.actor != null ? `${nameOf(e.actor)} · ` : ''}
                  {e.title}
                  {e.detail ? ` · ${e.detail}` : ''}
                </span>
                {e.amount != null && e.amount !== 0 && (
                  <span className="shrink-0 font-black tabular-nums" style={{ color: e.amount > 0 ? ON_PAPER.gain : ON_PAPER.loss }}>
                    {formatAmount(e.amount)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Always-visible running feed of the game's events, newest first. */
export function EventFeed({ feed, nameOf, tokenColor }: { feed: GameEvent[]; nameOf: (seat: number) => string; tokenColor: string[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-bold text-foreground">Son olaylar</h3>
        <span className="text-xs text-muted-foreground">canlı</span>
      </div>
      <ol className="flex max-h-60 flex-col overflow-y-auto lg:max-h-72" aria-live="polite">
        {feed.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Henüz hamle yok.</li>}
        {feed.map((e, k) => {
          const meta = EVENT_META[e.kind]
          const Icon = meta.icon
          const tint =
            meta.tone === 'gain'
              ? 'bg-live/15 text-live'
              : meta.tone === 'loss'
                ? 'bg-destructive/15 text-destructive'
                : meta.tone === 'chance' || meta.tone === 'warn'
                  ? 'bg-primary/15 text-primary'
                  : meta.tone === 'chest'
                    ? 'bg-accent/15 text-accent'
                    : 'bg-secondary text-muted-foreground'
          return (
            <li
              key={e.id}
              className={cn(
                'flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-b-0',
                k === 0 && 'bg-primary/5 motion-safe:animate-slide-in',
                e.kind === 'roll' && 'py-1.5 opacity-70',
              )}
            >
              <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-lg', tint, e.kind === 'roll' && 'size-6')}>
                <Icon className={cn('size-4', e.kind === 'roll' && 'size-3.5')} aria-hidden="true" />
                {e.actor != null && e.kind !== 'roll' && (
                  <span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-card" style={{ background: tokenColor[e.actor] }} aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-foreground">
                  {e.actor != null && <span className="text-muted-foreground">{nameOf(e.actor)} · </span>}
                  {e.kind === 'info' ? e.detail.replace(/@(\d)/g, (_, d) => nameOf(Number(d))) : e.title}
                </p>
                {e.kind !== 'info' && e.detail && (
                  <p className="truncate text-xs leading-relaxed text-muted-foreground">
                    {e.detail}
                    {e.target != null ? ` · ${nameOf(e.target)} aldı` : ''}
                  </p>
                )}
              </div>
              {e.amount != null && e.amount !== 0 && (
                <span className={cn('shrink-0 text-sm font-black tabular-nums', e.amount > 0 ? 'text-live' : 'text-destructive')}>{formatAmount(e.amount)}</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function MoneyFloat({ delta, id }: { delta: number; id: number }) {
  if (!delta) return null
  return (
    <span
      key={id}
      className={cn(
        'pointer-events-none absolute right-2 top-0 z-10 rounded-full px-2 py-0.5 text-xs font-black tabular-nums shadow-lg motion-safe:animate-[mono-money-float_2.4s_cubic-bezier(.2,.8,.2,1)_both]',
        delta > 0 ? 'bg-live text-live-foreground' : 'bg-destructive text-foreground',
      )}
      aria-live="polite"
    >
      {formatAmount(delta)}
    </span>
  )
}
