'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useIdle } from './use-idle'
import type { ChatFeed, ChatLink } from '@/lib/telegram-chat'
import type { BroadcastSlug, ChannelFeed, TelegramAccess } from '@/lib/telegram-channels-shared'

export type ChatResponse = ChatFeed & {
  locked?: boolean
  me: { loggedIn: boolean; link: ChatLink | null; joined: boolean; uncertain?: boolean; mod?: boolean }
}

export const CHAT_FEED_KEY = '/api/chat'
export const channelFeedKey = (slug: BroadcastSlug) => `/api/chat/channel?slug=${slug}`

const fetcher = <T,>(url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json() as Promise<T>)

export function useChatFeed(active = true, { slow = false }: { slow?: boolean } = {}) {
  const idle = useIdle()
  return useSWR<ChatResponse>(CHAT_FEED_KEY, fetcher<ChatResponse>, {
    refreshInterval: (data) =>
      !active ? 0 : !data?.configured ? 60000 : slow ? 30000 : idle ? 20000 : 4000,
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  })
}

export function useChannelFeed(slug: BroadcastSlug | null) {
  return useSWR<ChannelFeed>(slug ? channelFeedKey(slug) : null, fetcher<ChannelFeed>, {
    refreshInterval: (data) => (!data?.configured ? 0 : data.locked ? 30000 : 8000),
    revalidateOnFocus: true,
    keepPreviousData: false,
  })
}

/**
 * Has the server look a person's Telegram link and membership up again, puts the answer on screen at once
 * and hands it back, so whoever asked can say what is still missing. The feed is named by its key rather
 * than by the open tab, so an answer that arrives after a tab change still lands on the feed it belongs to.
 */
export function useAccessRecheck() {
  const { mutate } = useSWRConfig()
  return async (key: string): Promise<TelegramAccess> => {
    const res = await fetch(`${key}${key.includes('?') ? '&' : '?'}taze=1`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Üyelik kontrol edilemedi')
    const feed = (await res.json()) as { me: TelegramAccess }
    await mutate(key, feed, { revalidate: false })
    return feed.me
  }
}
