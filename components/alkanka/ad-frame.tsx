import { AD_TOWER_MAX_WIDTH, adDisplaySize, getPageAds, type AdPage, type AdPosition, type AdSlot } from '@/lib/ads'
import { cn } from '@/lib/utils'
import { TrackedAd } from '@/components/alkanka/tracked-ad'

type PageAds = Partial<Record<AdPosition, AdSlot>>

/** A creative is shown at its own size: never cropped or enlarged, only scaled down when the slot is smaller. */
function AdBox({ slot, position, refId, label }: { slot?: AdSlot; position: AdPosition; refId: string; label: string }) {
  if (!slot?.image) return null
  const size = adDisplaySize(position, slot)
  return (
    <TrackedAd
      refId={refId}
      href={slot.href || undefined}
      // A ring instead of a border: a border would take 2px away from the creative.
      className="group relative mx-auto block w-fit max-w-full overflow-hidden rounded-xl bg-card ring-1 ring-border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ad creatives (often animated GIFs) are set in the panel from any https host */}
      <img
        src={slot.image}
        alt={slot.alt || label}
        width={size?.width}
        height={size?.height}
        // Creatives saved before their size was recorded still render at their own size once loaded.
        className={cn('block h-auto max-w-full', !size && 'max-h-[600px] w-auto')}
        loading="lazy"
      />
      <span className="absolute top-1.5 right-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        Reklam
      </span>
    </TrackedAd>
  )
}

function Tower({ slot, position, page }: { slot?: AdSlot; position: 'left' | 'right'; page: AdPage }) {
  if (!slot?.image) return null
  return (
    <aside aria-label="Sponsor reklamı" className="sticky top-20 hidden shrink-0 xl:block" style={{ maxWidth: AD_TOWER_MAX_WIDTH }}>
      <AdBox slot={slot} position={position} refId={`${page}:${position}`} label="Sponsor kule reklamı" />
    </aside>
  )
}

export function AdLayout({ page, ads, children }: { page: AdPage; ads: PageAds; children: React.ReactNode }) {
  const hasTowers = Boolean(ads.left?.image || ads.right?.image)

  return (
    <div className="flex flex-col gap-6">
      <AdBox slot={ads.top} position="top" refId={`${page}:top`} label="Sponsor banner" />
      <div className={cn('flex gap-5', hasTowers && 'xl:items-start')}>
        <Tower slot={ads.left} position="left" page={page} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        <Tower slot={ads.right} position="right" page={page} />
      </div>
      {hasTowers && (
        <div className="grid grid-cols-2 items-start gap-3 xl:hidden">
          <AdBox slot={ads.left} position="left" refId={`${page}:left`} label="Sponsor reklamı" />
          <AdBox slot={ads.right} position="right" refId={`${page}:right`} label="Sponsor reklamı" />
        </div>
      )}
    </div>
  )
}

export async function AdFrame({ page, children }: { page: AdPage; children: React.ReactNode }) {
  return (
    <AdLayout page={page} ads={await getPageAds(page)}>
      {children}
    </AdLayout>
  )
}
