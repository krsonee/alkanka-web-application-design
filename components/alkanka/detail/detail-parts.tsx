import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FaqItem } from '../data'
import type { InfoRow, PrizeRow } from '../details'

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Konum">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function DetailHero({
  image,
  chips,
  title,
  subtitle,
  stats,
}: {
  image: string
  chips: { label: string; tone?: 'gold' | 'blue' | 'muted' }[]
  title: string
  subtitle: string
  stats: InfoRow[]
}) {
  return (
    <header className="panel-gold relative overflow-hidden rounded-2xl">
      <div className="relative h-44 sm:h-56">
        <Image src={image || '/placeholder.svg'} alt="" fill priority sizes="(min-width: 1024px) 70vw, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-card/90 to-transparent" />
      </div>
      <div className="relative -mt-24 flex flex-col gap-4 p-5 sm:-mt-28 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c.label}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                c.tone === 'blue' && 'bg-accent text-accent-foreground',
                c.tone === 'muted' && 'bg-background/85 text-foreground',
                (!c.tone || c.tone === 'gold') && 'bg-primary text-primary-foreground',
              )}
            >
              {c.label}
            </span>
          ))}
        </div>
        <div className="flex max-w-2xl flex-col gap-1.5">
          <h1 className="font-display text-3xl font-bold text-balance text-foreground sm:text-4xl">{title}</h1>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">{subtitle}</p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5 bg-card px-4 py-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</dt>
              <dd className="font-display text-sm font-bold text-foreground sm:text-base">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}

export function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  const id = `sec-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="panel-gold flex flex-col gap-4 rounded-2xl p-5">
      <h2 id={id} className="flex items-center gap-2.5 font-display text-lg font-bold text-foreground">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step} className="relative flex gap-4 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-primary/25" />
          )}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-background font-display text-sm font-bold text-primary">
            {i + 1}
          </span>
          <p className="pt-1 text-sm leading-relaxed text-foreground">{step}</p>
        </li>
      ))}
    </ol>
  )
}

export function RuleList({ rules }: { rules: string[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {rules.map((rule) => (
        <li key={rule} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rotate-45 bg-primary" />
          <p className="text-sm leading-relaxed text-muted-foreground">{rule}</p>
        </li>
      ))}
    </ul>
  )
}

export function PrizeTable({ rows, pool }: { rows: PrizeRow[]; pool?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Sıra
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Ödül (kişi başı)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={r.place} className={i === 0 ? 'bg-primary/10' : undefined}>
                <th scope="row" className={cn('px-4 py-3 text-left font-display font-bold', i < 3 ? 'text-primary' : 'text-foreground')}>
                  {r.place}
                </th>
                <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">{r.reward}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pool && <p className="text-xs text-muted-foreground">Toplam ödül havuzu: <span className="font-semibold text-primary">{pool}</span></p>}
    </div>
  )
}

export function InfoList({ rows }: { rows: InfoRow[] }) {
  return (
    <dl className="flex flex-col divide-y divide-border">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-sm text-muted-foreground">{r.label}</dt>
          <dd className="text-right text-sm font-semibold text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DetailFaq({ items }: { items: FaqItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <details key={item.q} className="group rounded-xl border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  )
}

export function RelatedList({
  title,
  items,
}: {
  title: string
  items: { href: string; image: string; eyebrow: string; title: string; meta: string }[]
}) {
  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-4">
      <h2 id="related-title" className="font-display text-xl font-bold text-foreground">
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="panel-gold group flex items-center gap-3 rounded-xl p-3 transition-colors hover:border-primary/50"
            >
              <span className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                <Image src={r.image || '/placeholder.svg'} alt="" fill sizes="56px" className="object-cover" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{r.eyebrow}</span>
                <span className="truncate text-sm font-semibold text-foreground">{r.title}</span>
                <span className="truncate text-xs text-muted-foreground">{r.meta}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DetailLayout({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-20 lg:order-last">{aside}</aside>
    </div>
  )
}
