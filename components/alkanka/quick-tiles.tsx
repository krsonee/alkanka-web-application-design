import Image from 'next/image'
import { QUICK_TILES } from './data'

export function QuickTiles() {
  return (
    <nav aria-label="Hızlı erişim">
      <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 xl:grid-cols-6">
        {QUICK_TILES.map((tile) => (
          <li key={tile.id} className="w-28 shrink-0 snap-start sm:w-auto">
            <a
              href={tile.href}
              data-tour={`tile-${tile.id}`}
              aria-label={tile.cta}
              className="panel-gold group flex h-full items-center gap-2.5 rounded-xl p-2 transition-all hover:-translate-y-0.5 hover:glow-gold max-sm:flex-col max-sm:gap-1.5"
            >
              <span className="relative block size-12 shrink-0 overflow-hidden rounded-lg max-sm:aspect-[16/10] max-sm:h-auto max-sm:w-full">
                <Image
                  src={tile.image}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 48px, 112px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </span>
              <span className="truncate font-display text-sm font-bold text-foreground">{tile.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
