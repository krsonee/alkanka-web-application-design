import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getContent } from '@/lib/content'
import { renderLegalBody } from '@/lib/legal-render'
import { LEGAL_DEFAULTS, LEGAL_KEY, isLegalSlug, mergeLegal, type LegalOverrides } from '@/lib/legal-shared'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function loadDocs() {
  return mergeLegal(await getContent<LegalOverrides>(LEGAL_KEY).catch(() => null))
}

export async function generateMetadata({ params }: { params: Promise<{ sayfa: string }> }): Promise<Metadata> {
  const { sayfa } = await params
  const doc = LEGAL_DEFAULTS.find((d) => d.slug === sayfa)
  if (!doc) return {}
  return { title: doc.title, description: doc.summary, alternates: { canonical: `/yasal/${doc.slug}` } }
}

const renderBody = renderLegalBody

export default async function LegalPage({ params }: { params: Promise<{ sayfa: string }> }) {
  const { sayfa } = await params
  if (!isLegalSlug(sayfa)) notFound()
  const docs = await loadDocs()
  const doc = docs.find((d) => d.slug === sayfa)!
  return (
    <div className="flex flex-col gap-6 py-6 lg:flex-row lg:items-start">
      <nav aria-label="Yasal sayfalar" className="flex gap-2 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col">
        {docs.map((d) => (
          <Link
            key={d.slug}
            href={`/yasal/${d.slug}`}
            aria-current={d.slug === sayfa ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              d.slug === sayfa ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {d.title}
          </Link>
        ))}
      </nav>
      <article className="panel-gold flex min-w-0 flex-1 flex-col gap-4 rounded-2xl p-5 text-sm leading-relaxed text-muted-foreground sm:p-8">
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Yasal</span>
          <h1 className="font-display text-2xl font-bold text-foreground text-balance sm:text-3xl">{doc.title}</h1>
          <p>{doc.summary}</p>
        </header>
        {renderBody(doc.body)}
      </article>
    </div>
  )
}
