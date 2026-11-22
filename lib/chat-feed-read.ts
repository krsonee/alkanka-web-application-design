import 'server-only'

import { getFeed } from '@/lib/telegram-chat'
import { forgetSharedRead, sharedRead } from '@/lib/shared-read'

const KEY = 'chat-feed'
/** Shorter than the fastest poll (4 s), so nobody sees a message later than they did before. */
const FRESH_MS = 1_000

/** The chat feed as every visitor sees it. One read a second serves everyone polling this server instance. */
export function readChatFeed() {
  return sharedRead(KEY, FRESH_MS, getFeed)
}

/** Call after a message is sent or removed here, so its author sees the change on the very next read. */
export function chatFeedChanged() {
  forgetSharedRead(KEY)
}
