import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TournamentLive } from '@/components/alkanka/arena/tournament-live'
import { ARENA_META } from '@/lib/arena'
import { recordPath } from '@/lib/record-links'
import { OG_BASE, shareImage } from '@/lib/seo'
import { siteTournaments } from '@/lib/tournaments-site'
import type { Tournament } from '@/lib/tournaments-shared'

export const revalidate = 300

const readList = cache(() => siteTournaments())

async function find(raw: string) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return null
  return (await readList()).find((t) => t.id === id) ?? null
}

const day = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

function summary(t: Tournament) {
  const state = t.status === 'kayit' ? `Kayıtlar açık, başlangıç ${day.format(new Date(t.startsAt))}` : t.status === 'bitti' ? (t.winner ? `Tamamlandı, şampiyon ${t.winner}` : 'Tamamlandı') : 'Devam ediyor'
  return [
    `${ARENA_META[t.game].title} turnuvası`,
    t.prizePool > 0 ? `ödül havuzu ${t.prizePool.toLocaleString('tr-TR')} KC` : '',
    t.entryFee > 0 ? `katılım ${t.entryFee.toLocaleString('tr-TR')} KC` : 'katılım ücretsiz',
    state,
  ]
    .filter(Boolean)
    .join(' · ')
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = await find((await params).id).catch(() => null)
  if (!t) return { title: 'Turnuva bulunamadı', robots: { index: false } }
  const url = recordPath('turnuva', t.id)
  const title = `${t.title} · ${ARENA_META[t.game].title} turnuvası`
  const description = summary(t)
  const image = shareImage('/images/heroes/turnuvalar.png')
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OG_BASE, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await find((await params).id)
  if (!t) notFound()

  return (
    <div className="flex flex-col gap-5">
      <Link href="/turnuvalar" className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-secondary">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tüm turnuvalar
      </Link>
      <h1 className="sr-only">{t.title}</h1>
      <TournamentLive initial={[t]} only={t.id} />
    </div>
  )
}
