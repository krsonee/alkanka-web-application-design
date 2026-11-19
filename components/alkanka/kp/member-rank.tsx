'use client'

import useSWR from 'swr'
import type { MemberRole } from '@/lib/kanka-puan-shared'
import { cn } from '@/lib/utils'
import { RankChip, RoleChip, SpecialEmblem, TIER_TEXT } from './emblem'

type RanksResponse = { levels: Record<string, number>; names: string[]; roles?: Record<string, MemberRole>; badges?: Record<string, MemberRole> }

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<RanksResponse>)

export function useRanks() {
  const { data } = useSWR('/api/ranks', fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 })
  return data
}

/** Rank chip for any member, looked up from the shared site-wide level map. Role holders show their role instead; new members default to level 1. */
export function MemberRank({ userId, showName, className }: { userId?: string | null; showName?: boolean; className?: string }) {
  const data = useRanks()
  if (!userId || userId.startsWith('bot:') || !data) return null
  const role = data.roles?.[userId]
  if (role) return <RoleChip name={role.name} style={role.style} icon={role.icon} className={className} />
  const level = data.levels[userId] ?? 1
  return <RankChip level={level} name={data.names[level - 1]} showName={showName} className={className} />
}

/** The badge a member wears, as a small medallion beside the name. Role holders already carry their role chip, so they get none. */
export function MemberBadge({ userId, className }: { userId?: string | null; className?: string }) {
  const data = useRanks()
  if (!userId || !data || data.roles?.[userId]) return null
  const badge = data.badges?.[userId]
  if (!badge) return null
  return (
    <span className={cn('inline-flex shrink-0 align-middle', className)} title={`${badge.name} rozeti`}>
      <SpecialEmblem icon={badge.icon} tier={badge.style} size="chip" />
      <span className="sr-only">{`${badge.name} rozeti`}</span>
    </span>
  )
}

/** Author name in the colour of the member's role, or of the badge they wear, so both stand out in chat. */
export function MemberName({ userId, className, children }: { userId?: string | null; className?: string; children: React.ReactNode }) {
  const data = useRanks()
  const mark = userId ? (data?.roles?.[userId] ?? data?.badges?.[userId]) : undefined
  return <span className={cn('font-semibold', (mark && TIER_TEXT[mark.style]) || className)}>{children}</span>
}
