import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot, ensureTables, fetchChannel, normalizeChannel, scrapedHtmlToCleanText } from '@/lib/telegram-mirror'
import { displayName, escapeHtml, getChatConfig, getLink, messageText, type TgMessage } from '@/lib/telegram-chat'
import {
  BROADCAST_CHANNELS,
  type BroadcastSlug,
  type ChannelComment,
  type ChannelFeed,
  type ChannelPost,
  type TelegramAccess,
} from '@/lib/telegram-channels-shared'

const CACHE_MS = 60_000
const MAX_POSTS = 20
const MAX_COMMENTS_PER_POST = 30
const MAX_COMMENT = 500
const COMMENT_COOLDOWN_MS = 5000
const JOINED_CACHE_MS = 5 * 60 * 1000
const NOT_JOINED_CACHE_MS = 8_000

const settingKey = (slug: BroadcastSlug) => `channel_${slug}`
const idKey = (slug: BroadcastSlug) => `channel_${slug}_id`
const discussionKey = (slug: BroadcastSlug) => `channel_${slug}_discussion`

type ChannelConfig = { slug: BroadcastSlug; username: string; channelId: string | null; discussionId: string | null }

const postCache = new Map<string, { at: number; posts: Promise<ScrapedPost[]> }>()
const joinedCache = new Map<string, { at: number; joined: boolean }>()

type ScrapedPost = Omit<ChannelPost, 'commentable' | 'comments'>

