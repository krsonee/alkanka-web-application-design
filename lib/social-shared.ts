export type SocialPlatform = 'x' | 'instagram' | 'youtube'

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['x', 'instagram', 'youtube']

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  x: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
}

export type SocialLinks = Partial<Record<SocialPlatform, string>>

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
  v = v.replace(/^https?:\/\/(www\.|m\.)?(x\.com|twitter\.com|instagram\.com|youtube\.com)\//i, '')
  v = v.split(/[/?#]/)[0].replace(/^@/, '')
  const pattern = platform === 'youtube' ? /^[A-Za-z0-9._-]{3,30}$/ : platform === 'x' ? /^[A-Za-z0-9_]{3,15}$/ : /^[A-Za-z0-9._]{3,30}$/
  return pattern.test(v) ? v : null
}

export function profileUrl(platform: SocialPlatform, handle: string) {
  if (platform === 'x') return `https://x.com/${handle}`
  if (platform === 'instagram') return `https://www.instagram.com/${handle}/`
  return `https://www.youtube.com/@${handle}`
}

const HOSTS: Record<SocialPlatform, RegExp> = {
  x: /^https:\/\/(www\.)?(x|twitter)\.com\//i,
  instagram: /^https:\/\/(www\.)?instagram\.com\//i,
  youtube: /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i,
}

export function isPlatformUrl(platform: SocialPlatform, url: string) {
  return HOSTS[platform].test(url.trim())
}
