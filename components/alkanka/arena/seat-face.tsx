'use client'

import Image from 'next/image'
import { DEFAULT_AVATARS } from '@/lib/avatars-shared'
import { useAvatarMap } from '../member-avatar'

const BOT_POOL = DEFAULT_AVATARS.filter((a) => a.active).map((a) => a.src)

function hash(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Stable "random" profile picture for a bot, so the same bot keeps its face for the whole table. */
export function botAvatar(seed: string) {
  return BOT_POOL[hash(seed) % BOT_POOL.length]
}

/**
 * Content for an `.okt-av` seat circle: the member's chosen avatar, a seeded random avatar for bots,
 * or the initials when a member has not picked one yet.
 */
export function SeatFace({ userId, botSeed, initials }: { userId?: string | null; botSeed?: string | null; initials: string }) {
  const map = useAvatarMap()
  const src = userId ? map[userId] : botSeed ? botAvatar(botSeed) : null
  if (!src) return <>{initials}</>
  return <Image src={src} alt="" fill sizes="96px" className="okt-av-img" />
}
