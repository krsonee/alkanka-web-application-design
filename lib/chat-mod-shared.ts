export const CHAT_MUTE_OPTIONS = [
  { minutes: 10, label: '10 dakika sustur' },
  { minutes: 60, label: '1 saat sustur' },
  { minutes: 1440, label: '24 saat sustur' },
] as const

export const CHAT_MUTE_MINUTES: readonly number[] = CHAT_MUTE_OPTIONS.map((o) => o.minutes)

export type ChatModAction = 'delete' | 'mute' | 'unmute'

/** The built-in role badge that may moderate the site chat. */
export const CHAT_MOD_ROLE = 'moderator'
