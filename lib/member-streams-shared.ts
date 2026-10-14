export const STREAM_PLATFORMS = ['kick', 'twitch', 'youtube'] as const
export type StreamPlatform = (typeof STREAM_PLATFORMS)[number]

export const STREAM_LABEL: Record<StreamPlatform, string> = { kick: 'Kick', twitch: 'Twitch', youtube: 'YouTube' }

export const STREAM_PLACEHOLDER: Record<StreamPlatform, string> = {
  kick: 'kick.com/kanaladi',
  twitch: 'twitch.tv/kanaladi',
  youtube: 'youtube.com/@kanaladi',
}

export type MemberStream = { platform: StreamPlatform; channel: string }

export const isStreamPlatform = (v: string): v is StreamPlatform => (STREAM_PLATFORMS as readonly string[]).includes(v)

/** Accepts a bare name or a full channel URL and returns the canonical channel id, or null if it is not valid. */
export function normalizeChannel(platform: StreamPlatform, input: string): string | null {
  const raw = input.trim().replace(/^https?:\/\//i, '').replace(/^(www\.|m\.)/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '')
  if (platform === 'kick') {
    const slug = raw.replace(/^kick\.com\//i, '').replace(/^@/, '')
    return /^[a-z0-9_-]{3,30}$/i.test(slug) ? slug.toLowerCase() : null
  }
  if (platform === 'twitch') {
    const login = raw.replace(/^twitch\.tv\//i, '').replace(/^@/, '')
    return /^[a-z0-9_]{3,25}$/i.test(login) ? login.toLowerCase() : null
  }
  const path = raw.replace(/^youtube\.com\//i, '').replace(/\/(live|videos|streams|featured)$/i, '')
  if (/^channel\/UC[\w-]{22}$/.test(path)) return path
  const handle = path.replace(/^@/, '')
  return /^[\w.-]{3,40}$/.test(handle) ? `@${handle}` : null
}

export function channelUrl(platform: StreamPlatform, channel: string) {
  if (platform === 'kick') return `https://kick.com/${channel}`
  if (platform === 'twitch') return `https://www.twitch.tv/${channel}`
  return `https://www.youtube.com/${channel}`
}
