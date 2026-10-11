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
