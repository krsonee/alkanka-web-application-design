import Link from 'next/link'
import { ChevronRight, Trophy, Users } from 'lucide-react'
import { pageMeta } from '@/lib/seo'
import { getMember } from '@/lib/member'
import { AUTO_LABELS, badgeHolders, getKpConfig, getKpStatus, getKpToday, levelReach, listSpecialBadges, levelTier } from '@/lib/kanka-puan'
import { LevelEmblem, SpecialEmblem, TIER_BG, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import { ProgressHero } from '@/components/alkanka/kp/progress-hero'
import { EarnActions } from '@/components/alkanka/kp/earn-actions'
import { LevelSections } from '@/components/alkanka/kp/level-sections'
import { TIER_NAMES } from '@/lib/kanka-puan-shared'
import { SocialTaskStrip, type SocialTaskItem } from '@/components/alkanka/kp/social-task-strip'
import { completedTaskIds, listPublicTasks, taskClaimMap } from '@/lib/tasks'
import { isSocialTaskKind } from '@/lib/task-kinds'
import { LevelUpCelebration } from '@/components/alkanka/kp/level-up-celebration'
import { PageHero } from '@/components/alkanka/page-hero'
import { AutoScrollRow } from '@/components/alkanka/auto-scroll-row'
import { cn } from '@/lib/utils'
import { badgeShowcase, getHiddenBadges, getLeagueRivals, getLiveFeed, getStreak, getWeeklyQuest, getWeeklyStar } from '@/lib/kp-extras'
import { HiddenBadges, LiveFeed, StreakCard, WeeklyStarCard } from '@/components/alkanka/kp/extras'
import { LeagueRivals, WeeklyQuestCard } from '@/components/alkanka/kp/quest-rivals'

export const metadata = pageMeta('rozetler')
export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('tr-TR')

async function loadSocialTasks(userId: string | null): Promise<SocialTaskItem[]> {
  try {
    const tasks = (await listPublicTasks()).filter((t) => isSocialTaskKind(t.kind))
    if (!tasks.length) return []
    const [doneIds, claims] = userId ? await Promise.all([completedTaskIds(userId), taskClaimMap(userId)]) : [[], {}]
    const done = new Set(doneIds)
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      param: t.param,
      points: t.points,
      state: done.has(t.id) ? 'done' : (claims as Record<number, string>)[t.id] === 'beklemede' ? 'pending' : 'open',
    }))
  } catch (error) {
    console.error('[rozetler] social tasks', (error as Error).message)
    return []
  }
}