let ready: Promise<void> | null = null
function ensureChannelTables() {
  ready ??= (async () => {
    await ensureTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_channel_threads (
      channel_id text NOT NULL, post_id bigint NOT NULL, discussion_id text NOT NULL, thread_message_id bigint NOT NULL,
      PRIMARY KEY (channel_id, post_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_channel_comments (
      id serial PRIMARY KEY, channel_id text NOT NULL, post_id bigint NOT NULL, discussion_id text NOT NULL,
      tg_message_id bigint, from_tg_id bigint, user_id text, author text NOT NULL, text text NOT NULL,
      origin text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_channel_comments_post_idx ON tg_channel_comments (channel_id, post_id, id DESC)`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS tg_channel_comments_tg_uniq ON tg_channel_comments (discussion_id, tg_message_id)
      WHERE tg_message_id IS NOT NULL`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

async function getChannelConfigs(): Promise<ChannelConfig[]> {
  await ensureChannelTables()
  const keys = BROADCAST_CHANNELS.flatMap((c) => [settingKey(c.slug), idKey(c.slug), discussionKey(c.slug)])
  const r = await rows<{ key: string; value: string }>(sql`SELECT key, value FROM tg_settings WHERE key IN ${keys}`)
  const map = Object.fromEntries(r.map((s) => [s.key, s.value]))
  return BROADCAST_CHANNELS.filter((c) => map[settingKey(c.slug)]).map((c) => ({
    slug: c.slug,
    username: map[settingKey(c.slug)],
    channelId: map[idKey(c.slug)] ?? null,
    discussionId: map[discussionKey(c.slug)] ?? null,
  }))
}

export async function getChannelUsernames(): Promise<Record<BroadcastSlug, string | null>> {
  const configs = await getChannelConfigs()
  return Object.fromEntries(
    BROADCAST_CHANNELS.map((c) => [c.slug, configs.find((x) => x.slug === c.slug)?.username ?? null]),
  ) as Record<BroadcastSlug, string | null>
}

function cachedPosts(username: string) {
  const hit = postCache.get(username)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.posts
  const posts = fetchChannel(username).then((scraped) =>
    scraped
      .map((p) => ({
        id: p.id,
        text: scrapedHtmlToCleanText(p.html),
        photo: p.photos[0] ?? null,
        url: `https://t.me/${username}/${p.id}`,
        createdAt: p.date ? new Date(p.date).toISOString() : null,
      }))
      .filter((p) => p.text || p.photo)
      .slice(-MAX_POSTS),
  )
  postCache.set(username, { at: Date.now(), posts })
  posts.catch(() => postCache.delete(username))
  return posts
}

async function tgIdFor(userId: string) {
  const r = await rows<{ tg_id: string }>(sql`SELECT tg_id FROM tg_links WHERE user_id = ${userId}`)
  return r[0] ? Number(r[0].tg_id) : null
}

async function isChannelMember(userId: string, config: ChannelConfig, fresh = false) {
  if (!config.channelId) return false
  const cacheKey = `${config.slug}:${userId}`
  const hit = joinedCache.get(cacheKey)
  if (!fresh && hit && Date.now() - hit.at < (hit.joined ? JOINED_CACHE_MS : NOT_JOINED_CACHE_MS)) return hit.joined
  const [chat, tgId] = await Promise.all([getChatConfig(), tgIdFor(userId)])
  if (!chat || !tgId) return false
  const member = await callBot<{ status: string }>(await botToken(chat.botId), 'getChatMember', {
    chat_id: config.channelId,
    user_id: tgId,
  }).catch(() => null)
  if (!member) return hit?.joined ?? false
  const joined = !['left', 'kicked'].includes(member.status)
  joinedCache.set(cacheKey, { at: Date.now(), joined })
  return joined
}

async function commentsFor(channelId: string, postIds: number[]) {
  if (!postIds.length) return { threads: new Set<number>(), byPost: new Map<number, ChannelComment[]>() }
  const [threads, comments] = await Promise.all([
    rows<{ post_id: string }>(sql`SELECT post_id FROM tg_channel_threads WHERE channel_id = ${channelId} AND post_id IN ${postIds}`),
    rows(sql`SELECT * FROM (
        SELECT id, post_id, author, user_id, text, origin, created_at,
          row_number() OVER (PARTITION BY post_id ORDER BY id DESC) AS rn
        FROM tg_channel_comments WHERE channel_id = ${channelId} AND post_id IN ${postIds}
      ) c WHERE rn <= ${MAX_COMMENTS_PER_POST} ORDER BY id ASC`),
  ])
  const byPost = new Map<number, ChannelComment[]>()
  for (const c of comments) {
    const list = byPost.get(Number(c.post_id)) ?? []
    list.push({
      id: Number(c.id),
      author: String(c.author),
      userId: c.user_id ? String(c.user_id) : null,
      text: String(c.text),
      origin: c.origin === 'site' ? 'site' : 'telegram',
      createdAt: new Date(String(c.created_at)).toISOString(),
    })
    byPost.set(Number(c.post_id), list)
  }
  return { threads: new Set(threads.map((t) => Number(t.post_id))), byPost }
}

export async function getChannelFeed(slug: BroadcastSlug, userId: string | null): Promise<ChannelFeed> {
  const meta = BROADCAST_CHANNELS.find((c) => c.slug === slug)!
  const config = (await getChannelConfigs()).find((c) => c.slug === slug)
  const link = userId ? await getLink(userId) : null
  const base = { title: meta.title, posts: [] as ChannelPost[] }

  if (!config) {
    return { ...base, configured: false, locked: false, username: null, inviteUrl: null, me: { loggedIn: Boolean(userId), link, joined: false } }
  }

  const joined = userId && link ? await isChannelMember(userId, config) : false
  const me: TelegramAccess = { loggedIn: Boolean(userId), link, joined }
  const shared = { ...base, configured: true, username: config.username, inviteUrl: `https://t.me/${config.username}`, me }
  if (!joined || !config.channelId) return { ...shared, locked: true }

  const scraped = await cachedPosts(config.username).catch((error) => {
    console.error('[channel-feed]', slug, error)
    return [] as ScrapedPost[]
  })
  const { threads, byPost } = await commentsFor(config.channelId, scraped.map((p) => p.id))
  return {
    ...shared,
    locked: false,
    posts: scraped.map((p) => ({
      ...p,
      commentable: Boolean(config.discussionId) && threads.has(p.id),
      comments: byPost.get(p.id) ?? [],
    })),
  }
}

// --- Webhook: comments arrive in the channel's linked discussion group -------

function forwardedPostId(m: TgMessage, channelId: string) {
  if (!m.is_automatic_forward) return null
  const origin = m.forward_origin
  if (origin?.type === 'channel' && String(origin.chat?.id) === channelId && origin.message_id) return origin.message_id
  if (String(m.forward_from_chat?.id) === channelId && m.forward_from_message_id) return m.forward_from_message_id
  return null
}

async function saveThread(config: ChannelConfig, postId: number, threadMessageId: number) {
  await rows(sql`INSERT INTO tg_channel_threads (channel_id, post_id, discussion_id, thread_message_id)
    VALUES (${config.channelId}, ${postId}, ${config.discussionId}, ${threadMessageId})
    ON CONFLICT (channel_id, post_id) DO UPDATE SET discussion_id = EXCLUDED.discussion_id, thread_message_id = EXCLUDED.thread_message_id`)
}

export async function handleDiscussionMessage(m: TgMessage): Promise<boolean> {
  const configs = await getChannelConfigs()
  const config = configs.find((c) => c.discussionId && c.discussionId === String(m.chat.id))
  if (!config?.channelId || !config.discussionId) return false

  const ownPost = forwardedPostId(m, config.channelId)
  if (ownPost) {
    await saveThread(config, ownPost, m.message_id)
    return true
  }
  if (!m.from || m.from.is_bot) return true

  let postId: number | null = null
  const parent = m.reply_to_message
  const parentPost = parent ? forwardedPostId(parent, config.channelId) : null
  if (parent && parentPost) {
    postId = parentPost
    await saveThread(config, parentPost, parent.message_id)
  } else {
    const threadId = m.message_thread_id ?? parent?.message_id
    if (!threadId) return true
    const r = await rows<{ post_id: string }>(sql`SELECT post_id FROM tg_channel_threads
      WHERE discussion_id = ${config.discussionId} AND thread_message_id = ${threadId}`)
    postId = r[0] ? Number(r[0].post_id) : null
  }
  if (!postId) return true

  const text = messageText(m)
  if (!text) return true
  const link = await rows<{ user_id: string }>(sql`SELECT user_id FROM tg_links WHERE tg_id = ${m.from.id}`)
  await rows(sql`INSERT INTO tg_channel_comments (channel_id, post_id, discussion_id, tg_message_id, from_tg_id, user_id, author, text, origin)
    VALUES (${config.channelId}, ${postId}, ${config.discussionId}, ${m.message_id}, ${m.from.id}, ${link[0]?.user_id ?? null},
      ${displayName(m.from)}, ${text.slice(0, 1000)}, 'telegram')
    ON CONFLICT DO NOTHING`)
  return true
}

// --- Commenting from the site ------------------------------------------------

export async function sendChannelComment(userId: string, slug: BroadcastSlug, postId: number, rawText: string) {
  const text = rawText.replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('Yorum boş olamaz.')
  if (text.length > MAX_COMMENT) throw new Error(`Yorum en fazla ${MAX_COMMENT} karakter olabilir.`)
  if (!Number.isInteger(postId) || postId <= 0) throw new Error('Geçersiz paylaşım.')

  const config = (await getChannelConfigs()).find((c) => c.slug === slug)
  const chat = await getChatConfig()
  if (!config?.channelId || !chat) throw new Error('Bu kanal henüz bağlanmadı.')
  if (!config.discussionId) throw new Error('Bu kanalda yorumlar kapalı.')

  const link = await rows<{ tg_id: string; tg_name: string }>(sql`SELECT tg_id, tg_name FROM tg_links WHERE user_id = ${userId}`)
  if (!link[0]) throw new Error('Yorum yapmak için önce Telegram hesabını bağla.')
  if (!(await isChannelMember(userId, config, true))) throw new Error('Yorum yapabilmek için önce kanala katılmalısın.')

  const thread = await rows<{ thread_message_id: string }>(sql`SELECT thread_message_id FROM tg_channel_threads
    WHERE channel_id = ${config.channelId} AND post_id = ${postId}`)
  if (!thread[0]) throw new Error('Bu paylaşıma şimdilik sadece Telegram’dan yorum yapılabiliyor.')

  const last = await rows<{ created_at: string }>(sql`SELECT created_at FROM tg_channel_comments
    WHERE user_id = ${userId} AND origin = 'site' ORDER BY id DESC LIMIT 1`)
  if (last[0] && Date.now() - new Date(last[0].created_at).getTime() < COMMENT_COOLDOWN_MS) throw new Error('Biraz yavaş kanka, birkaç saniye bekle.')

  const author = link[0].tg_name
  const sent = await callBot<{ message_id: number }>(await botToken(chat.botId), 'sendMessage', {
    chat_id: config.discussionId,
    text: `<b>${escapeHtml(author)}</b> <i>(site)</i>: ${escapeHtml(text)}`,
    parse_mode: 'HTML',
    reply_parameters: { message_id: Number(thread[0].thread_message_id), allow_sending_without_reply: false },
    link_preview_options: { is_disabled: true },
  })
  await rows(sql`INSERT INTO tg_channel_comments (channel_id, post_id, discussion_id, tg_message_id, from_tg_id, user_id, author, text, origin)
    VALUES (${config.channelId}, ${postId}, ${config.discussionId}, ${sent.message_id}, ${Number(link[0].tg_id)}, ${userId},
      ${author}, ${text}, 'site')
    ON CONFLICT DO NOTHING`)
}

// --- Admin -------------------------------------------------------------------

async function resolveChannel(title: string, username: string) {
  const chat = await getChatConfig()
  if (!chat) throw new Error('Önce yukarıdan sohbet botunu bağla; üyelik kontrolünü o bot yapıyor.')
  const token = await botToken(chat.botId)
  const info = await callBot<{ id: number; type: string; linked_chat_id?: number }>(token, 'getChat', { chat_id: `@${username}` }).catch(
    (error: Error) => {
      throw new Error(`${title}: kanal bulunamadı (${error.message}).`)
    },
  )
  if (info.type !== 'channel') throw new Error(`${title}: bu bir kanal değil.`)
  const me = await callBot<{ id: number }>(token, 'getMe')
  const inChannel = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: info.id, user_id: me.id }).catch(() => null)
  if (!inChannel || !['administrator', 'creator'].includes(inChannel.status)) {
    throw new Error(`${title}: sohbet botunu bu kanala yönetici olarak ekle (üye kontrolü için gerekli).`)
  }
  let discussionId: string | null = null
  if (info.linked_chat_id) {
    const inGroup = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: info.linked_chat_id, user_id: me.id }).catch(() => null)
    if (inGroup && !['left', 'kicked'].includes(inGroup.status)) discussionId = String(info.linked_chat_id)
  }
  return { channelId: String(info.id), discussionId }
}

export async function saveChannels(input: Record<BroadcastSlug, string>) {
  await ensureChannelTables()
  const saved: string[] = []
  for (const { slug, title } of BROADCAST_CHANNELS) {
    const raw = input[slug]?.trim() ?? ''
    if (!raw) {
      await rows(sql`DELETE FROM tg_settings WHERE key IN ${[settingKey(slug), idKey(slug), discussionKey(slug)]}`)
      continue
    }
    const username = normalizeChannel(raw)
    if (!username) throw new Error(`${title}: geçerli bir kanal kullanıcı adı yaz (ör. @alkankaduyuru).`)
    try {
      await fetchChannel(username)
    } catch (error) {
      throw new Error(`${title}: ${(error as Error).message}. Kanalın herkese açık olduğundan emin ol.`)
    }
    const { channelId, discussionId } = await resolveChannel(title, username)
    const upsert = (key: string, value: string) =>
      rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
    await upsert(settingKey(slug), username)
    await upsert(idKey(slug), channelId)
    if (discussionId) await upsert(discussionKey(slug), discussionId)
    else await rows(sql`DELETE FROM tg_settings WHERE key = ${discussionKey(slug)}`)
    postCache.delete(username)
    for (const key of joinedCache.keys()) if (key.startsWith(`${slug}:`)) joinedCache.delete(key)
    saved.push(discussionId ? title : `${title} (yorumlar kapalı: tartışma grubu yok ya da bot grupta değil)`)
  }
  return saved
}
