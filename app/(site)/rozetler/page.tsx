import Link from 'next/link'
import { ChevronRight, Trophy } from 'lucide-react'
import { pageMeta } from '@/lib/seo'
import { getMember } from '@/lib/member'
import { AUTO_LABELS, RULE_FIELDS, badgeHolders, getKpConfig, getKpStatus, listSpecialBadges, levelTier } from '@/lib/kanka-puan'
import { LevelEmblem, SpecialEmblem, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import { cn } from '@/lib/utils'

export const metadata = pageMeta('rozetler')
export const dynamic = 'force-dynamic'

const TIER_NAMES: Record<string, string> = { bronz: 'Bronz', altin: 'Altın', elmas: 'Elmas', efsane: 'Efsane' }
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

  const groups: { tier: string; items: { l: (typeof cfg.levels)[number]; i: number }[] }[] = []
  cfg.levels.forEach((l, i) => {
    const tier = levelTier(i + 1)
    const g = groups.at(-1)
    if (g && g.tier === tier) g.items.push({ l, i })
    else groups.push({ tier, items: [{ l, i }] })
  })

  return (
    <div className="flex flex-col gap-8">
      <section className="panel-gold flex flex-col gap-4 rounded-xl p-5 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Kanka Puan · Rozetler</span>
          <h1 className="text-balance font-display text-2xl font-bold text-foreground">Puan topla, seviye atla, rozetini kap</h1>
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {cfg.levels.length} seviyenin her birinin kendi amblemi var. Şampiyonlara ise değerli rozetler verilir.
          </p>
        </div>
        {me ? (
          <Link href="/profil" className="flex w-full shrink-0 items-center gap-3 rounded-xl border border-border bg-background p-3 md:w-72">
            <LevelEmblem level={me.level.index + 1} size="md" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-display text-sm font-bold text-foreground">{me.level.name}</span>
                <span className="text-xs tabular-nums text-primary">{fmt(me.kp)} KP</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Sonraki seviyeye ilerleme">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </span>
              <span className="text-[11px] text-muted-foreground">{next ? `${next.name} için ${fmt(next.min - me.kp)} KP kaldı` : 'Zirvedesin kanka!'}</span>
            </span>
          </Link>
        ) : (
          <a href="#giris" className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground">Giriş yap, puan kazan</a>
        )}
      </section>

      <section aria-labelledby="kazan" className="flex flex-col gap-3">
        <h2 id="kazan" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nasıl KP kazanılır?</h2>
        <ul className="flex flex-wrap gap-2">
          {earnRules.map((f) => (
            <li key={f.key} className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3 pr-1.5 text-xs text-foreground">
              {f.label}
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-display font-bold tabular-nums text-primary">+{cfg.rules[f.key]}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">Günde en fazla {cfg.rules.minuteDailyCap} dakika ve {cfg.rules.chatDailyCap} sohbet mesajı puan kazandırır.</p>
      </section>

      <section aria-labelledby="seviyeler" className="flex flex-col gap-3">
        <h2 id="seviyeler" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seviyeler</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.tier + g.items[0].i} className="rounded-xl border border-border bg-card">
              <p className={cn('border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wider', TIER_TEXT[g.tier])}>
                {TIER_NAMES[g.tier]} · Lv {g.items[0].i + 1}–{g.items.at(-1)!.i + 1}
              </p>
              <ol>
                {g.items.map(({ l, i }) => {
                  const current = i === myLevel
                  const locked = member ? i > myLevel : false
                  return (
                    <li key={i} className={cn('flex items-center gap-3 px-3 py-2', current && 'bg-primary/10')}>
                      <LevelEmblem level={i + 1} size="sm" locked={locked} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn('truncate text-sm font-semibold', locked ? 'text-muted-foreground' : 'text-foreground')}>{l.name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{l.badge}</span>
                      </span>
                      {current && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Sen</span>}
                      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmt(l.min)} KP</span>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="degerli" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="degerli" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Değerli rozetler</h2>
          <Link href="/siralama" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <Trophy className="size-3.5" aria-hidden /> Sıralama ve şampiyonlar <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {specials.map((b) => {
            const owners = holders[b.id] ?? []
            return (
              <li key={b.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                <SpecialEmblem icon={b.icon} tier={b.tier} size="md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-sm font-bold text-foreground">{b.name}</span>
                    <span className={cn('shrink-0 text-[10px] font-bold uppercase tracking-wider', TIER_TEXT[b.tier])}>{TIER_NAMES[b.tier]}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{b.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    {b.bonus > 0 && <span className="font-semibold text-primary">+{fmt(b.bonus)} KP</span>}
                    {b.auto && <span>{AUTO_LABELS[b.auto]}</span>}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {owners.length ? <>Sahipleri: <span className="text-foreground">{owners.map((h) => (h.count > 1 ? `${h.name} ×${h.count}` : h.name)).join(', ')}</span></> : 'Henüz sahibi yok, ilk sen ol.'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
