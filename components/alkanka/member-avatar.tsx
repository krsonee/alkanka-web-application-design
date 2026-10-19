'use client'

import Image from 'next/image'
import useSWR from 'swr'
import { cn } from '@/lib/utils'

export const AVATAR_MAP_KEY = '/api/avatars'

const fetchMap = (url: string) =>
  fetch(url)
    .then((r) => (r.ok ? r.json() : { map: {} }))
    .then((d: { map: Record<string, string> }) => d.map ?? {})

/** Shared, deduped lookup of every member's chosen avatar image. */
export function useAvatarMap() {
  const { data } = useSWR<Record<string, string>>(AVATAR_MAP_KEY, fetchMap, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  return data ?? {}
}

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[11px]',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-24 text-3xl md:size-28',
} as const

const PX = { xs: 20, sm: 24, md: 36, lg: 48, xl: 112 } as const

export function AvatarFace({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string | null
  name: string
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-display font-bold text-primary-foreground',
        SIZES[size],
        className,
      )}
    >
      {src ? (
        <Image src={src} alt="" width={PX[size] * 2} height={PX[size] * 2} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase() || '?'}</span>
      )}
    </span>
  )
}

/** Fills an existing styled (relative, rounded) avatar shell: the chosen image, or the initial when none. */
export function AvatarFill({ userId, name }: { userId?: string | null; name: string }) {
  const map = useAvatarMap()
  const src = userId ? map[userId] : null
  if (!src) return <>{name.charAt(0).toUpperCase() || '?'}</>
  return <Image src={src} alt="" fill sizes="96px" className="rounded-[inherit] object-cover" />
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
  return <AvatarFace src={userId ? map[userId] : null} name={name} size={size} className={className} />
}
