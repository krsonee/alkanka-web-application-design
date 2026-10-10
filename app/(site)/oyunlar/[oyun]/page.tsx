import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'
import { GameStage } from '@/components/alkanka/games/game-stage'
import { ArenaStage } from '@/components/alkanka/arena/arena-stage'
import { ARENA_META, isArenaGame } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'

const MINI = { cark: 'Şans Çarkı', zar: 'Kanka Zarı', sandik: 'Gizemli Sandık' } as const
type MiniKey = keyof typeof MINI

const TITLES: Record<string, string> = {
  ...MINI,
  tavla: ARENA_META.tavla.title,
  okey: ARENA_META.okey.title,
  bilardo: ARENA_META.bilardo.title,
}

export function generateStaticParams() {
  return Object.keys(TITLES).map((oyun) => ({ oyun }))
}

export async function generateMetadata({ params }: { params: Promise<{ oyun: string }> }): Promise<Metadata> {
  const { oyun } = await params
  return { title: `${TITLES[oyun] ?? 'Oyun'} | AL KANKA` }
}

export default async function GamePage({ params }: { params: Promise<{ oyun: string }> }) {
  const { oyun } = await params
  if (!(oyun in TITLES)) notFound()
  const settings = await getArenaSettings()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/oyunlar" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tüm oyunlar
        </Link>
        <nav aria-label="Oyun seç" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
          {Object.keys(TITLES)
            .filter((k) => !isArenaGame(k) || settings[k].enabled)
            .map((k) => (
              <Link
                key={k}
                href={`/oyunlar/${k}`}
                aria-current={k === oyun ? 'page' : undefined}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
              >
                {TITLES[k]}
              </Link>
            ))}
        </nav>
      </div>
      <h1 className="sr-only">{TITLES[oyun]}</h1>
      {isArenaGame(oyun) ? (
        settings[oyun].enabled ? (
          <ArenaStage game={oyun} settings={settings[oyun]} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
            <Lock className="size-8 text-primary" aria-hidden="true" />
            <p className="font-display text-xl font-bold uppercase text-foreground">{TITLES[oyun]} şu an kapalı</p>
            <p className="text-sm text-muted-foreground">Masalar bakımda. Telegram kanalımızdan duyuruları takip et.</p>
          </div>
        )
      ) : (
        <GameStage game={oyun as MiniKey} />
      )}
    </div>
  )
}
