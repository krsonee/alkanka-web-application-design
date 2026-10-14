import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Award, ChevronRight, Gamepad2, Lock, Medal, Star, Trophy, Users } from 'lucide-react'
import { ProfileTabs, PROFILE_TABS, type ProfileTab } from '@/components/alkanka/profile/profile-tabs'
import { SocialAccountsCard, SocialEventsCard } from '@/components/alkanka/profile/social-accounts'
import { getSocialLinks, listSocialEvents, myEntries, mySocialAccounts } from '@/lib/social'
import { myStreams } from '@/lib/member-streams'
import { StreamChannelsCard } from '@/components/alkanka/profile/stream-channels'
import { RANKS } from '@/lib/ranks-shared'
import { getMember, historySummary } from '@/lib/member'
import { SITE_URL } from '@/lib/seo'
import { getKpConfig, getKpStatus, levelTier, type KpBreakdown } from '@/lib/kanka-puan'
import { LevelEmblem, SpecialEmblem, TIER_BG, TIER_TEXT } from '@/components/alkanka/kp/emblem'
import {
  REFERRAL_MIN_GAMES,
  REFERRED_REWARD,
  REFERRER_REWARD,
  alertHits,
  getProfile,
  getRefCode,
  listAlerts,
  listReferrals,
  myComplaints,
  myReviews,
} from '@/lib/community'
import { siteNameLookup, siteOptions } from '@/lib/sites'
import { AlertsCard, ReferralCard } from '@/components/alkanka/community/profile-widgets'
import { AccountSettings } from '@/components/alkanka/profile/account-settings'
import { SponsorAccountsCard } from '@/components/alkanka/growth-widgets'
import { myFollows, mySponsorAccounts } from '@/lib/growth'
import { nextRank, rankForLevel } from '@/lib/ranks-shared'
import { COMPLAINT_STATUS } from '@/components/alkanka/community/labels'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Profilim', robots: { index: false } }
export const dynamic = 'force-dynamic'

const TIER_NAMES: Record<string, string> = { bronz: 'Bronz', altin: 'Altın', elmas: 'Elmas', efsane: 'Efsane' }
const TIER_BAR: Record<string, string> = { bronz: 'bg-bronze', altin: 'bg-gold', elmas: 'bg-accent', efsane: 'bg-ruby' }
const fmt = (n: number) => n.toLocaleString('tr-TR')

const KP_SOURCES: [keyof KpBreakdown, string][] = [
  ['time', 'Sitede süre'],
  ['games', 'Oyunlar'],
  ['tasks', 'Görevler'],
  ['chat', 'Sohbet'],
  ['league', 'Tahmin ligi'],
  ['reviews', 'Yorumlar'],
  ['referrals', 'Davetler'],
  ['telegram', 'Telegram'],
  ['bonus', 'Rozet & sosyal ödüller'],
]

