import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { QUICK_TILES } from './data'
import { SnapSlider } from './home/snap-slider'

export function QuickTiles() {
  return (
    <nav aria-label="Hızlı erişim">
      <SnapSlider
        label="Hızlı erişim kutuları"
        autoplay={4500}
        itemClassName="w-[40%] sm:w-[calc(25%-0.5625rem)] lg:w-[calc(16.666%-0.625rem)]"
      >
        {QUICK_TILES.map((tile, i) => (
          <a
            key={tile.id}
            href={tile.href}
            data-tour={`tile-${tile.id}`}
            aria-label={tile.cta}
            style={{ '--flow-delay': `${-i * 1.1}s`, '--flow-opacity': 0.55 } as React.CSSProperties}
            className="border-flow group relative flex aspect-[5/4] flex-col justify-end overflow-hidden rounded-xl bg-card ring-1 ring-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-16px_var(--primary)] lg:aspect-[4/3]"
          >
            <Image
              src={tile.image || '/placeholder.svg'}
              alt=""
              fill
              sizes="(min-width: 1024px) 180px, (min-width: 640px) 25vw, 40vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/2 -translate-x-full bg-gradient-to-r from-transparent via-foreground/15 to-transparent transition-transform duration-700 group-hover:translate-x-[250%]"
            />
            <span className="relative flex items-end justify-between gap-1.5 p-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-sm font-bold text-foreground">{tile.label}</span>
                <span className="truncate text-[11px] font-semibold text-primary">{tile.cta}</span>
              </span>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/40 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </span>
            </span>
          </a>
        ))}
      </SnapSlider>
    </nav>
  )
}
