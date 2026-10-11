import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureTables, fetchChannel, normalizeChannel, stripTags } from '@/lib/telegram-mirror'
import { BROADCAST_CHANNELS, type BroadcastSlug, type ChannelFeed, type ChannelPost } from '@/lib/telegram-channels-shared'

const CACHE_MS = 60_000
const MAX_POSTS = 20
const settingKey = (slug: BroadcastSlug) => `channel_${slug}`

const cache = new Map<string, { at: number; posts: Promise<ChannelPost[]> }>()

export async function getChannelUsernames(): Promise<Record<BroadcastSlug, string | null>> {
  await ensureTables()
  const keys = BROADCAST_CHANNELS.map((c) => settingKey(c.slug))
  const r = await rows<{ key: string; value: string }>(sql`SELECT key, value FROM tg_settings WHERE key IN ${keys}`)
  const map = Object.fromEntries(r.map((s) => [s.key, s.value]))
  return Object.fromEntries(BROADCAST_CHANNELS.map((c) => [c.slug, map[settingKey(c.slug)] ?? null])) as Record<BroadcastSlug, string | null>
}

function toPosts(username: string, scraped: Awaited<ReturnType<typeof fetchChannel>>): ChannelPost[] {
  return scraped
    .map((p) => ({
      id: p.id,
      text: stripTags(p.html).replace(/\n{3,}/g, '\n\n').trim(),
      photo: p.photos[0] ?? null,
      url: `https://t.me/${username}/${p.id}`,
      createdAt: p.date ? new Date(p.date).toISOString() : null,
    }))
    .filter((p) => p.text || p.photo)
    .slice(-MAX_POSTS)
}

function cachedPosts(username: string) {
  const hit = cache.get(username)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.posts
  const posts = fetchChannel(username).then((scraped) => toPosts(username, scraped))
  cache.set(username, { at: Date.now(), posts })
  posts.catch(() => cache.delete(username))
  return posts
}

export async function getChannelFeed(slug: BroadcastSlug): Promise<ChannelFeed> {
  const meta = BROADCAST_CHANNELS.find((c) => c.slug === slug)!
  const username = (await getChannelUsernames())[slug]
  if (!username) return { configured: false, title: meta.title, username: null, inviteUrl: null, posts: [] }
  const posts = await cachedPosts(username).catch((error) => {
    console.error('[channel-feed]', slug, error)
    return [] as ChannelPost[]
  })
  return { configured: true, title: meta.title, username, inviteUrl: `https://t.me/${username}`, posts }
}

export async function saveChannels(input: Record<BroadcastSlug, string>) {
  await ensureTables()
  const saved: string[] = []
  for (const { slug, title } of BROADCAST_CHANNELS) {
    const raw = input[slug]?.trim() ?? ''
    if (!raw) {
      await rows(sql`DELETE FROM tg_settings WHERE key = ${settingKey(slug)}`)
      continue
    }
    const username = normalizeChannel(raw)
    if (!username) throw new Error(`${title}: geçerli bir kanal kullanıcı adı yaz (ör. @alkankaduyuru).`)
    try {
      await fetchChannel(username)
    } catch (error) {
      throw new Error(`${title}: ${(error as Error).message}. Kanalın herkese açık olduğundan emin ol.`)
    }
    await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${settingKey(slug)}, ${username})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
    cache.delete(username)
    saved.push(title)
  }
  return saved
}
