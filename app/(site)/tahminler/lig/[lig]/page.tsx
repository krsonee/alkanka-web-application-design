import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { LeaguePage, leagueAddress } from '@/components/alkanka/predictions/league-page'
import { allBoards } from '@/components/alkanka/predictions/league-view'
import { leagueOfPath, leaguePath } from '@/lib/record-links'
import { OG_BASE, shareImage } from '@/lib/seo'

export const dynamic = 'force-dynamic'

type Found = { id: number; name: string; open: boolean; special: boolean }

/** The league an address names. The general league always exists; a special one has to be on record. */
const find = cache(async (raw: string): Promise<Found | null> => {
  const id = leagueOfPath(raw)
  if (id === null) return null
  if (id === 0) return { id, name: 'Genel lig', open: true, special: false }
  const board = (await allBoards()).find((b) => b.id === id)
  return board ? { id, name: board.name, open: board.open, special: true } : null
})

export async function generateMetadata({ params }: { params: Promise<{ lig: string }> }): Promise<Metadata> {
  const league = await find((await params).lig).catch(() => null)
  if (!league) return { title: 'Lig bulunamadı', robots: { index: false } }
  const url = leaguePath(league.id, league.name)
  const title = `${league.name} - Tahmin ligi`
  const description = !league.special
    ? 'Genel ligin maçlarını tahmin et, her doğru cevapla puan ve ödül kazan. Puanların haftalık ve aylık lig tablosuna yazılır.'
    : league.open
      ? `${league.name} maçlarını tahmin et, her doğru cevapla puan ve ödül kazan. Ligin kendi puan tablosu ve ödülleri bu sayfada.`
      : `${league.name} sona erdi. Ligin puan tablosu ve kazananları bu sayfada.`
  const image = shareImage('/images/heroes/tahminler.png')
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OG_BASE, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default async function PredictionLeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ lig: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const league = await find((await params).lig)
  if (!league) notFound()
  return <LeaguePage league={league.id} address={leagueAddress(await searchParams)} />
}
