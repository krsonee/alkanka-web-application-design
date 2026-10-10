import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { GameStage } from '@/components/alkanka/games/game-stage'

const TITLES = { cark: 'Şans Çarkı', zar: 'Kanka Zarı', sandik: 'Gizemli Sandık' } as const
type GameKey = keyof typeof TITLES

export function generateStaticParams() {
  return Object.keys(TITLES).map((oyun) => ({ oyun }))
}

export async function generateMetadata({ params }: { params: Promise<{ oyun: string }> }): Promise<Metadata> {
  const { oyun } = await params
  return { title: `${TITLES[oyun as GameKey] ?? 'Oyun'} | AL KANKA` }
}

export default async function GamePage({ params }: { params: Promise<{ oyun: string }> }) {
  const { oyun } = await params
  if (!(oyun in TITLES)) notFound()
  const game = oyun as GameKey

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/oyunlar" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tüm oyunlar
        </Link>
        <nav aria-label="Oyun seç" className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(Object.keys(TITLES) as GameKey[]).map((k) => (
            <Link
              key={k}
              href={`/oyunlar/${k}`}
              aria-current={k === game ? 'page' : undefined}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {TITLES[k]}
            </Link>
          ))}
        </nav>
      </div>
      <h1 className="sr-only">{TITLES[game]}</h1>
      <GameStage game={game} />
    </div>
  )
}
