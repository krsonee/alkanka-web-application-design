'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ChevronDown, Clock, Minus, Crown, Dices, Gift, MessageCircle, Search, Share2, Target, UserPlus, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LevelEmblem, RankChip, SpecialEmblem } from './kp/emblem'
import { MemberRank } from './kp/member-rank'
import { jakoSrc } from './jako'
import { Marquee } from './home/marquee'

export type BoardPeriod = 'gun' | 'hafta' | 'ay'
export type KpParts = { time: number; games: number; tasks: number; chat: number; league: number; referrals: number }
export type KpRow = { userId: string; name: string; kp: number; level: number; levelName: string; specials: number; parts: KpParts }
export type TipRow = { userId: string; name: string; points: number; hits: number; exact: number; picks: number }
export type RankMove = number | 'yeni'
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

const CATEGORIES: { id: Category; label: string; short: string; unit: string; icon: typeof Zap; empty: string; cta: { href: string; label: string } }[] = [
  { id: 'kp', label: 'Kanka Puan', short: 'Genel', unit: 'KP', icon: Zap, empty: 'Bu dönem henüz puan toplanmadı.', cta: { href: '/oyunlar', label: 'Oyun oyna' } },
  { id: 'oyun', label: 'Oyunlar', short: 'Oyun', unit: 'KP', icon: Dices, empty: 'Bu dönem kimse oyun ya da görevden puan almadı.', cta: { href: '/oyunlar', label: 'Oyun oyna' } },
  { id: 'tahmin', label: 'Tahmin', short: 'Tahmin', unit: 'puan', icon: Target, empty: 'Bu dönemde sonuçlanan tahmin yok.', cta: { href: '/tahminler', label: 'Tahmin yap' } },
  { id: 'sohbet', label: 'Sohbet', short: 'Sohbet', unit: 'KP', icon: MessageCircle, empty: 'Bu dönem sohbetten puan alan yok.', cta: { href: '/profil', label: 'Telegram bağla' } },
  { id: 'davet', label: 'Davet', short: 'Davet', unit: 'KP', icon: UserPlus, empty: 'Bu dönem davetle puan alan yok.', cta: { href: '/profil', label: 'Davet linkini al' } },
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
        <Marquee
          label={`${periodNoun} ödülleri`}
          duration={Math.max(30, prizes.length * 9)}
          repeat={Math.max(2, Math.ceil(6 / prizes.length))}
          itemClassName="w-72"
        >
          {prizes.map((p) => (
            <div key={p.id} className="flex h-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <SpecialEmblem icon={p.icon} tier={p.tier} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{p.label}</span>
              </span>
              {p.bonus > 0 && (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary tabular-nums">
                  +{fmt(p.bonus)} KP
                </span>
              )}
            </div>
          ))}
        </Marquee>
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
  1: {
    order: 'order-2',
    block: 'h-28 md:h-44 from-primary/45 to-primary/5 border-primary/50',
    cap: 'bg-primary',
    num: 'text-primary',
    avatar: 'size-16 md:size-24 bg-primary text-primary-foreground text-xl md:text-3xl',
    value: 'bg-primary text-primary-foreground',
    delay: 260,
  },
  2: {
    order: 'order-1',
    block: 'h-20 md:h-32 from-foreground/25 to-foreground/[0.03] border-foreground/25',
    cap: 'bg-foreground/70',
    num: 'text-foreground/70',
    avatar: 'size-12 md:size-20 bg-foreground/80 text-background text-base md:text-2xl',
    value: 'bg-foreground/10 text-foreground',
    delay: 120,
  },
  3: {
    order: 'order-3',
    block: 'h-14 md:h-24 from-bronze/40 to-bronze/[0.04] border-bronze/45',
    cap: 'bg-bronze',
    num: 'text-bronze',
    avatar: 'size-12 md:size-20 bg-bronze text-background text-base md:text-2xl',
    value: 'bg-bronze/15 text-bronze',
    delay: 0,
  },
} as const

const SPARKS = [
  { left: '18%', delay: '0s' },
  { left: '50%', delay: '0.8s' },
  { left: '80%', delay: '1.6s' },
]