export default async function BadgesPage() {
  const member = await getMember()
  const cfgPromise = getKpConfig()
  const [cfg, specials, holders, me, today, reach, socialTasks] = await Promise.all([
    cfgPromise,
    listSpecialBadges(),
    badgeHolders(),
    member ? getKpStatus(member.id) : Promise.resolve(null),
    member ? getKpToday(member.id).catch(() => null) : Promise.resolve(null),
    cfgPromise.then((c) => levelReach(c.levels.length)).catch(() => ({ total: 0, reached: [] as number[] })),
    loadSocialTasks(member?.id ?? null),
  ])
  const [streak, weekly, feed] = await Promise.all([
    member ? getStreak(member.id).catch(() => null) : Promise.resolve(null),
    getWeeklyStar(member?.id ?? null),
    getLiveFeed(8).catch(() => []),
  ])
  const [hidden, quest, league, showcase] = await Promise.all([
    getHiddenBadges(member?.id ?? null, streak?.best ?? 0).catch(() => []),
    getWeeklyQuest(member?.id ?? null).catch(() => null),
    member ? getLeagueRivals(member.id).catch(() => null) : Promise.resolve(null),
    badgeShowcase(specials).catch(() => null),
  ])
  const myLevel = me?.level.index ?? -1
  const myTier = me ? levelTier(me.level.index + 1) : null
  const heroStats = me
    ? [
        { label: 'Seviyen', value: `${me.level.index + 1}/${cfg.levels.length}` },
        { label: 'Ligin', value: TIER_NAMES[myTier ?? 'bronz'] },
        { label: 'Değerli rozetin', value: String(me.badges.length) },
      ]
    : [
        { label: 'Seviye', value: String(cfg.levels.length) },
        { label: 'Lig', value: '4' },
        { label: 'Değerli rozet', value: String(specials.length) },
      ]

  const groups: { tier: string; items: { l: (typeof cfg.levels)[number]; i: number }[] }[] = []
  cfg.levels.forEach((l, i) => {
    const tier = levelTier(i + 1)
    const g = groups.at(-1)
    if (g && g.tier === tier) g.items.push({ l, i })
    else groups.push({ tier, items: [{ l, i }] })
  })

  return (
    <div className="flex flex-col gap-10">
      <PageHero
        eyebrow="Rozet Salonu"
        title="Puan topla, rozetini kap"
        description={`${cfg.levels.length} seviye, 4 lig, her birinin kendi amblemi. Şampiyonlara ise elle verilen değerli rozetler var.`}
        image="/images/badges/hero-jako-rozet.png"
        stats={heroStats}
      >
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <span key={g.tier} className={cn('inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold', TIER_BG[g.tier], TIER_TEXT[g.tier])}>
                <LevelEmblem level={g.items[0].i + 1} size="xs" />
                {TIER_NAMES[g.tier]}
              </span>
            ))}
          </div>
      </PageHero>

      <nav aria-label="Rozet bölümleri" className="sticky top-16 z-20 -mx-4 -my-4 flex gap-2 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur no-scrollbar sm:hidden">
        {[
          { href: '#kazan', label: 'KP kazan' },
          ...groups.map((g) => ({ href: `#lig-${g.tier}`, label: TIER_NAMES[g.tier] })),
          { href: '#degerli', label: 'Değerli' },
          { href: '#gizli', label: 'Gizli' },
          { href: '#akis', label: 'Akış' },
        ].map((l) => (
          <a key={l.href} href={l.href} className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground">
            {l.label}
          </a>
        ))}
      </nav>

      {me && today ? (
        <ProgressHero me={me} today={today} levels={cfg.levels} rules={cfg.rules} />
      ) : (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-foreground">Giriş yap, ilk rozetin <span className="font-bold text-gold">Çaylak</span> hemen senin olsun.</p>
          <a href="#giris" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground">Giriş yap, puan kazan</a>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {streak && <StreakCard streak={streak} />}
        <WeeklyStarCard star={weekly} />
      </div>

      {quest && <WeeklyQuestCard quest={quest} signedIn={!!member} />}

      {league && league.rivals.length > 1 && <LeagueRivals tier={league.tier} rivals={league.rivals} />}

      <section aria-labelledby="kazan" className="flex scroll-mt-32 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="kazan" className="font-display text-lg font-bold text-foreground">{me ? 'Bugün KP kazan' : 'Nasıl KP kazanılır?'}</h2>
          <p className="text-xs text-muted-foreground">
            Karta dokun, hemen başla. Günde en fazla {cfg.rules.minuteDailyCap} dakika ve {cfg.rules.chatDailyCap} sohbet mesajı sayılır.
          </p>
        </div>
        <EarnActions rules={cfg.rules} today={today?.breakdown ?? null} telegramLinked={(me?.breakdown.telegram ?? 0) > 0} />
        {socialTasks.length ? (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-base font-bold text-foreground">Sosyal görevler</h3>
                <p className="text-xs text-muted-foreground">Hesabını profilinden bağla, görev o hesapla otomatik kontrol edilsin.</p>
              </div>
              <Link href="/profil" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-gold">
                Hesap bağla
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <SocialTaskStrip items={socialTasks} />
          </div>
        ) : null}
      </section>

      <LevelSections groups={groups} levels={cfg.levels} myLevel={myLevel} myKp={me?.kp ?? 0} signedIn={!!member} reach={reach} />

      {member && me && (
        <LevelUpCelebration userId={member.id} level={me.level.index + 1} name={me.level.name} badge={me.level.badge} />
      )}

      <section aria-labelledby="degerli" className="flex scroll-mt-32 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="degerli" className="font-display text-lg font-bold text-foreground">Değerli rozetler</h2>
            <p className="text-xs text-muted-foreground">Şampiyonlara verilir, isminin yanında herkes görür.</p>
          </div>
          <Link href="/siralama" className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
            <Trophy className="size-3.5" aria-hidden /> Sıralama ve şampiyonlar <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <AutoScrollRow label="Değerli rozetler" className="-mx-4 scroll-px-4 gap-3 px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0">
          {specials.map((b) => {
            const owners = holders[b.id] ?? []
            return (
              <li key={b.id} className={cn('flex w-[calc(50%-0.375rem)] shrink-0 snap-start flex-col gap-2 rounded-2xl border p-3 sm:gap-3 sm:p-4 xl:w-[calc((100%-1.5rem)/3)]', TIER_BG[b.tier])}>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <SpecialEmblem icon={b.icon} tier={b.tier} size="md" className="sm:hidden" />
                  <SpecialEmblem icon={b.icon} tier={b.tier} size="lg" className="hidden sm:flex" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1">
                    <span className={cn('text-[10px] font-bold uppercase tracking-widest', TIER_TEXT[b.tier])}>{TIER_NAMES[b.tier]}</span>
                    <span className="font-display text-sm font-bold leading-tight text-foreground sm:text-base">{b.name}</span>
                    {b.bonus > 0 && <span className="font-display text-xs font-bold text-gold sm:text-sm">+{fmt(b.bonus)} KP</span>}
                  </div>
                </div>
                <p className="line-clamp-3 text-pretty text-xs leading-relaxed text-muted-foreground sm:line-clamp-none">{b.description}</p>
                {b.auto && <p className="hidden text-[11px] text-muted-foreground sm:block">{AUTO_LABELS[b.auto]}</p>}
                {showcase?.leaders[b.id] && (
                  <p className="rounded-lg bg-background/70 px-2 py-1.5 text-[11px] leading-snug text-foreground">
                    <span className="font-bold text-gold">Şu an önde:</span> {showcase.leaders[b.id].name} · {showcase.leaders[b.id].detail}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground sm:pt-3">
                  {(showcase?.owners[b.id] ?? []).length ? (
                    <>
                      <span className="flex shrink-0 -space-x-2" aria-hidden>
                        {showcase!.owners[b.id].slice(0, 3).map((o, i) =>
                          o.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={o.image} alt="" className="size-6 rounded-full border-2 border-card object-cover" />
                          ) : (
                            <span key={i} className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-foreground">
                              {o.name.charAt(0).toUpperCase()}
                            </span>
                          ),
                        )}
                      </span>
                      <span className="truncate text-foreground">
                        {showcase!.owners[b.id].map((h) => (h.count > 1 ? `${h.name} ×${h.count}` : h.name)).join(', ')}
                      </span>
                    </>
                  ) : owners.length ? (
                    <>
                      <Users className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate text-foreground">{owners.map((h) => (h.count > 1 ? `${h.name} ×${h.count}` : h.name)).join(', ')}</span>
                    </>
                  ) : (
                    <>
                      <Users className="size-3.5 shrink-0" aria-hidden />
                      Henüz sahibi yok, ilk sen ol.
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </AutoScrollRow>
      </section>

      {hidden.length > 0 && <HiddenBadges badges={hidden} signedIn={!!member} />}

      <LiveFeed items={feed} />
    </div>
  )
}
