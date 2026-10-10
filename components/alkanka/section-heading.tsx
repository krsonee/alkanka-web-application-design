import type { ReactNode } from 'react'

export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  action,
}: {
  eyebrow: string
  title: ReactNode
  description?: string
  id?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{eyebrow}</span>
        <h2 id={id} className="font-display text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
          {title}
        </h2>
        {description && <p className="leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
