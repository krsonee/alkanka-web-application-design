import { getPageAds, type AdPage, type AdSlot } from '@/lib/ads'
import { cn } from '@/lib/utils'

function AdBox({ slot, label, className }: { slot?: AdSlot; label: string; className?: string }) {
  if (!slot?.image) return null
  return (
    <a
      href={slot.href || '#'}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={cn('group relative block overflow-hidden rounded-xl border border-border bg-card', className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ad creatives (often animated GIFs) are set in the panel from any https host */}
      <img src={slot.image} alt={slot.alt || label} className="size-full object-cover" loading="lazy" />
      <span className="absolute top-1.5 right-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        Reklam
      </span>
    </a>
  )
}

export async function AdFrame({ page, children }: { page: AdPage; children: React.ReactNode }) {
  const ads = await getPageAds(page)
  const hasTowers = Boolean(ads.left?.image || ads.right?.image)

  return (
    <div className="flex flex-col gap-6">
      <AdBox slot={ads.top} label="Sponsor banner" className="aspect-[8/1] w-full min-h-16" />
      <div className={cn('flex gap-5', hasTowers && 'xl:items-start')}>
        {ads.left?.image && (
          <aside aria-label="Sponsor reklamı" className="sticky top-20 hidden w-36 shrink-0 xl:block 2xl:w-40">
            <AdBox slot={ads.left} label="Sponsor kule reklamı" className="aspect-[160/600] w-full" />
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        {ads.right?.image && (
          <aside aria-label="Sponsor reklamı" className="sticky top-20 hidden w-36 shrink-0 xl:block 2xl:w-40">
            <AdBox slot={ads.right} label="Sponsor kule reklamı" className="aspect-[160/600] w-full" />
          </aside>
        )}
      </div>
      {hasTowers && (
        <div className="grid grid-cols-2 gap-3 xl:hidden">
          <AdBox slot={ads.left} label="Sponsor reklamı" className="aspect-[4/3] w-full" />
          <AdBox slot={ads.right} label="Sponsor reklamı" className="aspect-[4/3] w-full" />
        </div>
      )}
    </div>
  )
}
