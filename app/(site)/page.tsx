import { BannerCarousel } from '@/components/alkanka/banner-carousel'
import { QuickTiles } from '@/components/alkanka/quick-tiles'
import { EndingCampaigns, FeaturedSponsors } from '@/components/alkanka/partner-sites'
import { TopThree } from '@/components/alkanka/top-three'
import { GuestHero, MarketShowcase, MemberHub, type HubData } from '@/components/alkanka/home/home-hub'
import { SLIDES, TELEGRAM_URL } from '@/components/alkanka/data'
import { CUSTOM_SLIDES_KEY, readCustomSlides } from '@/lib/custom-slides'
import { jsonLd, pageMeta, SITE_NAME, SITE_URL } from '@/lib/seo'
import { getAllContent, withoutEmpty, type SlideOverride } from '@/lib/content'
import { listPublicSponsors, pickFeatured } from '@/lib/sites'
import { HIDDEN_KEY, readHidden, withoutHidden } from '@/lib/hidden-shared'
import { getKpConfig, levelFor, readLeaderboard } from '@/lib/kanka-puan'
import { getBalance, getMember, SIGNUP_BONUS, type Member } from '@/lib/member'
import { getSignupBonus } from '@/lib/site-texts'
import { getStreak } from '@/lib/checkin'
import { getSocialLinks, type SocialLinks } from '@/lib/social'
import { completedTaskIds, listPublicTasks } from '@/lib/tasks'
import { getCemberStatus, myCemberStatus } from '@/lib/cember'
import { listProducts, type MarketProduct } from '@/lib/market'
import { EXACT_REWARD, listLeagueMatches, type LeagueMatch } from '@/lib/community'

export const metadata = pageMeta('anasayfa')
export const dynamic = 'force-dynamic'

const MAX_SLIDES = 3

const SITE_LD = [
  { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/app-icon-512.png`, sameAs: [TELEGRAM_URL] },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: 'tr-TR' },
]

function SiteJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(SITE_LD)} />
}

async function loadHub(member: Member, products: MarketProduct[]): Promise<HubData> {
  const [balance, streak, tasks, done, cember, cemberMe, matches] = await Promise.all([
    getBalance(member.id).catch(() => 0),
    getStreak(member.id).catch(() => ({ streak: 0, checkedToday: false })),
    listPublicTasks().catch(() => []),
    completedTaskIds(member.id).catch(() => [] as number[]),
    getCemberStatus().catch(() => null),
    myCemberStatus(member.id).catch(() => null),
    listLeagueMatches(member.id).catch(() => [] as LeagueMatch[]),
  ])
  const now = Date.now()
  const upcoming = matches.filter((m) => !m.settled && new Date(m.kickoff).getTime() > now)
  const match = upcoming.find((m) => !m.myPick) ?? upcoming[0] ?? null
  const daily = tasks.filter((t) => t.period === 'daily')
  const doneSet = new Set(done)
  const byPrice = [...products].sort((a, b) => a.price - b.price)
  const goal = byPrice.find((p) => p.price > balance) ?? byPrice[byPrice.length - 1] ?? null
  return {
    name: member.name.split(' ')[0] || member.name,
    balance,
    streak: streak.streak,
    checkedToday: streak.checkedToday,
    tasksDone: daily.filter((t) => doneSet.has(t.id)).length,
    tasksTotal: daily.length,
    cember,
    cemberMe,
    goal,
    match,
    exactReward: EXACT_REWARD,
  }
}

export default async function HomePage() {
  const [content, sponsors, ranking, member, allProducts, socialLinks] = await Promise.all([
    getAllContent(),
    listPublicSponsors().catch(() => []),
    readLeaderboard(500).catch(() => []),
    getMember().catch(() => null),
    listProducts().catch(() => [] as MarketProduct[]),
    getSocialLinks().catch(() => ({}) as SocialLinks),
  ])
  const products = allProducts.filter((p) => p.active && p.stock > 0)
  const [hub, bonus] = await Promise.all([
    member ? loadHub(member, products) : Promise.resolve(null),
    member ? Promise.resolve(SIGNUP_BONUS) : getSignupBonus().catch(() => SIGNUP_BONUS),
  ])

  const featured = pickFeatured(sponsors)
  const hidden = readHidden(content[HIDDEN_KEY])
  const slides = withoutHidden(SLIDES, hidden, 'slide')
    .map((s) => ({ ...s, ...withoutEmpty(content[`slide:${s.id}`] as SlideOverride | undefined) }))
    .concat(withoutHidden(readCustomSlides(content[CUSTOM_SLIDES_KEY]), hidden, 'slide'))
    .slice(0, MAX_SLIDES)

  const myIndex = member ? ranking.findIndex((r) => r.userId === member.id) : -1
  const me = member && myIndex >= 0 ? { rank: myIndex + 1, points: ranking[myIndex].kp } : null
  const podium = ranking.slice(0, 3).map((row) => ({ userId: row.userId, name: row.name, points: row.kp }))
  const levels = member ? await getKpConfig().then((c) => c.levels).catch(() => []) : []
  const lv = levels.length ? levelFor(levels, me?.points ?? 0) : null
  const level = lv
    ? { number: lv.index + 1, name: lv.name, progress: lv.progress, nextName: lv.next?.name ?? null, kpLeft: lv.next ? Math.max(0, lv.next.min - (me?.points ?? 0)) : 0 }
    : null

  return (
    <>
      <SiteJsonLd />
      <h1 className="sr-only">AL KANKA: sponsorlar, kampanyalar ve ücretsiz mini oyunlar</h1>
      <div className="flex flex-col gap-4">
        {hub ? <MemberHub data={hub} podium={podium} me={me} links={socialLinks} level={level} /> : <GuestHero bonus={bonus} />}
        <QuickTiles />
      </div>
      <BannerCarousel slides={slides} />
      <MarketShowcase products={products.slice(0, 6)} balance={hub?.balance ?? null} />
      <FeaturedSponsors main={featured.main} mains={featured.mains} cards={featured.cards} total={featured.total} />
      <EndingCampaigns />
      {!hub && <TopThree rows={podium} me={me} signedIn={Boolean(member)} />}
    </>
  )
}