function Podium({ rows, unit, meId }: { rows: Row[]; unit: string; meId: string | null }) {
  const top = rows.slice(0, 3)
  if (!top.length) return null
  return (
    <div className="relative overflow-hidden">
      <PodiumStage leader={top[0].name} />
    <ol aria-label="İlk üç" className="relative mx-auto grid w-full grid-cols-3 items-end gap-2 px-3 pt-8 md:max-w-2xl md:gap-5 md:px-6 md:pt-14">
      {top.map((u) => {
        const s = PODIUM_STYLE[u.rank as 1 | 2 | 3]
        const first = u.rank === 1
        const isMe = u.userId === meId
        return (
          <li key={u.userId} className={cn('flex min-w-0 flex-col items-center', s.order)}>
            <div className="podium-pop flex w-full min-w-0 flex-col items-center gap-1.5 pb-2.5" style={{ animationDelay: `${s.delay + 350}ms` }}>
              <span className="relative flex items-center justify-center">
                {first && (
                  <>
                    <Crown className="podium-crown absolute -top-6 left-1/2 size-6 fill-primary/30 text-primary md:-top-9 md:size-9" aria-hidden />
                    <span className="podium-halo absolute -inset-1 rounded-full" aria-hidden />
                  </>
                )}
                <span
                  className={cn(
                    'relative flex items-center justify-center rounded-full font-display font-bold ring-2 ring-card',
                    s.avatar,
                    isMe && 'outline outline-2 outline-offset-2 outline-primary',
                  )}
                  aria-hidden
                >
                  {u.name.charAt(0).toUpperCase()}
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-semibold text-foreground md:text-base">
                {u.name}
                {isMe && <span className="text-primary"> (sen)</span>}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 font-display text-xs font-bold tabular-nums md:px-3 md:py-1 md:text-sm', s.value)}>
                {fmt(u.value)} <span className="text-[10px] font-medium opacity-75">{unit}</span>
              </span>
            </div>
            <div
              className={cn('podium-block relative flex w-full justify-center overflow-hidden rounded-t-xl border border-b-0 bg-gradient-to-b', s.block)}
              style={{ animationDelay: `${s.delay}ms` }}
            >
              <span className={cn('absolute inset-x-0 top-0 h-1', s.cap)} aria-hidden />
              {first && (
                <>
                  <span className="tier-shine pointer-events-none absolute inset-0 opacity-40" aria-hidden />
                  {SPARKS.map((sp) => (
                    <span
                      key={sp.left}
                      className="podium-spark absolute bottom-2 size-1 rounded-full bg-primary"
                      style={{ left: sp.left, animationDelay: sp.delay }}
                      aria-hidden
                    />
                  ))}
                </>
              )}
              <span className={cn('relative pt-2 font-display text-3xl font-black leading-none md:pt-4 md:text-5xl', s.num)}>
                <span className="sr-only">Sıra </span>
                {u.rank}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
    </div>
  )
}

const STAGE_COINS = [
  { left: '6%', size: 22, dur: '9s', delay: '0s' },
  { left: '15%', size: 14, dur: '11s', delay: '3s' },
  { left: '24%', size: 18, dur: '10s', delay: '6s' },
  { left: '76%', size: 16, dur: '10.5s', delay: '1.5s' },
  { left: '85%', size: 22, dur: '9.5s', delay: '4.5s' },
  { left: '94%', size: 14, dur: '12s', delay: '7s' },
]

function PodiumStage({ leader }: { leader: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
      <div className="stage-rays absolute left-1/2 top-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-primary/10 to-transparent" />

      {STAGE_COINS.map((c) => (
        <Image
          key={c.left}
          src="/images/mascots/coin.png"
          alt=""
          width={c.size}
          height={c.size}
          className="stage-coin absolute bottom-0 opacity-0"
          style={{ left: c.left, animationDuration: c.dur, animationDelay: c.delay }}
        />
      ))}

      <div className="stage-mascot-in absolute bottom-0 left-[2%] lg:left-[5%] xl:left-[8%]">
        <div className="stage-spot absolute inset-x-0 bottom-0 h-full" />
        <div className="relative size-56 lg:size-64 xl:size-72">
          <Image
            src="/images/mascots/jako-kazandi.png"
            alt=""
            fill
            sizes="288px"
            className="stage-mask object-cover mix-blend-lighten"
          />
        </div>
      </div>

      <div className="stage-mascot-in absolute bottom-0 right-[2%] lg:right-[5%] xl:right-[8%]" style={{ animationDelay: '250ms' }}>
        <div className="stage-bubble absolute -top-4 left-1/2 z-10 w-max max-w-48 -translate-x-1/2 rounded-2xl rounded-bl-sm border border-primary/40 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg">
          <span className="text-primary">{leader}</span> zirvede, yetiş kanka!
        </div>
        <div className="stage-spot absolute inset-x-0 bottom-0 h-full" style={{ animationDelay: '-2.5s' }} />
        <div className="relative size-56 lg:size-64 xl:size-72">
          <Image
            src="/images/mascots/jako-merhaba.png"
            alt=""
            fill
            sizes="288px"
            className="stage-mask object-cover mix-blend-lighten"
          />
        </div>
      </div>
    </div>
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

function MoveMark({ move }: { move: RankMove | undefined }) {
  if (move === undefined) return null
  if (move === 'yeni') {
    return <span className="shrink-0 rounded bg-primary/15 px-1 text-[9px] font-bold uppercase tracking-wide text-primary">Yeni</span>
  }
  if (move === 0) {
    return (
      <span className="flex shrink-0 items-center text-muted-foreground" title="Dünden beri aynı sırada">
        <Minus className="size-3" aria-hidden />
        <span className="sr-only">Sıra değişmedi</span>
      </span>
    )
  }
  const up = move > 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className={cn('flex shrink-0 items-center gap-0.5 text-[11px] font-bold tabular-nums', up ? 'text-live' : 'text-destructive')}
      title={`Dünden beri ${Math.abs(move)} sıra ${up ? 'yükseldi' : 'düştü'}`}
    >
      <Icon className="size-3" aria-hidden />
      {Math.abs(move)}
      <span className="sr-only">{up ? ' sıra yükseldi' : ' sıra düştü'}</span>
    </span>
  )
}

function BoardRow({ row, unit, isMe, tip, sticky, move }: { row: Row; unit: string; isMe: boolean; tip: boolean; sticky?: boolean; move?: RankMove }) {
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
            <MoveMark move={move} />
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
  moves,
  meId,
  signedIn,
  initial,
}: {
  kp: Record<BoardPeriod, KpRow[]>
  tips: Record<BoardPeriod, TipRow[]>
  prizes: Record<BoardPeriod, Prize[]>
  moves: Record<BoardPeriod, Record<string, RankMove>>
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
  const periodMoves: Record<string, RankMove> = category === 'kp' ? moves[period] : {}
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
        <header className="flex flex-col gap-3 border-b border-border p-3.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-5 md:py-4">
          <h2 id="tablo-baslik" className="font-display text-lg font-bold text-foreground md:text-xl">
            {periodMeta.noun} liderleri
          </h2>
          <div role="tablist" aria-label="Kategori" className="relative grid grid-cols-5 rounded-xl bg-secondary p-1 md:w-full md:max-w-lg">
            <span
              className="seg-indicator absolute inset-y-1 left-1 rounded-lg border border-primary/40 bg-card shadow-sm"
              style={{ width: 'calc((100% - 0.5rem) / 5)', transform: `translateX(${CATEGORIES.findIndex((c) => c.id === category) * 100}%)` }}
              aria-hidden
            />
            {CATEGORIES.map((c) => {
              const Icon = c.icon
              const active = category === c.id
              return (
                <button
                  key={c.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-label={c.label}
                  onClick={() => {
                    setCategory(c.id)
                    setVisible(PAGE)
                  }}
                  className={cn(
                    'relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors md:flex-row md:gap-1.5 md:py-2 md:text-xs',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className={cn('size-4 transition-transform', active && 'scale-110 text-primary')} aria-hidden />
                  <span className="w-full truncate px-0.5 text-center md:w-auto">{c.short}</span>
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
            {!q && <Podium key={`${period}-${category}`} rows={rows} unit={cat.unit} meId={meId} />}
            {listed.length > 0 ? (
              <ol className={cn(!q && 'border-t border-border')}>
                {listed.map((r) => (
                  <BoardRow key={r.userId} row={r} unit={cat.unit} isMe={r.userId === meId} tip={category === 'tahmin'} move={periodMoves[r.userId]} />
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
                <BoardRow row={mine} unit={cat.unit} isMe tip={category === 'tahmin'} sticky move={periodMoves[mine.userId]} />
              </ol>
            )}
          </>
        )}
      </section>
    </div>
  )
}
