'use client'

import Image from 'next/image'
import useSWR from 'swr'
import { cn } from '@/lib/utils'

export const AVATAR_MAP_KEY = '/api/avatars'

export type AvatarFrame = 'altin' | 'elmas' | 'efsane' | 'ozel'
type Looks = { map: Record<string, string>; frames: Record<string, AvatarFrame> }

const NONE: Looks = { map: {}, frames: {} }

const fetchLooks = (url: string): Promise<Looks> =>
  fetch(url)
    .then((r) => (r.ok ? r.json() : NONE))
    .then((d: Partial<Looks>) => ({ map: d.map ?? {}, frames: d.frames ?? {} }))

/** Shared, deduped lookup of every member's chosen avatar and the frame their badges earned. */
function useLooks() {
  const { data } = useSWR<Looks>(AVATAR_MAP_KEY, fetchLooks, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  return data ?? NONE
}

export function useAvatarMap() {
  return useLooks().map
}

export function useFrameMap() {
  return useLooks().frames
}

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[11px]',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-24 text-3xl md:size-28',
} as const

const PX = { xs: 20, sm: 24, md: 36, lg: 48, xl: 112 } as const

const FRAME_NAMES: Record<AvatarFrame, string> = {
  altin: 'Altın rozet çerçevesi',
  elmas: 'Elmas rozet çerçevesi',
  efsane: 'Efsane rozet çerçevesi',
  ozel: 'Özel profil çerçevesi',
}

export const frameName = (frame: AvatarFrame) => FRAME_NAMES[frame]

/**
 * The frame around an avatar. `outside` draws it around the picture instead of over its edge, so a small
 * avatar keeps every pixel of its picture and the frame is still thick enough to be seen; the default sits
 * inside an avatar shell that clips its own edge. `weight` follows the avatar's size.
 */
export function FrameRing({ frame, weight = 'md', outside }: { frame?: AvatarFrame | null; weight?: 'sm' | 'md' | 'lg'; outside?: boolean }) {
  if (!frame) return null
  return (
    <span
      aria-hidden="true"
      data-weight={weight}
      data-frame={frame}
      className={cn(
        'avatar-frame pointer-events-none absolute z-[1]',
        outside ? 'avatar-frame-out rounded-full' : 'inset-0 rounded-[inherit]',
        frame === 'ozel' ? 'avatar-frame-gold' : 'avatar-frame-tier',
      )}
    />
  )
}

export function AvatarFace({
  src,
  name,
  size = 'md',
  className,
  userId,
}: {
  src?: string | null
  name: string
  size?: keyof typeof SIZES
  className?: string
  /** When given, the member's frame is drawn over the avatar. */
  userId?: string | null
}) {
  const frames = useFrameMap()
  const frame = userId ? frames[userId] : null
  return (
    <span className={cn('relative flex shrink-0 rounded-full', SIZES[size], className)}>
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-primary font-display font-bold text-primary-foreground">
        {src ? (
          <Image src={src} alt="" width={PX[size] * 2} height={PX[size] * 2} className="size-full object-cover" />
        ) : (
          <span aria-hidden="true">{name.slice(0, 1).toUpperCase() || '?'}</span>
        )}
      </span>
      <FrameRing frame={frame} weight={size === 'xs' || size === 'sm' ? 'sm' : size === 'xl' ? 'lg' : 'md'} outside />
    </span>
  )
}

/** Fills an existing styled (relative, rounded) avatar shell: the chosen image, or the initial when none. */
export function AvatarFill({ userId, name }: { userId?: string | null; name: string }) {
  const { map, frames } = useLooks()
  const src = userId ? map[userId] : null
  const frame = userId ? frames[userId] : null
  return (
    <>
      {src ? <Image src={src} alt="" fill sizes="96px" className="rounded-[inherit] object-cover" /> : name.charAt(0).toUpperCase() || '?'}
      <FrameRing frame={frame} />
    </>
  )
}

/** A member's avatar resolved from the shared map; falls back to their initial. */
export function MemberAvatar({
  userId,
  name,
  size = 'md',
  className,
}: {
  userId?: string | null
  name: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const map = useAvatarMap()
  return <AvatarFace src={userId ? map[userId] : null} name={name} size={size} className={className} userId={userId} />
}
