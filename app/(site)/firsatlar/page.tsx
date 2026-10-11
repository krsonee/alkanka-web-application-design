import Link from 'next/link'
import { PageHero } from '@/components/alkanka/page-hero'
import { DEAL_LABELS, listDeals, type DealKind } from '@/lib/deals'
import { pageMeta } from '@/lib/seo'
import { cn } from '@/lib/utils'

export const metadata = pageMeta('firsatlar')
export const revalidate = 300

const KINDS = Object.keys(DEAL_LABELS) as DealKind[]

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ tur?: string }> }) {
  const { tur } = await searchParams
  const kind = KINDS.includes(tur as DealKind) ? (tur as DealKind) : undefined
  const deals = await listDeals(60, kind)

  return (
    <>
      <PageHero
        eyebrow="Günün fırsatları"
        title="Özel oranlar, promo kodlar ve bonuslar"
        description="Markaların resmi kanallarında yayınlanan güncel fırsatlar, yayınlandığı anda burada. Her gün yenilenir."
        image="/images/heroes/ozel-oranlar.png"
      />
      <nav aria-label="Fırsat türleri" className="flex flex-wrap gap-2">
        <FilterChip href="/firsatlar" active={!kind}>Tümü</FilterChip>
        {KINDS.map((k) => (
          <FilterChip key={k} href={`/firsatlar?tur=${k}`} active={kind === k}>
            {DEAL_LABELS[k]}
          </FilterChip>
        ))}
      </nav>
      {deals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm leading-relaxed text-muted-foreground">
          Şu an listelenecek fırsat yok. Yeni fırsatlar yayınlandıkça burada görünecek.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {deals.map((d) => (
            <li key={d.id}>
              <Link
                href={`/firsatlar/${d.slug}`}
                className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-primary">{DEAL_LABELS[d.kind]}</span>
                  <time dateTime={d.createdAt} className="text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  </time>
                </div>
                <h2 className="text-pretty font-semibold leading-snug text-card-foreground">{d.title}</h2>
                <p className="text-sm text-muted-foreground">{d.brand}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary',
      )}
    >
      {children}
    </Link>
  )
}