function SectionTitle({ id, children, action }: { id: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 id={id} className="font-display text-lg font-bold text-foreground">{children}</h2>
      {action}
    </div>
  )
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const { sekme } = await searchParams
  const tab: ProfileTab = PROFILE_TABS.some((t) => t.id === sekme) ? (sekme as ProfileTab) : 'genel'
  const member = await getMember()
  if (!member) {
    return (
      <section className="relative mx-auto flex max-w-lg flex-col items-center gap-4 overflow-hidden rounded-2xl border border-gold/25 bg-surface p-8 text-center">
        <Lock className="size-8 text-gold" aria-hidden />
        <h1 className="font-display text-2xl font-bold text-foreground">Profilini görmek için giriş yap</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Seviye, rozetler, davet linki ve oran alarmların burada.</p>
        <a href="#giris" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground">Giriş yap</a>
      </section>
    )
  }

  const [kpStatus, kpConfig, profile, referrals, games] = await Promise.all([
    getKpStatus(member.id),
    getKpConfig(),
    getProfile(member.id),
    listReferrals(member.id),
    historySummary(member.id),
  ])
  const { level, kp } = kpStatus
  const lv = level.index + 1
  const tier = levelTier(lv)
  const winRate = games.played ? Math.round((games.wins / games.played) * 100) : 0

  const stats = [
    { icon: Medal, label: 'Toplam KP', value: fmt(kp) },
    { icon: Trophy, label: 'KP sırası', value: kpStatus.rank ? `#${kpStatus.rank}` : '—' },
    { icon: Gamepad2, label: 'Oyun · Kazanma', value: `${fmt(games.played)} · %${winRate}` },
    { icon: Users, label: 'Davet', value: fmt(referrals.length) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="profil-ad" className={cn('overflow-hidden rounded-2xl border', TIER_BG[tier])}>
        <div className="relative h-36 md:h-44">
          <Image src="/images/badges/profile-cover.png" alt="" fill priority sizes="(min-width: 1024px) 1000px, 100vw" className="object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <Link
            href="/rozetler"
            className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur hover:border-gold/50"
          >
            Tüm seviyeler <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        <div className="relative flex flex-col gap-5 px-5 pb-5 md:flex-row md:items-end md:px-6">
          <div className="-mt-16 shrink-0 rounded-3xl bg-background/80 p-2 backdrop-blur md:-mt-20">
            <LevelEmblem level={lv} size="xl" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className={cn('text-[11px] font-bold uppercase tracking-[0.2em]', TIER_TEXT[tier])}>
              {TIER_NAMES[tier]} Ligi · Seviye {lv}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 id="profil-ad" className="font-display text-3xl font-bold leading-none text-foreground">{member.name}</h1>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', TIER_BG[tier], TIER_TEXT[tier])}>
                <LevelEmblem level={lv} size="chip" />
                {level.name}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Rozetin: <b className="text-foreground">{level.badge}</b></p>
          </div>
          <div className="flex w-full flex-col gap-1.5 md:w-72">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{level.next ? `${level.next.name} seviyesine` : 'En yüksek seviye'}</span>
              <span className="font-display font-bold tabular-nums text-foreground">%{level.progress}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-background/70" role="progressbar" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Sonraki seviye ilerlemesi">
              <div className={cn('h-full rounded-full', TIER_BAR[tier])} style={{ width: `${level.progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {level.next ? `${fmt(level.next.min - kp)} KP kaldı` : 'Zirvedesin kanka!'}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t border-border md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('flex items-center gap-3 px-5 py-4', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border md:border-t-0', i === 2 && 'md:border-l')}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/70 text-gold">
                <s.icon className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col">
                <dt className="truncate text-[11px] text-muted-foreground">{s.label}</dt>
                <dd className="font-display text-base font-bold tabular-nums text-foreground">{s.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <ProfileTabs active={tab} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex min-w-0 flex-col gap-8">
        {tab === 'genel' && <OverviewTab memberId={member.id} kpStatus={kpStatus} rules={kpConfig.rules} referrals={referrals} telegram={profile.stats.telegram} />}
        {tab === 'rozetler' && <BadgesTab kpStatus={kpStatus} badges={profile.badges} />}
        {tab === 'hesaplar' && <AccountsTab memberId={member.id} />}
        {tab === 'ayarlar' && (
          <section aria-labelledby="hesap" className="flex max-w-xl flex-col gap-3">
            <SectionTitle id="hesap">Hesap ayarları</SectionTitle>
            <AccountSettings email={member.email} />
          </section>
        )}
        {tab === 'yorumlar' && <ReviewsTab memberId={member.id} />}
      </div>
    </div>
  )
}

type KpStatus = Awaited<ReturnType<typeof getKpStatus>>
type Referral = Awaited<ReturnType<typeof listReferrals>>[number]

function StatusCard({ levelIndex }: { levelIndex: number }) {
  const rank = rankForLevel(levelIndex)
  const next = nextRank(levelIndex)
  return (
    <section aria-labelledby="statu" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Statün</span>
          <h2 id="statu" className="font-display text-2xl font-bold leading-none text-gold">{rank.name}</h2>
        </div>
        <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold tabular-nums text-gold">
          Davet ödülü x{rank.multiplier}
        </span>
      </div>
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Statü basamakları">
        {RANKS.map((r) => {
          const reached = levelIndex >= r.fromLevel
          const current = r.id === rank.id
          return (
            <li key={r.id} className="flex flex-col gap-1.5" aria-current={current ? 'step' : undefined}>
              <span className={cn('h-1.5 rounded-full', reached ? 'bg-gold' : 'bg-secondary')} />
              <span className={cn('text-[11px] font-semibold', current ? 'text-foreground' : 'text-muted-foreground')}>{r.name}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">Sv. {r.fromLevel + 1}+</span>
            </li>
          )
        })}
      </ol>
      <ul className="flex flex-col gap-1.5 text-sm text-foreground">
        {rank.perks.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <Star className="size-3.5 shrink-0 fill-gold text-gold" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-auto rounded-xl bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
        {next
          ? <>Seviye <b className="text-foreground">{next.fromLevel + 1}</b> olunca <b className="text-gold">{next.name}</b> statüsüne geçersin: {next.perks.join(', ')}.</>
          : 'En yüksek statüdesin kanka. Tüm ayrıcalıklar açık.'}
      </p>
    </section>
  )
}

async function OverviewTab({
  memberId,
  kpStatus,
  rules,
  referrals,
  telegram,
}: {
  memberId: string
  kpStatus: KpStatus
  rules: { minuteDailyCap: number }
  referrals: Referral[]
  telegram: boolean
}) {
  const [code, alerts, hits] = await Promise.all([getRefCode(memberId), listAlerts(memberId), alertHits(memberId)])
  const { breakdown, level } = kpStatus
  const ready = referrals.filter((r) => !r.rewarded && r.games >= REFERRAL_MIN_GAMES).length
  const pending = referrals.filter((r) => !r.rewarded && r.games < REFERRAL_MIN_GAMES).length
  const maxSource = Math.max(1, ...KP_SOURCES.map(([k]) => breakdown[k]))

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="kp-kaynak" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <SectionTitle id="kp-kaynak">KP nereden geldi?</SectionTitle>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {KP_SOURCES.map(([key, label]) => (
              <li key={key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-display font-bold tabular-nums text-foreground">{fmt(breakdown[key])}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${(breakdown[key] / maxSource) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Bugün sitede {kpStatus.todayMinutes} / {rules.minuteDailyCap} dakika puan kazandın.
          </p>
        </section>
        <StatusCard levelIndex={level.index} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReferralCard
          url={`${SITE_URL}/davet/${code}`}
          pending={pending}
          ready={ready}
          reward={REFERRER_REWARD}
          friendReward={REFERRED_REWARD}
          minGames={REFERRAL_MIN_GAMES}
        />
        <AlertsCard alerts={alerts} telegramLinked={telegram} />
      </div>

      {hits.length > 0 && (
        <section aria-labelledby="eslesen" className="flex flex-col gap-3">
          <SectionTitle id="eslesen">Alarmına uyan oranlar</SectionTitle>
          <ul className="grid gap-2 md:grid-cols-2">
            {hits.map((h, i) => (
              <li key={`${h.dealId}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{h.odd.match}</span>
                  <span className="truncate text-xs text-muted-foreground">{h.brand} · {h.odd.market}</span>
                </div>
                <a href={h.link} target="_blank" rel="noopener noreferrer sponsored" className="shrink-0 rounded-lg bg-primary px-3 py-2 font-display text-sm font-bold tabular-nums text-primary-foreground">
                  {h.odd.newOdd.toFixed(2)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {referrals.length > 0 && (
        <section aria-labelledby="davetlerim" className="flex flex-col gap-3">
          <SectionTitle id="davetlerim">Davet ettiklerin</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {referrals.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span className="font-semibold text-foreground">{r.name}</span>
                <span className={r.rewarded ? 'text-gold' : 'text-muted-foreground'}>
                  {r.rewarded ? 'Ödül alındı' : `${Math.min(r.games, REFERRAL_MIN_GAMES)}/${REFERRAL_MIN_GAMES} oyun`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function BadgesTab({ kpStatus, badges }: { kpStatus: KpStatus; badges: Awaited<ReturnType<typeof getProfile>>['badges'] }) {
  const earned = badges.filter((b) => b.earned).length
  return (
    <>
      <section aria-labelledby="degerli" className="flex flex-col gap-3">
        <SectionTitle id="degerli" action={<Link href="/rozetler" className="text-xs font-semibold text-gold hover:underline">Rozet salonu</Link>}>
          Değerli rozetlerin
        </SectionTitle>
        {kpStatus.badges.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {kpStatus.badges.map((b) => (
              <li key={b.id} className={cn('flex items-center gap-4 rounded-2xl border p-4', TIER_BG[b.tier])}>
                <SpecialEmblem icon={b.icon} tier={b.tier} size="lg" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn('text-[10px] font-bold uppercase tracking-widest', TIER_TEXT[b.tier])}>{TIER_NAMES[b.tier]}</span>
                  <span className="font-display text-base font-bold text-foreground">{b.name}{b.count > 1 ? ` ×${b.count}` : ''}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{b.description}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-4">
            <SpecialEmblem icon="trophy" tier="altin" size="md" locked />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Henüz değerli rozetin yok. Tahmin ligi, sohbet yarışması ve turnuvalarda birinci ol, ismin parlasın.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="basarim" className="flex flex-col gap-3">
        <SectionTitle id="basarim" action={<span className="text-xs tabular-nums text-muted-foreground">{earned}/{badges.length}</span>}>
          Başarımlar
        </SectionTitle>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {badges.map((b) => (
            <li key={b.id} className={cn('flex flex-col gap-2 rounded-2xl border p-4', b.earned ? 'border-gold/35 bg-gold/10' : 'border-border bg-card')}>
              <span className={cn('flex size-9 items-center justify-center rounded-full', b.earned ? 'bg-gold text-gold-foreground' : 'bg-muted text-muted-foreground')}>
                {b.earned ? <Award className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              </span>
              <span className={cn('font-display text-sm font-bold', b.earned ? 'text-foreground' : 'text-muted-foreground')}>{b.label}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{b.earned ? 'Kazanıldı' : b.hint}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

async function AccountsTab({ memberId }: { memberId: string }) {
  const [sites, sponsorAccounts, follows, social, links, events, entries, streams] = await Promise.all([
    siteOptions(),
    mySponsorAccounts(memberId).catch(() => []),
    myFollows(memberId).catch(() => [] as string[]),
    mySocialAccounts(memberId).catch(() => []),
    getSocialLinks().catch(() => ({})),
    listSocialEvents().catch(() => []),
    myEntries(memberId).catch(() => []),
    myStreams(memberId).catch(() => []),
  ])
  return (
    <>
      <div id="sponsor-hesaplari" className="grid scroll-mt-24 items-start gap-4 lg:grid-cols-2">
        <SocialAccountsCard accounts={social} links={links} />
        <div className="flex flex-col gap-4">
          <StreamChannelsCard streams={streams} />
          <SponsorAccountsCard accounts={sponsorAccounts} sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
          {follows.length > 0 && (
            <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Adres alarmı açık: <span className="text-foreground">{follows.map((id) => sites.find((s) => s.id === id)?.name ?? id).join(', ')}</span>
            </p>
          )}
        </div>
      </div>
      <SocialEventsCard events={events} entries={entries} accounts={social} />
    </>
  )
}

async function ReviewsTab({ memberId }: { memberId: string }) {
  const [reviews, complaints, siteName] = await Promise.all([myReviews(memberId), myComplaints(memberId), siteNameLookup()])
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <section aria-labelledby="yorumlarim" className="flex flex-col gap-3">
        <SectionTitle id="yorumlarim">Yorumlarım</SectionTitle>
        {reviews.length ? (
          <ul className="flex flex-col gap-2">
            {reviews.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  {siteName(r.siteId)}
                  <span className="flex items-center gap-0.5 text-gold"><Star className="size-3.5 fill-current" aria-hidden />{r.rating}</span>
                </span>
                <span className="text-xs text-muted-foreground">{r.status === 'approved' ? 'Yayında' : r.status === 'pending' ? 'Onay bekliyor' : 'Reddedildi'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Henüz yorum yazmadın. <Link href="/guven" className="font-semibold text-gold underline-offset-4 hover:underline">Güven merkezine git</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="sikayetlerim" className="flex flex-col gap-3">
        <SectionTitle id="sikayetlerim">Şikâyetlerim</SectionTitle>
        {complaints.length ? (
          <ul className="flex flex-col gap-2">
            {complaints.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-semibold text-foreground">{siteName(c.siteId)} · {c.title}</span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', COMPLAINT_STATUS[c.status].className)}>{COMPLAINT_STATUS[c.status].label}</span>
                </div>
                {c.reply && <p className="text-xs leading-relaxed text-muted-foreground">Yanıt: {c.reply}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Açık şikâyetin yok.</p>
        )}
      </section>
    </div>
  )
}
