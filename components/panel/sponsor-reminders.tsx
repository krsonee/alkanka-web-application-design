import { useId } from 'react'
import Link from 'next/link'
import { BellRing } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SponsorReminder } from '@/lib/sponsor-reminders'

const LINK_LABEL: Record<SponsorReminder['kind'], string> = { deal: 'Sponsorlara git', earning: 'Hakedişe git', stock: 'Markete git' }

/** `linked` is off where the list already sits on the screen its rows point to. */
export function SponsorReminders({ items, title = 'Sponsor hatırlatmaları', linked = true }: { items: SponsorReminder[]; title?: string; linked?: boolean }) {
  const headingId = useId()
  if (!items.length) return null
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h3 id={headingId} className="flex items-center gap-2 font-semibold text-foreground">
        <BellRing className="size-4 text-primary" aria-hidden="true" />
        {title}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{items.length}</span>
      </h3>
      <ul className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
            <span className={cn('font-semibold', item.urgent ? 'text-destructive' : 'text-foreground')}>{item.title}</span>
            <span className="min-w-0 flex-1 basis-60 leading-relaxed text-muted-foreground text-pretty">{item.text}</span>
            {linked && (
              <Link href={item.href} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {LINK_LABEL[item.kind]}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
