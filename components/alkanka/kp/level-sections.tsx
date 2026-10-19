'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, Lock, Target, Users } from 'lucide-react'
import { LevelEmblem, TIER_BG, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import { Modal } from '@/components/alkanka/modal'
import { cn } from '@/lib/utils'
import { TIER_NAMES } from '@/lib/kanka-puan-shared'
const TIER_TAGLINE: Record<string, string> = {
  bronz: 'Yolculuk burada başlar. Kalkanını kazan.',
  altin: 'Masanın müdavimi ol, altını hisset.',
  elmas: 'Parlayanlar ligi. Az kişi buraya ulaşır.',
  efsane: 'Altın Papağan’a giden son basamaklar.',
}
const fmt = (n: number) => n.toLocaleString('tr-TR')

type Level = { name: string; badge: string; min: number }
export type LevelGroup = { tier: string; items: { l: Level; i: number }[] }

function rarity(count: number, total: number) {
  if (!total || count === 0) return 'Henüz kimsede yok'
  if (count <= 10) return `Sadece ${count} kişide`
  const pct = (count / total) * 100
  return `Üyelerin %${pct < 1 ? '<1' : Math.round(pct)}'inde`
}

export function LevelSections({
  groups,
  levels,
  myLevel,
  myKp,
  signedIn,
  reach,
}: {
  groups: LevelGroup[]
  levels: Level[]
  myLevel: number
  myKp: number
  signedIn: boolean
  reach: { total: number; reached: number[] }
}) {
  const [open, setOpen] = useState<number | null>(null)
  const nextIndex = signedIn && myLevel + 1 < levels.length ? myLevel + 1 : -1

  return (
    <section aria-labelledby="seviyeler" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="seviyeler" className="font-display text-lg font-bold text-foreground">Seviyeler</h2>
        <p className="text-xs text-muted-foreground">Bir rozete dokun, nasıl alınır ve kaç kişide var gör.</p>
      </div>
      {groups.map((g) => (
        <TierBlock key={g.tier + g.items[0].i} group={g} myLevel={myLevel} myKp={myKp} signedIn={signedIn} nextIndex={nextIndex} reach={reach} onOpen={setOpen} />
      ))}
      <LevelDetail index={open} onClose={() => setOpen(null)} levels={levels} myLevel={myLevel} myKp={myKp} signedIn={signedIn} reach={reach} />
    </section>
  )
}

function TierBlock({
  group: g,
  myLevel,
  myKp,
  signedIn,
  nextIndex,
  reach,
  onOpen,
}: {
  group: LevelGroup
  myLevel: number
  myKp: number
  signedIn: boolean
  nextIndex: number
  reach: { total: number; reached: number[] }
  onOpen: (i: number) => void
}) {
  const listRef = useRef<HTMLOListElement>(null)
  const focusIndex = g.items.some(({ i }) => i === nextIndex) ? nextIndex : g.items.some(({ i }) => i === myLevel) ? myLevel : -1

  useEffect(() => {
    const list = listRef.current
    if (focusIndex < 0 || !list || list.scrollWidth <= list.clientWidth) return
    const card = list.querySelector<HTMLElement>(`[data-level="${focusIndex}"]`)
    if (card) list.scrollLeft = card.offsetLeft - list.offsetLeft - 40
  }, [focusIndex])

  return (
    <article id={`lig-${g.tier}`} className={cn('scroll-mt-32 overflow-hidden rounded-2xl border', TIER_BG[g.tier])}>
      <header className="relative flex h-20 items-center overflow-hidden sm:h-28 md:h-32">
        <Image src={`/images/badges/tier-${g.tier}.png`} alt="" fill sizes="(min-width: 1024px) 900px, 100vw" className="object-cover object-right" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative flex flex-col gap-1 px-5">
          <span className={cn('font-display text-2xl font-bold', TIER_TEXT[g.tier])}>{TIER_NAMES[g.tier]} Ligi</span>
          <span className="text-xs text-muted-foreground">
            Lv {g.items[0].i + 1}–{g.items.at(-1)!.i + 1} · {TIER_TAGLINE[g.tier]}
          </span>
        </div>
      </header>
      <ol ref={listRef} className="flex snap-x snap-mandatory gap-2 overflow-x-auto p-3 pt-4 no-scrollbar sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
        {g.items.map(({ l, i }) => {
          const current = i === myLevel
          const isNext = i === nextIndex
          const locked = signedIn ? i > myLevel : false
          const left = Math.max(0, l.min - myKp)
          const span = l.min - (g.items.find((x) => x.i === i - 1)?.l.min ?? 0)
          const pct = isNext && span > 0 ? Math.min(100, Math.round(((span - left) / span) * 100)) : 0
          return (
            <li key={i} data-level={i} className="flex w-28 shrink-0 snap-start sm:w-auto">
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`${l.name} rozeti detayları`}
                className={cn(
                  'relative flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 pb-2.5 pt-3 text-center transition-transform active:scale-95 sm:gap-2 sm:pb-3 sm:pt-4',
                  current && 'border-gold bg-card ring-2 ring-gold/30',
                  isNext && 'border-dashed border-gold bg-card shadow-lg shadow-gold/15',
                  !current && !isNext && 'border-border bg-card/80',
                  locked && !isNext && 'opacity-70',
                )}
              >
                {current && <span className="absolute -top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-gold-foreground">Sen</span>}
                {isNext && (
                  <span className="absolute -top-2 inline-flex items-center gap-1 rounded-full border border-gold bg-background px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                    <Target className="size-3" aria-hidden /> Hedef
                  </span>
                )}
                <span className={cn('relative flex rounded-full', isNext && 'animate-badge-pulse')}>
                  <LevelEmblem level={i + 1} size="md" locked={locked && !isNext} className="sm:hidden" />
                  <LevelEmblem level={i + 1} size="lg" locked={locked && !isNext} className="hidden sm:flex" />
                </span>
                <span className="flex flex-col">
                  <span className={cn('text-sm font-bold', locked && !isNext ? 'text-muted-foreground' : 'text-foreground')}>{l.name}</span>
                  <span className="text-[11px] text-muted-foreground">{l.badge}</span>
                </span>
                {isNext ? (
                  <span className="flex w-full flex-col gap-1">
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="font-display text-[11px] font-bold tabular-nums text-gold">{fmt(left)} KP kaldı</span>
                  </span>
                ) : (
                  <span className={cn('rounded-full px-2 py-0.5 font-display text-[11px] font-bold tabular-nums', locked ? 'bg-muted text-muted-foreground' : cn('bg-background/60', TIER_TEXT[g.tier]))}>
                    {fmt(l.min)} KP
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                  <Users className="size-3 shrink-0" aria-hidden />
                  {rarity(reach.reached[i] ?? 0, reach.total)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </article>
  )
}

function LevelDetail({
  index,
  onClose,
  levels,
  myLevel,
  myKp,
  signedIn,
  reach,
}: {
  index: number | null
  onClose: () => void
  levels: Level[]
  myLevel: number
  myKp: number
  signedIn: boolean
  reach: { total: number; reached: number[] }
}) {
  const l = index !== null ? levels[index] : null
  const lv = (index ?? 0) + 1
  const tier = lv <= 5 ? 'bronz' : lv <= 10 ? 'altin' : lv <= 15 ? 'elmas' : 'efsane'
  const owned = signedIn && index !== null && index <= myLevel
  const left = l ? Math.max(0, l.min - myKp) : 0
  const prevMin = index ? levels[index - 1].min : 0
  const pct = l && l.min > prevMin ? Math.min(100, Math.max(0, Math.round(((myKp - prevMin) / (l.min - prevMin)) * 100))) : 100
  const count = index !== null ? reach.reached[index] ?? 0 : 0
  const nextLevel = index !== null ? levels[index + 1] : undefined

  return (
    <Modal open={l !== null} onClose={onClose} title={l ? `${l.name} rozeti` : 'Rozet'} className="mb-0 w-full max-w-md rounded-b-none sm:mb-auto sm:w-[calc(100%-2rem)] sm:rounded-b-2xl">
      {l && (
        <div className="flex flex-col gap-5 p-6 pb-8">
          <div className={cn('flex flex-col items-center gap-3 rounded-2xl border px-4 py-6 text-center', TIER_BG[tier])}>
            <LevelEmblem level={lv} size="xl" locked={signedIn && !owned} />
            <div className="flex flex-col gap-0.5">
              <span className={cn('text-[10px] font-bold uppercase tracking-widest', TIER_TEXT[tier])}>
                {TIER_NAMES[tier]} Ligi · Lv {lv}
              </span>
              <h3 className="font-display text-2xl font-bold text-foreground">{l.name}</h3>
              <span className="text-sm text-muted-foreground">{l.badge} rozeti</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background p-3">
              <dt className="text-[11px] text-muted-foreground">Gereken</dt>
              <dd className="font-display text-base font-bold tabular-nums text-foreground">{fmt(l.min)} KP</dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background p-3">
              <dt className="text-[11px] text-muted-foreground">Sahipleri</dt>
              <dd className="font-display text-base font-bold tabular-nums text-foreground">{fmt(count)} kişi</dd>
            </div>
          </dl>
          <p className="-mt-3 text-center text-xs text-muted-foreground">{rarity(count, reach.total)}</p>

          {signedIn ? (
            owned ? (
              <p className="flex items-center gap-2 rounded-xl bg-gold/10 p-3 text-sm font-semibold text-foreground">
                <Check className="size-4 shrink-0 text-gold" aria-hidden />
                {index === myLevel ? 'Şu an bu rozeti taşıyorsun.' : 'Bu rozeti geçtin, koleksiyonunda.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Lock className="size-3.5 text-muted-foreground" aria-hidden /> {fmt(left)} KP kaldı
                  </span>
                  <span className="font-display text-xs font-bold tabular-nums text-muted-foreground">%{pct}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          ) : null}

          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {fmt(l.min)} Kanka Puanı topladığında rozet kendiliğinden açılır ve isminin yanında herkes görür.
            {nextLevel ? ` Sonraki durak: ${nextLevel.name}.` : ' Bu, yolculuğun son basamağı.'}
          </p>

          {!owned && (
            <a
              href={signedIn ? '#kazan' : '#giris'}
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              {signedIn ? 'KP kazanmaya başla' : 'Giriş yap, puan kazan'}
            </a>
          )}
        </div>
      )}
    </Modal>
  )
}
