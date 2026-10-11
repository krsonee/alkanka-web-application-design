export const BROADCAST_CHANNELS = [
  { slug: 'duyuru', label: 'Duyuru', title: 'Duyuru kanalı' },
  { slug: 'ozel-oran', label: 'Özel oran', title: 'Özel oran kanalı' },
  { slug: 'promo', label: 'Promo kod', title: 'Promo kod kanalı' },
] as const

export type BroadcastSlug = (typeof BROADCAST_CHANNELS)[number]['slug']
export type ChatTab = 'sohbet' | BroadcastSlug

export const isBroadcastSlug = (value: string): value is BroadcastSlug => BROADCAST_CHANNELS.some((c) => c.slug === value)

export type ChannelPost = { id: number; text: string; photo: string | null; url: string; createdAt: string | null }

export type ChannelFeed = {
  configured: boolean
  title: string
  username: string | null
  inviteUrl: string | null
  posts: ChannelPost[]
}
