import Image, { getImageProps } from 'next/image'
import { cn } from '@/lib/utils'

type Props = { image: string; mobileImage?: string; priority?: boolean; sizes: string; className?: string }

/** A slide with its own phone image swaps sources at the `sm` breakpoint, so a phone never downloads the wide one. */
export function SlidePicture({ image, mobileImage, priority = false, sizes, className }: Props) {
  const wide = image || '/placeholder.svg'
  if (!mobileImage) return <Image src={wide} alt="" fill draggable={false} priority={priority} sizes={sizes} className={className} />
  const common = { alt: '', fill: true, priority }
  const desktop = getImageProps({ ...common, src: wide, sizes }).props
  const phone = getImageProps({ ...common, src: mobileImage, sizes: '100vw' }).props
  // `images.unoptimized` leaves srcSet empty; a <source> without one is skipped and the phone image would show everywhere.
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={desktop.srcSet ?? desktop.src} sizes={desktop.srcSet ? sizes : undefined} />
      <img {...phone} alt="" draggable={false} className={className} />
    </picture>
  )
}

/**
 * A banner that carries its own words fills its positioned parent whole: it is never cropped, and whatever
 * the box has left over is filled with a soft copy of the same picture instead of empty bars.
 *
 * The narrow picture is chosen by the width of the box, not of the screen: with the chat panel open a desktop
 * slider is as close to a square as a phone's. A wide box keeps the banner at the top, clear of the slide
 * buttons along its bottom edge; a narrow one centres it.
 */
export function PlainBanner({ image, mobileImage, priority = false, sizes, anchor = 'top' }: Omit<Props, 'className'> & { anchor?: 'top' | 'center' }) {
  const wide = image || '/placeholder.svg'
  const pictures = (className: string, eager: boolean) =>
    mobileImage ? (
      <>
        <Image src={wide} alt="" fill draggable={false} sizes={sizes} className={cn(className, '@max-xl:hidden')} />
        <Image src={mobileImage} alt="" fill draggable={false} sizes={sizes} className={cn(className, '@xl:hidden')} />
      </>
    ) : (
      <Image src={wide} alt="" fill draggable={false} priority={eager} sizes={sizes} className={className} />
    )
  return (
    <span className="@container absolute inset-0 block overflow-hidden bg-background">
      {pictures('pointer-events-none scale-125 object-cover opacity-45 blur-2xl', false)}
      {pictures(cn('pointer-events-none object-contain object-center', anchor === 'top' && '@xl:object-top'), priority)}
    </span>
  )
}
