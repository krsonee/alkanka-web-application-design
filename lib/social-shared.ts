export type SocialPlatform = 'x' | 'instagram' | 'youtube' | 'twitch'

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['instagram', 'x', 'youtube', 'twitch']

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  x: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitch: 'Twitch',
}

/** `telegram` and `join` are hub-only links; they are not member-verifiable platforms. */
export type SocialLinks = Partial<Record<SocialPlatform | 'telegram' | 'join', string>>

export const DEFAULT_TELEGRAM_LINK = 'https://t.me/AlkankaOfficial'

/** The join button accepts an internal path ("/kayit") or any https link. */
export const isJoinUrl = (url: string) => /^\/(?!\/)\S*$/.test(url) || /^https:\/\/\S+$/i.test(url)
export const isTelegramUrl = (url: string) => /^https:\/\/(www\.)?(t\.me|telegram\.me)\/\S+$/i.test(url)

/** Fallbacks shown until the admin saves the real profile links in the panel. */
export const DEFAULT_SOCIAL_LINKS: Record<SocialPlatform, string> = {
  x: 'https://x.com/AlkankaOfficial',
  instagram: 'https://www.instagram.com/alkankaofficial',
  youtube: 'https://www.youtube.com/@AlkankaOfficial',
  twitch: 'https://www.twitch.tv/alkankaofficial',
}

export const PLATFORM_SHORT: Record<SocialPlatform, string> = {
  x: 'X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitch: 'Twitch',
}

export type AccountStatus = 'pending' | 'verified' | 'rejected'
export type EntryStatus = 'pending' | 'approved' | 'rejected'

export type SocialAccount = {
  platform: SocialPlatform
  handle: string
  code: string
  status: AccountStatus
  note: string | null
}

export type SocialEvent = {
  id: number
  platform: SocialPlatform
  title: string
  description: string
  postUrl: string
  reward: number
  endsAt: string | null
  active: boolean
  entries: number
}

export type MyEntry = { eventId: number; status: EntryStatus; note: string | null }

export const isPlatform = (v: string): v is SocialPlatform => (SOCIAL_PLATFORMS as string[]).includes(v)

/** Normalises "@Name", profile URLs and stray whitespace into a bare handle. */
export function cleanHandle(platform: SocialPlatform, raw: string) {
  let v = raw.trim()
  v = v.replace(/^https?:\/\/(www\.|m\.)?(x\.com|twitter\.com|instagram\.com|youtube\.com|twitch\.tv)\//i, '')
  v = v.split(/[/?#]/)[0].replace(/^@/, '')
  const pattern =
    platform === 'youtube' ? /^[A-Za-z0-9._-]{3,30}$/
    : platform === 'x' ? /^[A-Za-z0-9_]{3,15}$/
    : platform === 'twitch' ? /^[A-Za-z0-9_]{3,25}$/
    : /^[A-Za-z0-9._]{3,30}$/
  return pattern.test(v) ? v : null
}

export function profileUrl(platform: SocialPlatform, handle: string) {
  if (platform === 'x') return `https://x.com/${handle}`
  if (platform === 'instagram') return `https://www.instagram.com/${handle}/`
  if (platform === 'twitch') return `https://www.twitch.tv/${handle}`
  return `https://www.youtube.com/@${handle}`
}

const HOSTS: Record<SocialPlatform, RegExp> = {
  x: /^https:\/\/(www\.)?(x|twitter)\.com\//i,
  instagram: /^https:\/\/(www\.)?instagram\.com\//i,
  youtube: /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i,
  twitch: /^https:\/\/(www\.|m\.)?twitch\.tv\//i,
}

/** What the panel-connected API can check automatically per platform; everything else lands in the approval queue. */
export const AUTO_CHECKS: Record<SocialPlatform, { follow: boolean; like: boolean }> = {
  x: { follow: true, like: true },
  youtube: { follow: true, like: false },
  twitch: { follow: true, like: false },
  instagram: { follow: false, like: false },
}

export type SocialApiSummary = Record<SocialPlatform, { connected: boolean; fields: Record<string, string> }>

export function isPlatformUrl(platform: SocialPlatform, url: string) {
  return HOSTS[platform].test(url.trim())
}
