'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Bot, Crown, Eye, Shuffle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sound'
import { cardName, isOdd, oddName, pairsWith, type PapazEvent, type PapazView, type PzCard } from '@/lib/games/papaz'
import { BatakCard } from './batak-pvp'
import type { Remote } from './remote'
import { TableBrand } from './table-brand'

/** Seat anchors (left %, top %) around the oval for each number of opponents, clockwise from your left. */
const SEAT_SPOTS: Record<number, [number, number][]> = {
  1: [[50, 6]],
  2: [[17, 24], [83, 24]],
  3: [[13, 36], [50, 4], [87, 36]],
  4: [[12, 46], [26, 6], [74, 6], [88, 46]],
  5: [[11, 56], [12, 20], [50, 2], [88, 20], [89, 56]],
}

const cardKey = (c: PzCard) => `${c.s}-${c.r}`
const sameCard = (a: PzCard, b: PzCard) => a.s === b.s && a.r === b.r

type Reveal = { id: number; title: string; tone: 'bad' | 'good' | 'pair' | 'info'; card?: PzCard; pair?: PzCard[] }

function eventText(e: PapazEvent, name: (i: number) => string, me: number, odd: string) {
  const who = e.seat === me ? 'Sen' : name(e.seat)
  if (e.kind === 'pair' && e.pair) return `${who} eşi yere attı: ${cardName(e.pair[0])} + ${cardName(e.pair[1])}`
  if (e.kind === 'draw') {
    const src = e.from === me ? 'senden' : `${name(e.from)} oyuncusundan`
    return `${who} ${src} kart çekti${e.card ? ` (${cardName(e.card)})` : ''}`
  }
  if (e.kind === 'out') return `${who} kartlarını bitirdi, ${e.place}. sırada kurtuldu`
  if (e.kind === 'end') return `${odd} ${e.seat === me ? 'sende' : `${name(e.seat)} oyuncusunda`} kaldı`
  return 'Kartlar dağıtıldı'
}

function CardBack({ className, onClick, disabled, label, style }: { className?: string; onClick?: () => void; disabled?: boolean; label?: string; style?: React.CSSProperties }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={label}
      aria-hidden={onClick ? undefined : true}
      style={style}
      className={cn(
        'card-back relative shrink-0 rounded-md border border-gold/40 shadow-md transition-transform duration-150',
        onClick && !disabled && 'cursor-pointer hover:-translate-y-3 focus-visible:-translate-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        className,
      )}
    />
  )
}

function SeatPod({ v, seat, name, me, drawing, pos }: { v: PapazView; seat: number; name: string; me: number; drawing: boolean; pos: [number, number] }) {
  const out = v.finished.includes(seat)
  const place = v.finished.indexOf(seat) + 1
  const lost = v.loser === seat
  const active = v.loser == null && v.turn === seat
  const count = v.handCounts[seat]
  const shown = Math.min(count, 6)
  return (
    <div
      className={cn('absolute flex w-24 -translate-x-1/2 flex-col items-center gap-1 transition-opacity', out && !lost && 'opacity-70')}
      style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}
    >
      <div className="relative">
        <span
          className={cn(
            'flex size-11 items-center justify-center rounded-full border-2 bg-background/85 text-sm font-bold text-foreground shadow-md',
            active ? 'border-gold' : drawing ? 'border-destructive' : lost ? 'border-destructive' : 'border-border/60',
          )}
          style={active ? { animation: 'pisti-ring 1.2s ease-out infinite' } : undefined}
        >
          {v.bots.includes(seat) ? <Bot className="size-5" aria-hidden="true" /> : name.slice(0, 1).toUpperCase()}
        </span>
        {lost && (
          <Crown className="absolute -top-4 left-1/2 size-6 -translate-x-1/2 -rotate-12 fill-destructive text-destructive drop-shadow" aria-label="Papaz şapkası" />
        )}
        {out && !lost && (
          <span className="absolute -right-2 -top-1 flex size-5 items-center justify-center rounded-full bg-gold text-[10px] font-black text-gold-foreground">{place}.</span>
        )}
      </div>
      <p className="max-w-full truncate rounded-md bg-background/80 px-1.5 text-[11px] font-semibold leading-5 text-foreground">{seat === me ? 'Sen' : name}</p>
      {count > 0 ? (
        <div className="flex items-center" aria-label={`${count} kart`}>
          {Array.from({ length: shown }, (_, i) => (
            <CardBack key={i} className={cn('h-6 w-4 rounded-sm', i > 0 && '-ml-2.5')} />
          ))}
          <span className="ml-1 rounded-full bg-background/85 px-1.5 text-[10px] font-bold tabular-nums text-foreground">{count}</span>
        </div>
      ) : (
        <span className="text-[10px] font-semibold text-foreground/80">{lost ? 'Şapka onda' : 'Kurtuldu'}</span>
      )}
      {drawing && !out && <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">Kartı çekiliyor</span>}
    </div>
  )
}

