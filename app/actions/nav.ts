'use server'

import { getMember } from '@/lib/member'
import { completedTaskIds, listPublicTasks, taskClaimMap } from '@/lib/tasks'

export type NavSignals = { openTasks: number; tvLive: boolean }

let tvCache: { at: number; live: boolean } | null = null
const TV_CACHE_MS = 2 * 60 * 1000

async function isTvLive() {
  if (tvCache && Date.now() - tvCache.at < TV_CACHE_MS) return tvCache.live
  const { getChannels } = await import('@/lib/kankatv')
  const live = await getChannels()
    .then((channels) => channels.some((c) => c.live))
    .catch(() => tvCache?.live ?? false)
  tvCache = { at: Date.now(), live }
  return live
}

async function countOpenTasks(userId: string) {
  const [tasks, done, claims] = await Promise.all([listPublicTasks(), completedTaskIds(userId), taskClaimMap(userId)])
  const finished = new Set(done)
  return tasks.filter((t) => !finished.has(t.id) && !claims[t.id]).length
}

export async function getNavSignals(): Promise<NavSignals> {
  const member = await getMember().catch(() => null)
  const [tvLive, openTasks] = await Promise.all([
    isTvLive(),
    member ? countOpenTasks(member.id).catch(() => 0) : Promise.resolve(0),
  ])
  return { openTasks, tvLive }
}
