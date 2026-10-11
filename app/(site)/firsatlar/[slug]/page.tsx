import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { DEAL_LABELS, getDeal } from '@/lib/deals'
import { jsonLd, SITE_NAME, SITE_URL } from '@/lib/seo'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const deal = await getDeal((await params).slug)
  if (!deal) return { title: 'Fırsat bulunamadı', robots: { index: false } }
  const description = deal.body.replace(/\s+/g, ' ').slice(0, 155)
  const url = `/firsatlar/${deal.slug}`
  return {
    title: `${deal.brand} ${DEAL_LABELS[deal.kind].toLocaleLowerCase('tr-TR')}: ${deal.title}`.slice(0, 70),
    description,
    alternates: { canonical: url },
    openGraph: { title: deal.title, description, url, images: deal.photo ? [deal.photo] : undefined },
  }
}

export default async function DealPage({ params }: { params: Promise<{ slug: string }> }) {
  const deal = await getDeal((await params).slug)
  if (!deal) notFound()

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: deal.title,
    datePublished: deal.createdAt,
    image: deal.photo ?? `${SITE_URL}/images/og.png`,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <Link href="/firsatlar" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tüm fırsatlar
      </Link>
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">
          {deal.brand} · {DEAL_LABELS[deal.kind]}
        </p>
        <h1 className="text-balance text-2xl font-bold leading-tight text-foreground md:text-3xl">{deal.title}</h1>
        <time dateTime={deal.createdAt} className="text-sm text-muted-foreground">
          {new Date(deal.createdAt).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}
        </time>
      </header>
      {deal.photo && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Telegram CDN image with unknown dimensions
        <img src={deal.photo} alt={deal.title} className="w-full rounded-2xl border border-border" />
      )}
      <div className="whitespace-pre-line rounded-2xl border border-border bg-card p-5 leading-relaxed text-card-foreground">
        {deal.body}
      </div>
      <a
        href={deal.link}
        target="_blank"
        rel="noopener sponsored"
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
      >
        Fırsata git
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </article>
  )
}