function RevealCard({ r }: { r: Reveal }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" aria-live="assertive">
      <div
        key={r.id}
        className={cn(
          'flex flex-col items-center gap-2 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur animate-in fade-in zoom-in-75 duration-300',
          r.tone === 'bad' && 'border-destructive bg-destructive/90 text-destructive-foreground',
          r.tone === 'good' && 'border-gold bg-background/90 text-foreground',
          r.tone === 'pair' && 'border-gold/60 bg-background/90 text-foreground',
          r.tone === 'info' && 'border-border bg-background/85 text-foreground',
        )}
      >
        <div className="flex items-end gap-1.5">
          {r.pair ? r.pair.map((c) => <BatakCard key={cardKey(c)} card={c} size="md" />) : r.card ? <BatakCard card={r.card} size="md" /> : <CardBack className="h-[5.2rem] w-[3.7rem]" />}
        </div>
        <p className="max-w-56 text-balance text-center font-display text-base font-black leading-tight">{r.title}</p>
      </div>
    </div>
  )
}

export function PapazPvp({ remote }: { remote: Remote<PapazView> }) {
  const v = remote.state
  const me = remote.spectator ? -1 : remote.seat
  const name = (i: number) => remote.names[i] || (v.bots.includes(i) ? `Bot ${i + 1}` : `Oyuncu ${i + 1}`)
  const ended = v.loser != null
  const myTurn = remote.myTurn && !ended && me >= 0
  const target = v.target
  const odd = oddName(v.rules)
  const lastEvent = v.log[v.log.length - 1]

  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [hint, setHint] = useState('')
  const lastSeq = useRef(v.seq)
  useEffect(() => {
    if (v.seq === lastSeq.current) return
    const fresh = v.log.filter((e) => e.seq > lastSeq.current)
    lastSeq.current = v.seq
    const end = fresh.find((e) => e.kind === 'end')
    const move = [...fresh].reverse().find((e) => e.kind === 'draw' || (e.kind === 'pair' && e.from >= 0))
    let next: Reveal | null = null
    if (end) {
      playSound(end.seat === me ? 'leave' : 'win')
    } else if (move) {
      const oddCard = move.card && isOdd(move.card, v.rules)
      const id = move.seq
      if (move.seat === me && oddCard) next = { id, tone: 'bad', card: move.card, title: `${odd} sende! Sakla onu kanka` }
      else if (move.from === me && oddCard) next = { id, tone: 'good', card: move.card, title: `${odd}'tan kurtuldun!` }
      else if (move.kind === 'pair' && move.pair) next = { id, tone: 'pair', pair: move.pair, title: `${move.seat === me ? 'Sen' : name(move.seat)} eşledi!` }
      else if (move.seat === me && move.card) next = { id, tone: 'info', card: move.card, title: `${name(move.from)} oyuncusundan çektin` }
      else if (move.from === me && move.card) next = { id, tone: 'info', card: move.card, title: `${name(move.seat)} senden aldı` }
      else next = { id, tone: 'info', title: `${name(move.seat)}, ${name(move.from)} oyuncusundan çekti` }
      playSound(oddCard && (move.seat === me || move.from === me) ? (move.seat === me ? 'leave' : 'win') : move.kind === 'pair' ? 'coin' : 'turn')
    }
    if (next) {
      setReveal(next)
      const t = setTimeout(() => setReveal((r) => (r?.id === next!.id ? null : r)), next.tone === 'bad' || next.tone === 'good' ? 1900 : 1300)
      return () => clearTimeout(t)
    }
    // name is derived from remote.names each render; only new events should trigger the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.seq])

  // My hand keeps the server's order; while dragging we show a local copy until the server confirms.
  const sig = v.hand.map(cardKey).join(',')
  const [local, setLocal] = useState<{ sig: string; cards: PzCard[] } | null>(null)
  const hand = local && local.sig === sig ? local.cards : v.hand
  const [selected, setSelected] = useState<PzCard | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const drag = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null)

  const sendOrder = (cards: PzCard[]) => {
    const order = cards.map((c) => v.hand.findIndex((h) => sameCard(h, c)))
    if (order.some((x, i) => x !== i)) remote.send({ type: 'reorder', order })
  }

  const tapCard = (c: PzCard) => {
    if (!v.rules.klasik || ended) return
    if (!selected || sameCard(selected, c)) {
      setSelected(selected ? null : c)
      setHint('')
      return
    }
    if (pairsWith(selected, c)) {
      const i = v.hand.findIndex((h) => sameCard(h, selected))
      const j = v.hand.findIndex((h) => sameCard(h, c))
      remote.send({ type: 'pair', i, j })
      setSelected(null)
      setHint('')
    } else {
      setSelected(c)
      setHint('Bu ikisi eş değil: aynı sayı ve aynı renk olmalı')
    }
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (ended) return
    drag.current = { index, x: e.clientX, y: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return
    d.moved = true
    let best = d.index
    let bestDist = Infinity
    cardRefs.current.forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    if (best !== d.index) {
      const cards = [...hand]
      const [c] = cards.splice(d.index, 1)
      cards.splice(best, 0, c)
      d.index = best
      setLocal({ sig, cards })
    }
  }
  const onUp = (c: PzCard) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) sendOrder(hand)
    else tapCard(c)
  }

  const shuffleHand = () => {
    const cards = [...hand]
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }
    setLocal({ sig, cards })
    sendOrder(cards)
  }

  const base = me >= 0 ? me : 0
  const others = Array.from({ length: v.seats - 1 }, (_, i) => (base + 1 + i) % v.seats)
  const spots = SEAT_SPOTS[others.length] ?? SEAT_SPOTS[5]
  const targetCount = target >= 0 ? v.handCounts[target] : 0
  const fanStep = (n: number, room: number, w: number) => (n <= 1 ? 0 : Math.min(w * 0.75, Math.max(10, Math.floor((room - w) / (n - 1)))))
  const targetStep = fanStep(targetCount, 260, 58)
  const twoRows = hand.length > 13
  const rows = twoRows ? [hand.slice(0, Math.ceil(hand.length / 2)), hand.slice(Math.ceil(hand.length / 2))] : [hand]
  const handStep = fanStep(rows[0].length, 330, 56)
  const iHaveOdd = hand.some((c) => isOdd(c, v.rules))
  const iAmOut = me >= 0 && !hand.length && !ended
  const myPlace = v.finished.indexOf(me) + 1

  const status = ended
    ? `${odd} ${v.loser === me ? 'sende kaldı, kaybettin' : `${name(v.loser!)} oyuncusunda kaldı`}`
    : myTurn
      ? `Sıra sende: ${name(target)} oyuncusundan bir kart seç`
      : target === me
        ? `${name(v.turn)} senden kart çekiyor`
        : `${name(v.turn)}, ${name(target)} oyuncusundan çekiyor`

  return (
    <div className="baize-table relative flex h-[calc(100dvh-8.75rem)] min-h-[30rem] flex-col overflow-hidden rounded-[1.4rem] p-3 sm:p-4 lg:h-[min(44rem,calc(100dvh-11rem))]">
      <TableBrand />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-bold text-foreground">
          {v.rules.kiz ? 'Kız Kimde' : 'Papaz Kimde'}
          {v.rules.klasik ? ' · Klasik' : ''}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground">
          Kaybettiren:
          <BatakCard card={v.odd} size="xs" />
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {others.map((seat, i) => (
          <SeatPod key={seat} v={v} seat={seat} name={name(seat)} me={me} drawing={!ended && seat === target && v.turn !== me} pos={spots[i]} />
        ))}

        <div className="absolute inset-x-0 top-[44%] flex -translate-y-1/2 flex-col items-center gap-3 px-2">
          <p
            className={cn('max-w-full rounded-full px-3 py-1 text-center text-xs font-bold shadow-sm sm:text-sm', myTurn ? 'bg-gold text-gold-foreground' : 'bg-background/85 text-foreground')}
            aria-live="polite"
          >
            {status}
          </p>

          {!ended && target >= 0 && target !== me && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-end justify-center pt-3" role="group" aria-label={`${name(target)} oyuncusunun kapalı kartları`}>
                {Array.from({ length: targetCount }, (_, i) => (
                  <CardBack
                    key={`${v.seq}-${i}`}
                    className={cn('h-[5.2rem] w-[3.7rem] sm:h-24 sm:w-[4.3rem]', !myTurn && 'opacity-80')}
                    style={i > 0 ? { marginLeft: targetStep - 58 } : undefined}
                    onClick={myTurn ? () => remote.send({ type: 'draw', index: i }) : undefined}
                    disabled={remote.busy}
                    label={`${i + 1}. kapalı kartı çek`}
                  />
                ))}
              </div>
              <p className="text-[11px] font-semibold text-foreground/80">{myTurn ? 'Dokun ve çek' : `${name(target)} · ${targetCount} kart`}</p>
            </div>
          )}

          {ended && (
            <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-gold/50 bg-background/90 p-4 backdrop-blur">
              <div className="flex items-center justify-center gap-2">
                <BatakCard card={v.odd} size="sm" />
                <p className="text-balance text-sm font-bold text-foreground">
                  {v.loser === me ? `${odd} sende kaldı kanka, şapka senin` : `${name(v.loser!)} şapkayı giydi`}
                </p>
              </div>
              <ol className="flex flex-col gap-1" aria-label="Sıralama">
                {[...v.finished.filter((x) => x !== v.loser), v.loser!].map((seat, i, all) => (
                  <li
                    key={seat}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                      seat === v.loser ? 'bg-destructive/15 text-destructive' : i === 0 ? 'bg-gold/20 text-foreground' : 'bg-secondary text-foreground',
                    )}
                  >
                    <span>
                      {seat === v.loser ? 'Kaybeden' : `${i + 1}.`} {seat === me ? 'Sen' : name(seat)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{seat === v.loser ? 'bahsi kaybetti' : i === 0 ? 'en büyük pay' : i === all.length - 2 ? 'en küçük pay' : 'pay aldı'}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {lastEvent && !ended && (
          <p className="absolute inset-x-2 bottom-1 truncate text-center text-[11px] text-foreground/75">{eventText(lastEvent, name, me, odd)}</p>
        )}
        {reveal && <RevealCard r={reveal} />}
      </div>

      {me >= 0 ? (
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          {iAmOut ? (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-background/85 px-4 py-2 text-center">
              <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Sparkles className="size-4 text-gold" aria-hidden="true" />
                Kurtuldun, {myPlace}. sıradasın
              </p>
              <p className="text-[11px] text-muted-foreground">Payın oyun bitince hesabına geçer, istersen masadan kalkabilirsin.</p>
            </div>
          ) : hand.length ? (
            <>
              <div className="flex w-full items-center justify-between gap-2 px-1">
                <p className={cn('truncate text-[11px] font-semibold', iHaveOdd ? 'text-destructive' : 'text-foreground/80')}>
                  {hint || (iHaveOdd ? `${odd} sende, sürükleyip sakla` : v.rules.klasik ? 'Eşleri bul: iki karta dokun' : 'Kartları sürükleyip sıralayabilirsin')}
                </p>
                {!ended && (
                  <button
                    type="button"
                    onClick={shuffleHand}
                    disabled={remote.busy || hand.length < 2}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-bold text-foreground disabled:opacity-50"
                  >
                    <Shuffle className="size-3.5" aria-hidden="true" />
                    Karıştır
                  </button>
                )}
              </div>
              <div className="flex w-full touch-none select-none flex-col items-center gap-1 pt-3" role="group" aria-label="Elindeki kartlar">
                {rows.map((row, r) => (
                  <div key={r} className="flex items-end justify-center">
                    {row.map((c, k) => {
                      const i = r === 0 ? k : rows[0].length + k
                      const oddCard = isOdd(c, v.rules)
                      const isSel = selected != null && sameCard(selected, c)
                      return (
                        <div
                          key={cardKey(c)}
                          ref={(el) => {
                            cardRefs.current[i] = el
                          }}
                          onPointerDown={(e) => onDown(e, i)}
                          onPointerMove={onMove}
                          onPointerUp={() => onUp(c)}
                          onPointerCancel={() => (drag.current = null)}
                          className={cn('relative cursor-grab transition-transform active:cursor-grabbing', isSel && '-translate-y-3')}
                          style={k > 0 ? { marginLeft: handStep - 56 } : undefined}
                        >
                          <BatakCard card={c} size="sm" className={cn(oddCard && 'ring-2 ring-destructive', isSel && 'ring-2 ring-gold')} />
                          {oddCard && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{odd}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <p className={cn('text-[11px] font-semibold', myTurn ? 'text-gold' : 'text-foreground/70')}>
            Sen · {v.handCounts[me]} kart · {v.pairCounts[me]} eş
          </p>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-foreground/70">
          <Eye className="size-3.5" aria-hidden="true" />
          İzleyici modundasın
        </p>
      )}
    </div>
  )
}
