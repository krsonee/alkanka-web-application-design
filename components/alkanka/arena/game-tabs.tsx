import Link from 'next/link'

export function GameTabs({ items, current }: { items: { key: string; title: string }[]; current: string }) {
  return (
    <nav
      aria-label="Oyun seç"
      className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1 min-[420px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-8"
    >
      {items.map((it) => (
        <Link
          key={it.key}
          href={`/oyunlar/${it.key}`}
          aria-current={it.key === current ? 'page' : undefined}
          className="truncate rounded-md px-1.5 py-2 text-center text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground sm:text-sm"
        >
          {it.title}
        </Link>
      ))}
    </nav>
  )
}
