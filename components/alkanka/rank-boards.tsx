'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, Clock, Crown, Dices, Gift, MessageCircle, Search, Share2, Target, UserPlus, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LevelEmblem, RankChip, SpecialEmblem } from './kp/emblem'
import { MemberRank } from './kp/member-rank'
import { jakoSrc } from './jako'

export type BoardPeriod = 'gun' | 'hafta' | 'ay'
export type KpParts = { time: number; games: number; tasks: number; chat: number; league: number; referrals: number }
export type KpRow = { userId: string; name: string; kp: number; level: number; levelName: string; specials: number; parts: KpParts }
export type TipRow = { userId: string; name: string; points: number; hits: number; exact: number; picks: number }
export type Prize = { id: string; name: string; icon: string; tier: string; bonus: number; label: string }

type Category = 'kp' | 'oyun' | 'sohbet' | 'davet' | 'tahmin'

type Row = {
  userId: string
  name: string
  rank: number
  value: number
  detail: string
  level?: number
  levelName?: string
  specials?: number
  parts?: KpParts
}

const PERIODS: { id: BoardPeriod; label: string; noun: string; note: string }[] = [
  { id: 'gun', label: 'Günlük', noun: 'Günün', note: 'Her gece 00:00’da sıfırlanır' },
  { id: 'hafta', label: 'Haftalık', noun: 'Haftanın', note: 'Her pazartesi 00:00’da sıfırlanır' },
  { id: 'ay', label: 'Aylık', noun: 'Ayın', note: 'Her ayın 1’inde sıfırlanır' },
]

const CATEGORIES: { id: Category; label: string; unit: string; icon: typeof Zap; empty: string; cta: { href: string; label: string } }[] = [
  { id: 'kp', label: 'Kanka Puan', unit: 'KP', icon: Zap, empty: 'Bu dönem henüz puan toplanmadı.', cta: { href: '/oyunlar', label: 'Oyun oyna' } },
  { id: 'oyun', label: 'Oyunlar', unit: 'KP', icon: Dices, empty: 'Bu dönem kimse oyun ya da görevden puan almadı.', cta: { href: '/oyunlar', label: 'Oyun oyna' } },
  { id: 'tahmin', label: 'Tahmin', unit: 'puan', icon: Target, empty: 'Bu dönemde sonuçlanan tahmin yok.', cta: { href: '/tahminler', label: 'Tahmin yap' } },
  { id: 'sohbet', label: 'Sohbet', unit: 'KP', icon: MessageCircle, empty: 'Bu dönem sohbetten puan alan yok.', cta: { href: '/profil', label: 'Telegram bağla' } },
  { id: 'davet', label: 'Davet', unit: 'KP', icon: UserPlus, empty: 'Bu dönem davetle puan alan yok.', cta: { href: '/profil', label: 'Davet linkini al' } },
]

const PAGE = 12
const fmt = (n: number) => n.toLocaleString('tr-TR')
const ISTANBUL_OFFSET = 3 * 60 * 60 * 1000

function periodEnd(period: BoardPeriod, now: number) {
  const ist = new Date(now + ISTANBUL_OFFSET)
  const y = ist.getUTCFullYear()
  const m = ist.getUTCMonth()
  const d = ist.getUTCDate()
  if (period === 'gun') return Date.UTC(y, m, d + 1) - ISTANBUL_OFFSET
  if (period === 'ay') return Date.UTC(y, m + 1, 1) - ISTANBUL_OFFSET
  const toMonday = (8 - ist.getUTCDay()) % 7 || 7
  return Date.UTC(y, m, d + toMonday) - ISTANBUL_OFFSET
}

function remaining(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(min / 1440)
  const hours = Math.floor((min % 1440) / 60)
  const mins = min % 60
  if (days > 0) return `${days}g ${hours}s`
  if (hours > 0) return `${hours}s ${mins}dk`
  return `${mins}dk`
}

function useCountdown(period: BoardPeriod) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now === null ? null : remaining(periodEnd(period, now) - now)
}

