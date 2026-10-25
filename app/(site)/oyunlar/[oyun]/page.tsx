import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'
import { GameStage } from '@/components/alkanka/games/game-stage'
import { ArenaStage } from '@/components/alkanka/arena/arena-stage'
import { GameTabs } from '@/components/alkanka/arena/game-tabs'
import { ARENA_GAMES, ARENA_META, isArenaGame } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'
import { getHidden } from '@/lib/catalog'
import { isHidden } from '@/lib/hidden-shared'

const MINI = { cark: 'Şans Çarkı', sandik: 'Gizemli Sandık', zar: 'Zar At' } as const
type MiniKey = keyof typeof MINI

const TITLES: Record<string, string> = {
  ...Object.fromEntries(ARENA_GAMES.map((g) => [g, ARENA_META[g].title])),
  ...MINI,
}

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(TITLES).map((oyun) => ({ oyun }))
}

export async function generateMetadata({ params }: { params: Promise<{ oyun: string }> }): Promise<Metadata> {
  const { oyun } = await params
  if (!(oyun in TITLES)) notFound()
  return { title: TITLES[oyun] }
}

export default async function GamePage({ params }: { params: Promise<{ oyun: string }> }) {
  const { oyun } = await params
  if (!(oyun in TITLES)) notFound()
  const [settings, hidden] = await Promise.all([getArenaSettings(), getHidden()])
  const isOpen = (k: string) => (isArenaGame(k) ? settings[k].enabled : !isHidden(hidden, 'mini', k))

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link href="/oyunlar" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tüm oyunlar
        </Link>
        <GameTabs
          current={oyun}
          items={Object.keys(TITLES)
            .filter(isOpen)
            .map((k) => ({ key: k, title: TITLES[k] }))}
        />
      </div>
      <h1 className="sr-only">{TITLES[oyun]}</h1>
      {isOpen(oyun) ? (
        isArenaGame(oyun) ? (
          <ArenaStage game={oyun} settings={settings[oyun]} />
        ) : (
          <GameStage game={oyun as MiniKey} />
        )
      ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
            <Lock className="size-8 text-primary" aria-hidden="true" />
            <p className="font-display text-xl font-bold uppercase text-foreground">{TITLES[oyun]} şu an kapalı</p>
            <p className="text-sm text-muted-foreground">Şu an bakımda. Telegram kanalımızdan duyuruları takip et.</p>
          </div>
      )}
    </div>
  )
}
