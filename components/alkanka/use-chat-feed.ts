'use client'

import useSWR from 'swr'
import type { ChatFeed, ChatLink } from '@/lib/telegram-chat'

export type ChatResponse = ChatFeed & { me: { loggedIn: boolean; link: ChatLink | null } }

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json() as Promise<ChatResponse>)

export function useChatFeed() {
  return useSWR<ChatResponse>('/api/chat', fetcher, {
    refreshInterval: (data) => (data?.configured ? 3000 : 60000),
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  })
}
