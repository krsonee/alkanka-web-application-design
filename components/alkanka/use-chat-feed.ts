'use client'

import useSWR from 'swr'
import type { ChatFeed, ChatLink } from '@/lib/telegram-chat'
import type { BroadcastSlug, ChannelFeed } from '@/lib/telegram-channels-shared'

export type ChatResponse = ChatFeed & { me: { loggedIn: boolean; link: ChatLink | null; joined: boolean } }

const fetcher = <T,>(url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json() as Promise<T>)

export function useChatFeed(active = true) {
  return useSWR<ChatResponse>('/api/chat', fetcher<ChatResponse>, {
    refreshInterval: (data) => (!active ? 0 : data?.configured ? 3000 : 60000),
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  })
}

export function useChannelFeed(slug: BroadcastSlug | null) {
  return useSWR<ChannelFeed>(slug ? `/api/chat/channel?slug=${slug}` : null, fetcher<ChannelFeed>, {
    refreshInterval: (data) => (data?.configured ? 60000 : 0),
    revalidateOnFocus: true,
    keepPreviousData: false,
  })
}
