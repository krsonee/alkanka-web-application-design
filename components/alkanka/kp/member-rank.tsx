'use client'

import useSWR from 'swr'
import type { MemberRole } from '@/lib/kanka-puan-shared'
import { cn } from '@/lib/utils'
import { RankChip, RoleChip, TIER_TEXT } from './emblem'

type RanksResponse = { levels: Record<string, number>; names: string[]; roles?: Record<string, MemberRole> }

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

/** Author name that takes the role's colour when the member holds one, so staff stand out in chat. */
export function MemberName({ userId, className, children }: { userId?: string | null; className?: string; children: React.ReactNode }) {
  const data = useRanks()
  const role = userId ? data?.roles?.[userId] : undefined
  return <span className={cn('font-semibold', (role && TIER_TEXT[role.style]) || className)}>{children}</span>
}