function buildRows(category: Category, kp: KpRow[], tips: TipRow[]): Row[] {
  if (category === 'tahmin') {
    return tips.map((u, i) => ({
      userId: u.userId,
      name: u.name,
      rank: i + 1,
      value: u.points,
      detail: `${u.hits}/${u.picks} doğru · ${u.exact} tam skor`,
    }))
  }
  const pick = (u: KpRow) =>
    category === 'kp' ? u.kp : category === 'oyun' ? u.parts.games + u.parts.tasks : category === 'sohbet' ? u.parts.chat : u.parts.referrals
  return kp
    .map((u) => ({ u, value: pick(u) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .map(({ u, value }, i) => ({
      userId: u.userId,
      name: u.name,
      rank: i + 1,
      value,
      detail: `${u.levelName}${u.specials ? ` · ${u.specials} değerli rozet` : ''}`,
      level: u.level,
      levelName: u.levelName,
      specials: u.specials,
      parts: u.parts,
    }))
}

function RankBadge({ n }: { n: number }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold tabular-nums',
        n === 1 ? 'bg-primary text-primary-foreground' : n <= 3 ? 'border border-primary/50 text-primary' : 'text-muted-foreground',
      )}
    >
      {n === 1 ? <Crown className="size-3.5" aria-label="1." /> : n}
    </span>
  )
}

/* ---------- Period tabs + countdown ---------- */

function PeriodBar({
  period,
  setPeriod,
  counts,
  countdown,
}: {
  period: BoardPeriod
  setPeriod: (p: BoardPeriod) => void
  counts: Record<BoardPeriod, number>
  countdown: string | null
}) {
  const current = PERIODS.find((p) => p.id === period)!
  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Dönem" className="grid grid-cols-3 rounded-xl bg-secondary p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              'flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors',
              period === p.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                period === p.id ? 'bg-primary-foreground/20' : 'bg-background text-muted-foreground',
              )}
            >
              {counts[p.id]}
              <span className="sr-only"> kişi</span>
            </span>
          </button>
        ))}
      </div>
      <p className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span>{current.note}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-foreground" aria-live="polite">
          <Clock className="size-3.5 text-primary" aria-hidden />
          {countdown ? `Bitmesine ${countdown}` : '\u00a0'}
        </span>
      </p>
    </div>
  )
}

/* ---------- Status card ---------- */

