import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { LeagueView, leagueMatches, leagueMember } from '@/components/alkanka/predictions/league-view'
import { recordPath } from '@/lib/record-links'
import { OG_BASE, shareImage } from '@/lib/seo'

export const dynamic = 'force-dynamic'

async function find(raw: string) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return null
  const member = await leagueMember()
  return (await leagueMatches(member?.id ?? null)).find((m) => m.id === id) ?? null
}

const day = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await find((await params).id).catch(() => null)
  if (!m) return { title: 'Maç bulunamadı', robots: { index: false } }
  const url = recordPath('tahmin', m.id)
  const title = `${m.home} - ${m.away} tahmini`
  const description = m.settled
    ? `${m.league} · ${m.home} ${m.homeGoals ?? ''} - ${m.awayGoals ?? ''} ${m.away}. Maç sonuçlandı, tahminler puanlandı.`
    : `${m.league} · ${day.format(new Date(m.kickoff))}. Maçın sorularını cevapla, her doğru cevapla puan ve ödül kazan.`
  const image = shareImage('/images/heroes/tahminler.png')
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OG_BASE, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default async function PredictionMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const m = await find((await params).id)
  if (!m) notFound()

  return (
    <div className="flex flex-col gap-5">
      <Link href="/tahminler" className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-secondary">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tahmin ligi
      </Link>
      <h1 className="sr-only">
        {m.home} - {m.away} tahmini
      </h1>
      <LeagueView focus={m.id} />
    </div>
  )
}
