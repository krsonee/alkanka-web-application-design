import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Trophy, Users } from 'lucide-react'
import { pageMeta } from '@/lib/seo'
import { getMember } from '@/lib/member'
import { AUTO_LABELS, RULE_FIELDS, badgeHolders, getKpConfig, getKpStatus, listSpecialBadges, levelTier } from '@/lib/kanka-puan'
import { LevelEmblem, SpecialEmblem, TIER_BG, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import { cn } from '@/lib/utils'

export const metadata = pageMeta('rozetler')
export const dynamic = 'force-dynamic'

const TIER_NAMES: Record<string, string> = { bronz: 'Bronz', altin: 'Altın', elmas: 'Elmas', efsane: 'Efsane' }
const TIER_TAGLINE: Record<string, string> = {
  bronz: 'Yolculuk burada başlar. Kalkanını kazan.',
  altin: 'Masanın müdavimi ol, altını hisset.',
  elmas: 'Parlayanlar ligi. Az kişi buraya ulaşır.',
  efsane: 'Altın Papağan’a giden son basamaklar.',
}
const TIER_BAR: Record<string, string> = { bronz: 'bg-bronze', altin: 'bg-gold', elmas: 'bg-accent', efsane: 'bg-ruby' }
const fmt = (n: number) => n.toLocaleString('tr-TR')

export default async function BadgesPage() {
  const member = await getMember()
  const [cfg, specials, holders, me] = await Promise.all([
    getKpConfig(),
    listSpecialBadges(),
    badgeHolders(),
    member ? getKpStatus(member.id) : Promise.resolve(null),
  ])
  const myLevel = me?.level.index ?? -1
  const earnRules = RULE_FIELDS.filter((f) => !f.key.endsWith('Cap') && cfg.rules[f.key] > 0)
  const next = me && cfg.levels[me.level.index + 1]
  const progress = me && next ? Math.min(100, Math.round(((me.kp - me.level.min) / (next.min - me.level.min)) * 100)) : 100
  const myTier = me ? levelTier(me.level.index + 1) : 'altin'

  const groups: { tier: string; items: { l: (typeof cfg.levels)[number]; i: number }[] }[] = []
  cfg.levels.forEach((l, i) => {
    const tier = levelTier(i + 1)
    const g = groups.at(-1)
    if (g && g.tier === tier) g.items.push({ l, i })
    else groups.push({ tier, items: [{ l, i }] })
  })

  return (
    <div className="flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-2xl border border-gold/25 bg-surface">
        <Image
          src="/images/badges/hero-jako-rozet.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 900px, 100vw"
          className="object-cover object-right opacity-90"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-surface via-surface/85 to-transparent" />
        <div className="relative flex min-h-64 flex-col justify-center gap-4 p-6 md:min-h-72 md:max-w-[60%] md:p-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">Kanka Puan · Rozet Salonu</span>
          <h1 className="text-balance font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
            Puan topla, seviye atla, <span className="text-gold">rozetini kap</span>
          </h1>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            {cfg.levels.length} seviye, 4 lig, her birinin kendi amblemi. Şampiyonlara ise elle verilen değerli rozetler var.
          </p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <span key={g.tier} className={cn('inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold', TIER_BG[g.tier], TIER_TEXT[g.tier])}>
                <LevelEmblem level={g.items[0].i + 1} size="xs" />
                {TIER_NAMES[g.tier]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {me ? (
        <Link
          href="/profil"
          className={cn('flex flex-col gap-4 rounded-2xl border p-4 transition-colors hover:border-gold/50 sm:flex-row sm:items-center', TIER_BG[myTier])}
        >
          <LevelEmblem level={me.level.index + 1} size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-baseline gap-2">
                <span className="font-display text-lg font-bold text-foreground">{me.level.name}</span>
                <span className={cn('text-xs font-bold uppercase tracking-wider', TIER_TEXT[myTier])}>
                  {TIER_NAMES[myTier]} · Lv {me.level.index + 1}
                </span>
              </span>
              <span className="font-display text-sm font-bold tabular-nums text-gold">{fmt(me.kp)} KP</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-background/70" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Sonraki seviyeye ilerleme">
              <span className={cn('block h-full rounded-full', TIER_BAR[myTier])} style={{ width: `${progress}%` }} />
            </span>
            <span className="text-xs text-muted-foreground">{next ? `${next.name} için ${fmt(next.min - me.kp)} KP kaldı` : 'Zirvedesin kanka!'}</span>
          </span>
          <ChevronRight className="hidden size-5 text-muted-foreground sm:block" aria-hidden />
        </Link>
      ) : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-foreground">Giriş yap, ilk rozetin <span className="font-bold text-gold">Çaylak</span> hemen senin olsun.</p>
          <a href="#giris" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground">Giriş yap, puan kazan</a>
        </div>
      )}

      <section aria-labelledby="kazan" className="flex flex-col gap-3">
        <h2 id="kazan" className="font-display text-lg font-bold text-foreground">Nasıl KP kazanılır?</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {earnRules.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground">
              {f.label}
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-display text-xs font-bold tabular-nums text-gold">+{cfg.rules[f.key]}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Günde en fazla {cfg.rules.minuteDailyCap} dakika ve {cfg.rules.chatDailyCap} sohbet mesajı puan kazandırır.</p>
      </section>

      <section aria-labelledby="seviyeler" className="flex flex-col gap-4">
        <h2 id="seviyeler" className="font-display text-lg font-bold text-foreground">Seviyeler</h2>
        {groups.map((g) => (
          <article key={g.tier + g.items[0].i} className={cn('overflow-hidden rounded-2xl border', TIER_BG[g.tier])}>
            <header className="relative flex h-28 items-center overflow-hidden md:h-32">
              <Image src={`/images/badges/tier-${g.tier}.png`} alt="" fill sizes="(min-width: 1024px) 900px, 100vw" className="object-cover object-right" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
              <div className="relative flex flex-col gap-1 px-5">
                <span className={cn('font-display text-2xl font-bold', TIER_TEXT[g.tier])}>{TIER_NAMES[g.tier]} Ligi</span>
                <span className="text-xs text-muted-foreground">
                  Lv {g.items[0].i + 1}–{g.items.at(-1)!.i + 1} · {TIER_TAGLINE[g.tier]}
                </span>
              </div>
            </header>
            <ol className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
              {g.items.map(({ l, i }) => {
                const current = i === myLevel
                const locked = member ? i > myLevel : false
                return (
                  <li
                    key={i}
                    className={cn(
                      'relative flex flex-col items-center gap-2 rounded-xl border bg-card/80 px-2 pb-3 pt-4 text-center',
                      current ? 'border-gold ring-2 ring-gold/30' : 'border-border',
                    )}
                  >
                    {current && (
                      <span className="absolute -top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-gold-foreground">Sen</span>
                    )}
                    <LevelEmblem level={i + 1} size="lg" locked={locked} />
                    <span className="flex flex-col">
                      <span className={cn('text-sm font-bold', locked ? 'text-muted-foreground' : 'text-foreground')}>{l.name}</span>
                      <span className="text-[11px] text-muted-foreground">{l.badge}</span>
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 font-display text-[11px] font-bold tabular-nums', locked ? 'bg-muted text-muted-foreground' : cn('bg-background/60', TIER_TEXT[g.tier]))}>
                      {fmt(l.min)} KP
                    </span>
                  </li>
                )
              })}
            </ol>
          </article>
        ))}
      </section>

      <section aria-labelledby="degerli" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="degerli" className="font-display text-lg font-bold text-foreground">Değerli rozetler</h2>
            <p className="text-xs text-muted-foreground">Şampiyonlara verilir, isminin yanında herkes görür.</p>
          </div>
          <Link href="/siralama" className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
            <Trophy className="size-3.5" aria-hidden /> Sıralama ve şampiyonlar <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {specials.map((b) => {
            const owners = holders[b.id] ?? []
            return (
              <li key={b.id} className={cn('flex flex-col gap-3 rounded-2xl border p-4', TIER_BG[b.tier])}>
                <div className="flex items-center gap-4">
                  <SpecialEmblem icon={b.icon} tier={b.tier} size="lg" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={cn('text-[10px] font-bold uppercase tracking-widest', TIER_TEXT[b.tier])}>{TIER_NAMES[b.tier]}</span>
                    <span className="font-display text-base font-bold leading-tight text-foreground">{b.name}</span>
                    {b.bonus > 0 && <span className="font-display text-sm font-bold text-gold">+{fmt(b.bonus)} KP</span>}
                  </div>
                </div>
                <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{b.description}</p>
                {b.auto && <p className="text-[11px] text-muted-foreground">{AUTO_LABELS[b.auto]}</p>}
                <p className="mt-auto flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <Users className="size-3.5 shrink-0" aria-hidden />
                  {owners.length ? (
                    <span className="truncate text-foreground">{owners.map((h) => (h.count > 1 ? `${h.name} ×${h.count}` : h.name)).join(', ')}</span>
                  ) : (
                    'Henüz sahibi yok, ilk sen ol.'
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
