import Link from 'next/link'

export function GameTabs({ items, current }: { items: { key: string; title: string }[]; current: string }) {
  return (
    <nav
      aria-label="Oyun seç"
      className="flex w-full flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
    >
      {items.map((it) => (
        <Link
          key={it.key}
          href={`/oyunlar/${it.key}`}
          aria-current={it.key === current ? 'page' : undefined}
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground sm:text-sm"
        >
          {it.title}
        </Link>
      ))}
    </nav>
  )
}
