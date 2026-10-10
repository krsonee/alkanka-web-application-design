import Image from 'next/image'
import { cn } from '@/lib/utils'

/** Alkanka watermark printed on every game table, with Jako in the corner. */
export function TableBrand({ className, jako = true }: { className?: string; jako?: boolean }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center', className)} aria-hidden="true">
      <span className="select-none font-display text-5xl font-bold uppercase tracking-[0.3em] text-primary/10 sm:text-7xl">Alkanka</span>
      {jako && (
        <Image
          src="/images/mascots/jako.png"
          alt=""
          width={96}
          height={96}
          className="absolute bottom-2 right-2 size-12 object-contain opacity-30 sm:size-16"
        />
      )}
    </div>
  )
}
