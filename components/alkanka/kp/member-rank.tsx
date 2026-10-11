'use client'

import useSWR from 'swr'
import { RankChip } from './emblem'

type RanksResponse = { levels: Record<string, number>; names: string[] }

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<RanksResponse>)

export function useRanks() {
  const { data } = useSWR('/api/ranks', fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 })
  return data
}

/** Rank chip for any member, looked up from the shared site-wide level map. New members default to level 1. */
export function MemberRank({ userId, showName, className }: { userId?: string | null; showName?: boolean; className?: string }) {
  const data = useRanks()
  if (!userId || userId.startsWith('bot:') || !data) return null
  const level = data.levels[userId] ?? 1
  return <RankChip level={level} name={data.names[level - 1]} showName={showName} className={className} />
}
