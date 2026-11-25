/*
  The Şans Çarkı backdrop: the empty night terrace with Jako as a separate layer placed by CSS, so one set of clips
  serves every layout.
  - Scene: scene-desktop (2 : 1) and scene-mobile (9 : 16), switched by the stage container's width. Both match the
    stage's own aspect ratio, so the percentages below land on the same spot of the art.
  - Jako: from 600 wide he stands full figure on the terrace floor at the left, with a contact shadow and a floor
    reflection (-webkit-box-reflect; Firefox simply shows none). On phones he is seen from the waist up behind the
    balustrade: the layer is clipped where the parapet wall starts and rail-mobile.webp (the balustrade with the sky
    between its posts cut out) lies over him.
  Layering: scene, sky mist, Jako, phone balustrade, floor mist, wind dust; the wheel and its controls come on top.
*/

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { FloorMist, SkyMist, WindDust } from './ambience'
import { JakoActor, type ActorState } from './jako-actor'

export function StageBackdrop({ state, armed }: { state: ActorState; armed: boolean }) {
  return (
    <>
      <Image
        src="/images/wheel/scene-mobile.webp"
        alt=""
        fill
        sizes="100vw"
        priority
        className="object-cover @min-[600px]:hidden"
      />
      <Image
        src="/images/wheel/scene-desktop.webp"
        alt=""
        fill
        sizes="(min-width: 1280px) 1024px, 100vw"
        priority
        className="hidden object-cover @min-[600px]:block"
      />
      <SkyMist />
      <div
        className={cn(
          'pointer-events-none absolute top-[3.1%] left-[-8%] aspect-[936/816] h-[36.5%]',
          '[clip-path:inset(0_0_28%_0)]',
          '@min-[600px]:top-auto @min-[600px]:bottom-[8.4%] @min-[600px]:left-[-4%] @min-[600px]:h-[73.7%]',
          '@min-[600px]:[clip-path:none]',
          '@min-[600px]:[-webkit-box-reflect:below_-1.1cqw_linear-gradient(transparent_80%,rgb(0_0_0/0.3))]',
        )}
      >
        <span
          aria-hidden="true"
          className="absolute top-[95%] left-[31%] hidden h-[5%] w-[40%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.6),transparent)] @min-[600px]:block"
        />
        <JakoActor state={state} armed={armed} className="absolute inset-0" />
      </div>
      <Image
        src="/images/wheel/rail-mobile.webp"
        alt=""
        width={900}
        height={64}
        className="pointer-events-none absolute inset-x-0 top-[25.34%] h-[4%] w-full @min-[600px]:hidden"
      />
      <FloorMist />
      <WindDust />
    </>
  )
}
