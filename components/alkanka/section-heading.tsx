import type { ReactNode } from 'react'

export function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="font-display text-2xl font-bold uppercase tracking-tight text-primary text-balance sm:text-3xl">
          {title}
        </h2>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function SeeAll({ href, label = 'Tümünü gör' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:self-auto"
    >
      {label}
    </a>
  )
}
