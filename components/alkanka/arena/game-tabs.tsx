import Link from 'next/link'

export function GameTabs({ items, current }: { items: { key: string; title: string }[]; current: string }) {
  return (
    <nav
      aria-label="Oyun seç"
      // Phones get one swipeable row (the current game first) so the play button stays on the first screen.
      className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible lg:grid-cols-8"
    >
      {items.map((it) => (
        <Link
          key={it.key}
          href={`/oyunlar/${it.key}`}
          aria-current={it.key === current ? 'page' : undefined}
          className="shrink-0 truncate rounded-md px-3 py-2 text-center text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground max-sm:aria-[current=page]:order-first sm:px-1.5 sm:text-sm"
        >
          {it.title}
        </Link>
      ))}
    </nav>
  )
}
