import Image from 'next/image'
import { cn } from '@/lib/utils'

type TableBrandProps = {
  className?: string
  /** Engraved logo + wordmark in the middle of the felt. */
  center?: boolean
  /** Brass "ALKANKA" plaque on the rail. */
  plaque?: 'top' | 'bottom' | 'left' | false
  /** Small logo stamps in the corners. */
  corners?: boolean
  /** Jako peeking from the bottom-right corner. */
  jako?: boolean
}

/**
 * House branding printed on every game table — "the devil is in the details":
 * a faint engraved emblem in the felt, a brass plaque on the rail and tiny
 * logo stamps in the corners. Purely decorative and never blocks input.
 * Add it as the first child of any new game's `relative` table surface.
 */
export function TableBrand({ className, center = true, plaque = 'top', corners = true, jako = true }: TableBrandProps) {
  return (
    <div data-game-table className={cn('pointer-events-none absolute inset-0 select-none overflow-hidden', className)} aria-hidden="true">
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-[0.09]">
          <div className="relative flex size-28 items-center justify-center rounded-full border-2 border-primary sm:size-40">
            <span className="absolute inset-2 rounded-full border border-dashed border-primary" />
            <Image src="/icon-192.png" alt="" width={192} height={192} className="size-16 rounded-full grayscale sm:size-24" />
          </div>
          <span className="font-display text-2xl font-bold uppercase tracking-[0.45em] text-primary sm:text-4xl">Alkanka</span>
        </div>
      )}

      {plaque && (
        <span
          className={cn(
            'absolute flex items-center gap-1 from-primary/75 to-primary/45 font-display text-[8px] font-bold uppercase tracking-[0.35em] text-primary-foreground shadow-md sm:text-[9px]',
            plaque === 'left'
              ? 'left-0 top-1/2 -translate-y-1/2 rounded-r-md bg-gradient-to-r px-px py-2.5 [writing-mode:vertical-rl]'
              : 'left-1/2 -translate-x-1/2 bg-gradient-to-b px-2.5 py-px',
            plaque === 'top' ? 'top-0 rounded-b-md' : plaque === 'bottom' && 'bottom-0 rounded-t-md',
          )}
        >
          <Image src="/icon-192.png" alt="" width={24} height={24} className="size-2.5 rounded-full sm:size-3" />
          Alkanka
        </span>
      )}

      {corners && (
        <>
          <Image src="/icon-192.png" alt="" width={48} height={48} className="absolute left-2 top-2 size-5 rounded-full opacity-20 sm:size-6" />
          <span className="absolute bottom-2 left-2 font-display text-[7px] font-bold uppercase tracking-[0.3em] text-foreground/15 sm:text-[8px]">
            Alkanka Club
          </span>
          {!jako && <Image src="/icon-192.png" alt="" width={48} height={48} className="absolute bottom-2 right-2 size-5 rounded-full opacity-20 sm:size-6" />}
        </>
      )}

      {jako && (
        <Image
          src="/images/mascots/jako.png"
          alt=""
          width={96}
          height={96}
          className="absolute bottom-1 right-1 size-10 object-contain opacity-25 sm:size-14"
        />
      )}
    </div>
  )
}
