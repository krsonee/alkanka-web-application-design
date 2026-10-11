import type { Metadata } from 'next'
import Link from 'next/link'
import { adminConfigured, isAdmin } from '@/lib/admin-auth'
import { getAllContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { HERO_PAGES, IMAGE_LIBRARY } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'
import { LoginForm, LogoutButton } from '@/components/panel/login-form'
import { ContentEditor } from '@/components/panel/content-editor'
import { LogoEditor } from '@/components/panel/logo-editor'
import { LOGO_SPONSORS, LOGO_TEAMS } from '@/lib/logo-registry'
import { ArenaSettingsEditor } from '@/components/panel/arena-settings-editor'
import { TournamentManager } from '@/components/panel/tournament-manager'
import { mergeArena, type ArenaSettings } from '@/lib/arena'
import { listTournaments } from '@/lib/tournaments'
import { pushStats } from '@/lib/push'
import { PushSender } from '@/components/panel/push-sender'
import { getCronKey, listBots, listLog, listSources, listTargets } from '@/lib/telegram-mirror'
import { TelegramMirror } from '@/components/panel/telegram-mirror'
import { TelegramChatSetup } from '@/components/panel/telegram-chat-setup'
import { chatStatus } from '@/lib/telegram-chat'
import { SeoManager } from '@/components/panel/seo-manager'
import { listPosts } from '@/lib/blog'
import { dealsPublishing, getVerification, listDeals } from '@/lib/deals'
import { SITE_URL } from '@/lib/seo'
import { Studio } from '@/components/panel/studio'
import { CommunityManager } from '@/components/panel/community'
import { adminComplaints, listLeagueMatches, pendingReviews, publishedReviews } from '@/lib/community'
import { SPONSORS } from '@/components/alkanka/data'
import { listAssets, listBrands, listJobs, studioSpend } from '@/lib/studio'
import { KpManager } from '@/components/panel/kp-manager'
import { AdsEditor } from '@/components/panel/ads-editor'
import { ADS_KEY, type AdMap } from '@/lib/ads'
import { ShareEditor } from '@/components/panel/share-editor'
import { MarketManager } from '@/components/panel/market-manager'
import { listProducts, listRequests, pendingCount } from '@/lib/market'
import { SHARE_KEY, type ShareSettings } from '@/lib/share'
import { AUTO_LABELS, getKpConfig, leaderboard, listSpecialBadges, recentAwards } from '@/lib/kanka-puan'

async function marketPanel() {
  try {
    const [products, requests] = await Promise.all([listProducts({ includeInactive: true }), listRequests()])
    return <MarketManager products={products} requests={requests} sponsors={SPONSORS.map((s) => ({ id: s.id, name: s.name }))} />
  } catch (error) {
    console.error('[market-panel]', error)
    return <p className="text-sm text-destructive">Market yüklenemedi.</p>
  }
}

async function kpPanel() {
  try {
    const [cfg, badges, awards, board] = await Promise.all([getKpConfig(), listSpecialBadges({ includeInactive: true }), recentAwards(), leaderboard(50)])
    return <KpManager levels={cfg.levels} rules={cfg.rules} badges={badges} awards={awards} board={board} autoLabels={AUTO_LABELS} />
  } catch (error) {
    console.error('[kp-panel]', error)
    return <p className="text-sm text-destructive">Rozet sistemi yüklenemedi.</p>
  }
}

export const metadata: Metadata = { title: 'Yönetim paneli | AL KANKA', robots: { index: false } }

export default async function PanelPage() {
  if (!(await isAdmin())) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <LoginForm configured={adminConfigured()} />
      </main>
    )
  }

  const content = await getAllContent()
  const push = await pushStats().catch(() => ({ total: 0, members: 0, log: [] }))
  const [tgBots, tgTargets, tgSources, tgLog, cronKey, tgChat] = await Promise.all([
    listBots().catch(() => []),
    listTargets().catch(() => []),
    listSources().catch(() => []),
    listLog().catch(() => []),
    getCronKey().catch(() => 'ANAHTAR'),
    chatStatus().catch(() => null),
  ])
  const siteHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'siteadresin.com'
  const cronUrl = `https://${siteHost}/api/cron/telegram?key=${cronKey}`

  const slides = SLIDES.map((s) => ({
    kind: 'slide' as const,
    id: s.id,
    label: s.eyebrow,
    path: '/',
    defaults: { eyebrow: s.eyebrow, title: s.title, description: s.description, cta: s.cta, image: s.image },
    saved: (content[`slide:${s.id}`] as SlideOverride | undefined) ?? null,
  }))

  const heroes = HERO_PAGES.map((p) => ({
    kind: 'hero' as const,
    id: p.slug,
    label: p.label,
    path: p.path,
    defaults: { title: p.title, image: p.image },
    saved: (content[`hero:${p.slug}`] as HeroOverride | undefined) ?? null,
  }))

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold uppercase tracking-tight text-foreground">AL KANKA panel</span>
            <span className="text-xs text-muted-foreground">Slider ve sayfa başlıklarını düzenle</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary">
              Siteyi aç
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ContentEditor
          slides={slides}
          heroes={heroes}
          library={IMAGE_LIBRARY}
          games={<ArenaSettingsEditor settings={mergeArena(content['arena:settings'] as Partial<ArenaSettings> | undefined)} />}
          tournaments={<TournamentManager tournaments={await listTournaments()} />}
          push={<PushSender {...push} configured={push.total > 0} />}
          telegram={
            <div className="flex flex-col gap-6">
              <TelegramMirror bots={tgBots} targets={tgTargets} sources={tgSources} log={tgLog} cronUrl={cronUrl} />
              <TelegramChatSetup bots={tgBots} status={tgChat} />
            </div>
          }
          studio={
            <Studio
              brands={await listBrands().catch(() => [])}
              assets={await listAssets().catch(() => [])}
              jobs={await listJobs().catch(() => [])}
              spend={await studioSpend().catch(() => ({ total: 0, month: 0, count: 0 }))}
            />
          }
          community={
            <CommunityManager
              reviews={await pendingReviews().catch(() => [])}
              published={await publishedReviews().catch(() => [])}
              complaints={await adminComplaints().catch(() => [])}
              matches={await listLeagueMatches(null, { admin: true }).catch(() => [])}
              siteNames={Object.fromEntries(SPONSORS.map((s) => [s.id, s.name]))}
            />
          }
          badges={await kpPanel()}
          market={await marketPanel()}
          marketPending={await pendingCount().catch(() => 0)}
          seo={
            <SeoManager
              posts={await listPosts({ includeDrafts: true })}
              deals={await listDeals(30)}
              publishing={await dealsPublishing()}
              verification={await getVerification().catch(() => ({ google: '', bing: '', yandex: '' }))}
              siteUrl={SITE_URL}
            />
          }
          logos={
            <>
              <ShareEditor saved={(content[SHARE_KEY] as ShareSettings | undefined) ?? {}} />
              <AdsEditor saved={(content[ADS_KEY] as AdMap | undefined) ?? {}} />
              <LogoEditor
                kind="sponsors"
                title={`Site logoları (${LOGO_SPONSORS.length})`}
                hint="Sponsor kartlarında baş harflerin yerine görünür. Kare ya da şeffaf PNG/SVG logo linki yapıştır."
                items={LOGO_SPONSORS}
                saved={(content['logos:sponsors'] as Record<string, string> | undefined) ?? {}}
              />
              <LogoEditor
                kind="teams"
                title={`Takım logoları (${LOGO_TEAMS.length})`}
                hint="Özel oranlar ve maç tahminlerinde takım adının yanında görünür."
                items={LOGO_TEAMS}
                saved={(content['logos:teams'] as Record<string, string> | undefined) ?? {}}
              />
            </>
          }
        />
      </div>
    </main>
  )
}
