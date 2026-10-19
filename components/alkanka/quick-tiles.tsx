import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { QUICK_TILES } from './data'

export function QuickTiles() {
  return (
    <nav aria-label="Hızlı erişim">
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 py-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 xl:grid-cols-6">
        {QUICK_TILES.map((tile, i) => (
          <li key={tile.id} className="w-32 shrink-0 snap-start sm:w-auto">
            <a
              href={tile.href}
              data-tour={`tile-${tile.id}`}
              aria-label={tile.cta}
              style={{ '--flow-delay': `${-i * 1.1}s`, '--flow-opacity': 0.55 } as React.CSSProperties}
              className="border-flow group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-card ring-1 ring-primary/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_var(--primary)] sm:aspect-[16/11]"
            >
              <Image
                src={tile.image}
                alt=""
                fill
                sizes="(min-width: 1280px) 220px, (min-width: 640px) 33vw, 128px"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1/2 -translate-x-full bg-gradient-to-r from-transparent via-foreground/15 to-transparent transition-transform duration-700 group-hover:translate-x-[250%]"
              />
              <span className="relative flex items-end justify-between gap-2 p-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-base font-bold text-foreground">{tile.label}</span>
                  <span className="truncate text-xs font-semibold text-primary">{tile.cta}</span>
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/40 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