function StatusCard({
  signedIn,
  rows,
  meId,
  unit,
  periodNoun,
  countdown,
  categoryLabel,
}: {
  signedIn: boolean
  rows: Row[]
  meId: string | null
  unit: string
  periodNoun: string
  countdown: string | null
  categoryLabel: string
}) {
  const [shareNote, setShareNote] = useState<string | null>(null)

  if (!signedIn) {
    return (
      <section aria-label="Senin durumun" className="panel-gold flex items-center gap-3 rounded-2xl p-3.5">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-primary/10">
          <Image src={jakoSrc('merhaba') || '/placeholder.svg'} alt="" fill sizes="56px" className="object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm leading-snug text-foreground text-pretty">
            Kayıt ol, ilk oyununla sıralamaya gir kanka. Yerin hazır!
          </p>
          <div className="flex gap-2">
            <a href="#kayit" className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground">
              Kayıt ol
            </a>
            <a href="#giris" className="inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-xs font-semibold text-foreground">
              Giriş yap
            </a>
          </div>
        </div>
      </section>
    )
  }

  const index = meId ? rows.findIndex((r) => r.userId === meId) : -1
  const mine = index >= 0 ? rows[index] : null
  const above = index > 0 ? rows[index - 1] : null
  const below = index >= 0 ? rows[index + 1] : undefined

  let line: string
  let progress = 0
  if (!mine) {
    line = `${periodNoun} ${categoryLabel.toLocaleLowerCase('tr')} tablosunda henüz yoksun. Bir oyun yeter, listeye girersin kanka!`
  } else if (!above) {
    line = below
      ? `Zirvedesin! 2. ile aranda ${fmt(mine.value - below.value)} ${unit} fark var, koru kanka.`
      : 'Zirvedesin kanka, tahtın sağlam!'
    progress = 100
  } else {
    const gap = above.value - mine.value
    line = gap === 0 ? `${above.rank}. ile berabersin, bir hamle seni öne geçirir!` : `${above.rank}. sıraya ${fmt(gap)} ${unit} kaldı kanka, bas gaza!`
    progress = Math.max(4, Math.min(100, Math.round((mine.value / Math.max(1, above.value)) * 100)))
  }

  async function share() {
    if (!mine) return
    const url = `${window.location.origin}/siralama`
    const text = `AL KANKA ${periodNoun.toLocaleLowerCase('tr')} ${categoryLabel} sıralamasında ${mine.rank}. sıradayım! Gel bakalım geçebilecek misin?`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AL KANKA sıralama', text, url })
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        setShareNote('Kopyalandı')
        setTimeout(() => setShareNote(null), 2000)
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <section aria-label="Senin durumun" className="panel-gold flex flex-col gap-3 rounded-2xl p-3.5">
      <div className="flex items-start gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-primary/10">
          <Image src={jakoSrc(mine && mine.rank <= 3 ? 'kazandi' : 'merhaba') || '/placeholder.svg'} alt="" fill sizes="56px" className="object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Senin durumun</p>
            {mine && (
              <p className="font-display text-lg font-bold leading-none text-foreground tabular-nums">
                {mine.rank}.<span className="ml-1 text-xs font-semibold text-muted-foreground">sıra</span>
              </p>
            )}
          </div>
          <p className="text-sm leading-snug text-foreground text-pretty">{line}</p>
        </div>
      </div>

      {mine && (
        <div className="flex flex-col gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.07]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Bir üst sıraya ilerleme">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{fmt(mine.value)} {unit}</span>
            <span>{above ? `${above.rank}. · ${fmt(above.value)} ${unit}` : countdown ? `Dönem sonu ${countdown}` : ''}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Link href="/oyunlar" className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          <Dices className="size-4" aria-hidden /> Oyna
        </Link>
        <Link href="/gorevler" className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground">
          <Zap className="size-4 text-primary" aria-hidden /> Görev
        </Link>
        <Link href="/tahminler" className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground">
          <Target className="size-4 text-primary" aria-hidden /> Tahmin
        </Link>
      </div>

      {mine && mine.rank <= 10 && (
        <button
          type="button"
          onClick={share}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-primary/50 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
        >
          <Share2 className="size-4" aria-hidden />
          {shareNote ?? `İlk 10'dasın, sıranı paylaş`}
        </button>
      )}
    </section>
  )
}

/* ---------- Prize showcase ---------- */

function PrizeShowcase({ prizes, periodNoun }: { prizes: Prize[]; periodNoun: string }) {
  return (
    <section aria-labelledby="odul-baslik" className="flex flex-col gap-2">
      <h2 id="odul-baslik" className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Gift className="size-3.5 text-primary" aria-hidden /> {periodNoun} ödülleri
      </h2>
      {prizes.length ? (
        <ul className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {prizes.map((p) => (
            <li key={p.id} className="flex min-w-[15rem] flex-1 snap-start items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <SpecialEmblem icon={p.icon} tier={p.tier} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{p.label}</span>
              </span>
              {p.bonus > 0 && (
                <span className="ml-auto shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary tabular-nums">
                  +{fmt(p.bonus)} KP
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Günlük tabloda rozet yok, şöhret var. Haftalık ve aylık şampiyonlar rozet ve KP bonusu kazanır.
        </p>
      )}
    </section>
  )
}

/* ---------- Podium ---------- */

const PODIUM_STYLE = {
  1: { order: 'order-2', block: 'h-20 bg-primary text-primary-foreground', avatar: 'size-14 bg-primary text-primary-foreground ring-primary/30', value: 'text-primary' },
  2: { order: 'order-1', block: 'h-14 bg-foreground/80 text-background', avatar: 'size-12 bg-foreground/85 text-background ring-foreground/15', value: 'text-foreground' },
  3: { order: 'order-3', block: 'h-10 bg-bronze text-background', avatar: 'size-12 bg-bronze text-background ring-bronze/25', value: 'text-bronze' },
} as const

function Podium({ rows, unit, meId }: { rows: Row[]; unit: string; meId: string | null }) {
  const top = rows.slice(0, 3)
  if (!top.length) return null
  return (
    <ol aria-label="İlk üç" className="grid grid-cols-3 items-end gap-2 px-1 pt-2">
      {top.map((u) => {
        const s = PODIUM_STYLE[u.rank as 1 | 2 | 3]
        return (
          <li
            key={u.userId}
            className={cn('flex min-w-0 flex-col items-center gap-1.5 motion-safe:animate-[rise_0.5s_ease-out_both]', s.order)}
            style={{ animationDelay: `${(3 - u.rank) * 90}ms` }}
          >
            <span className="relative">
              {u.rank === 1 && (
                <Crown className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 text-primary motion-safe:animate-bounce" aria-hidden />
              )}
              <span className={cn('flex items-center justify-center rounded-full font-display text-lg font-bold ring-4', s.avatar)} aria-hidden>
                {u.name.charAt(0).toUpperCase()}
              </span>
            </span>
            <span className="w-full truncate text-center text-xs font-semibold text-foreground">
              {u.name}
              {u.userId === meId && <span className="text-primary"> (sen)</span>}
            </span>
            <span className={cn('font-display text-sm font-bold leading-none tabular-nums', s.value)}>
              {fmt(u.value)} <span className="text-[10px] font-medium text-muted-foreground">{unit}</span>
            </span>
            <span className={cn('relative flex w-full items-start justify-center overflow-hidden rounded-t-lg pt-1.5 font-display text-xl font-black', s.block)}>
              {u.rank === 1 && <span className="tier-shine pointer-events-none absolute inset-0 opacity-50" aria-hidden />}
              <span className="sr-only">Sıra </span>
              {u.rank}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- Table row with profile preview ---------- */

const PART_LABELS: { key: keyof KpParts; label: string }[] = [
  { key: 'games', label: 'Oyun' },
  { key: 'tasks', label: 'Görev' },
  { key: 'league', label: 'Tahmin' },
  { key: 'chat', label: 'Sohbet' },
  { key: 'time', label: 'Süre' },
  { key: 'referrals', label: 'Davet' },
]

function BoardRow({ row, unit, isMe, tip, sticky }: { row: Row; unit: string; isMe: boolean; tip: boolean; sticky?: boolean }) {
  const [open, setOpen] = useState(false)
  const parts = row.parts ? PART_LABELS.filter((p) => (row.parts?.[p.key] ?? 0) > 0) : []
  const id = `profil-${sticky ? 's-' : ''}${row.userId}`

  return (
    <li className={cn('border-b border-border last:border-0', isMe && 'bg-primary/[0.08]', sticky && 'border-0')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className={cn('flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/[0.03]', isMe && 'ring-1 ring-inset ring-primary')}
      >
        <RankBadge n={row.rank} />
        {row.level ? <LevelEmblem level={row.level} size="xs" /> : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">
              {row.name}
              {isMe && <span className="text-primary"> (sen)</span>}
            </span>
            {row.level ? <RankChip level={row.level} /> : tip ? <MemberRank userId={row.userId} /> : null}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">{row.detail}</span>
        </span>
        <span className="shrink-0 font-display text-sm font-bold tabular-nums text-foreground">
          {fmt(row.value)} <span className="text-[10px] text-muted-foreground">{unit}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-2 px-3.5 pb-3 pl-[3.25rem]">
          {row.levelName && (
            <p className="text-xs text-muted-foreground">
              Seviye <span className="font-semibold text-foreground">{row.level}</span> · {row.levelName}
              {row.specials ? ` · ${row.specials} değerli rozet` : ''}
            </p>
          )}
          {parts.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Puan dağılımı">
              {parts.map((p) => (
                <li key={p.key} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-foreground tabular-nums">
                  {p.label} <span className="font-semibold">{fmt(row.parts![p.key])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{row.detail}</p>
          )}
        </div>
      )}
    </li>
  )
}

/* ---------- Main ---------- */

export function RankBoards({
  kp,
  tips,
  prizes,
  meId,
  signedIn,
  initial,
}: {
  kp: Record<BoardPeriod, KpRow[]>
  tips: Record<BoardPeriod, TipRow[]>
  prizes: Record<BoardPeriod, Prize[]>
  meId: string | null
  signedIn: boolean
  initial: BoardPeriod
}) {
  const [period, setPeriodState] = useState<BoardPeriod>(initial)
  const [category, setCategory] = useState<Category>('kp')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const countdown = useCountdown(period)

  const setPeriod = (p: BoardPeriod) => {
    setPeriodState(p)
    setVisible(PAGE)
  }

  const cat = CATEGORIES.find((c) => c.id === category)!
  const periodMeta = PERIODS.find((p) => p.id === period)!
  const rows = useMemo(() => buildRows(category, kp[period], tips[period]), [category, kp, tips, period])
  const counts = { gun: kp.gun.length, hafta: kp.hafta.length, ay: kp.ay.length }

  const q = query.trim().toLocaleLowerCase('tr')
  const listed = q ? rows.filter((r) => r.name.toLocaleLowerCase('tr').includes(q)) : rows.slice(3, 3 + visible)
  const mine = meId ? rows.find((r) => r.userId === meId) ?? null : null
  const mineVisible = mine ? mine.rank <= 3 || listed.some((r) => r.userId === mine.userId) : true
  const hasMore = !q && rows.length > 3 + visible

  return (
    <div className="flex flex-col gap-4">
      <PeriodBar period={period} setPeriod={setPeriod} counts={counts} countdown={countdown} />

      <StatusCard
        signedIn={signedIn}
        rows={rows}
        meId={meId}
        unit={cat.unit}
        periodNoun={periodMeta.noun}
        countdown={countdown}
        categoryLabel={cat.label}
      />

      <PrizeShowcase prizes={prizes[period]} periodNoun={periodMeta.noun} />

      <section aria-labelledby="tablo-baslik" className="panel-gold flex flex-col overflow-hidden rounded-2xl">
        <header className="flex flex-col gap-3 border-b border-border p-3.5">
          <h2 id="tablo-baslik" className="font-display text-lg font-bold text-foreground">
            {periodMeta.noun} liderleri
          </h2>
          <div role="tablist" aria-label="Kategori" className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 [scrollbar-width:none]">
            {CATEGORIES.map((c) => {
              const Icon = c.icon
              return (
                <button
                  key={c.id}
                  role="tab"
                  type="button"
                  aria-selected={category === c.id}
                  onClick={() => {
                    setCategory(c.id)
                    setVisible(PAGE)
                  }}
                  className={cn(
                    'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                    category === c.id ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className={cn('size-3.5', category === c.id && 'text-primary')} aria-hidden />
                  {c.label}
                </button>
              )
            })}
          </div>
          {rows.length > 3 && (
            <label className="relative flex items-center">
              <span className="sr-only">Kanka ara</span>
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kanka ara"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          )}
        </header>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{cat.empty} İlk sen başla kanka!</p>
            <Link href={cat.cta.href} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground">
              {cat.cta.label}
            </Link>
          </div>
        ) : (
          <>
            {!q && <Podium rows={rows} unit={cat.unit} meId={meId} />}
            {listed.length > 0 ? (
              <ol className={cn(!q && 'border-t border-border')}>
                {listed.map((r) => (
                  <BoardRow key={r.userId} row={r} unit={cat.unit} isMe={r.userId === meId} tip={category === 'tahmin'} />
                ))}
              </ol>
            ) : q ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{`"${query.trim()}" bu tabloda yok.`}</p>
            ) : null}
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE)}
                className="h-11 border-t border-border text-xs font-bold text-primary hover:bg-primary/5"
              >
                Daha fazla göster
              </button>
            )}
            {mine && !mineVisible && (
              <ol
                aria-label="Senin sıran"
                className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 border-t-2 border-primary bg-card shadow-[0_-8px_24px_-12px] shadow-foreground/20 lg:bottom-0"
              >
                <BoardRow row={mine} unit={cat.unit} isMe tip={category === 'tahmin'} sticky />
              </ol>
            )}
          </>
        )}
      </section>
    </div>
  )
}
