import 'server-only'
import { rows, sql } from '@/lib/db'
import { getLiveVideoId, type Channel } from '@/lib/kankatv'
import { botToken, callBot } from '@/lib/telegram-mirror'
import { isStreamPlatform, normalizeChannel, type MemberStream, type StreamPlatform } from '@/lib/member-streams-shared'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
const MAX_CHECKED = 80
const MAX_OFFLINE_SHOWN = 20
const TELEGRAM_LIVE_TTL_HOURS = 12
// Twitch's own web client id; the public GQL endpoint needs no account or secret.
const TWITCH_WEB_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

let ready: Promise<void> | null = null
function ensureTables() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS member_streams (
      user_id text NOT NULL, platform text NOT NULL, channel text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, platform))`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS member_streams_channel_uniq ON member_streams (platform, lower(channel))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_live (
      chat_id text PRIMARY KEY, title text NOT NULL, url text NOT NULL, user_id text,
      started_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

// --- Member settings -------------------------------------------------------

export async function myStreams(userId: string): Promise<MemberStream[]> {
  await ensureTables()
  return rows<MemberStream>(sql`SELECT platform, channel FROM member_streams WHERE user_id = ${userId} ORDER BY platform`)
}

export async function linkStream(userId: string, platform: string, input: string) {
  if (!isStreamPlatform(platform)) throw new Error('Geçersiz platform.')
  const channel = normalizeChannel(platform, input)
  if (!channel) throw new Error('Kanal adı ya da linki geçersiz.')
  await ensureTables()
  const taken = await rows<{ user_id: string }>(sql`SELECT user_id FROM member_streams
    WHERE platform = ${platform} AND lower(channel) = lower(${channel}) AND user_id <> ${userId}`)
  if (taken.length) throw new Error('Bu kanal başka bir üyenin hesabına bağlı.')
  await rows(sql`INSERT INTO member_streams (user_id, platform, channel) VALUES (${userId}, ${platform}, ${channel})
    ON CONFLICT (user_id, platform) DO UPDATE SET channel = EXCLUDED.channel, created_at = now()`)
  return channel
}

export async function unlinkStream(userId: string, platform: string) {
  await ensureTables()
  await rows(sql`DELETE FROM member_streams WHERE user_id = ${userId} AND platform = ${platform}`)
}

// --- Live checks -------------------------------------------------------------

type Live = { title: string | null; viewers: number | null; avatar: string | null; embedUrl: string }

async function kickLive(slug: string): Promise<Live | null> {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, { headers: { 'User-Agent': UA }, next: { revalidate: 120 } })
    if (!res.ok) return null
    const json = (await res.json()) as {
      livestream?: { session_title?: string; viewer_count?: number } | null
      user?: { profile_pic?: string | null }
    }
    if (!json.livestream) return null
    return {
      title: json.livestream.session_title ?? null,
      viewers: json.livestream.viewer_count ?? null,
      avatar: json.user?.profile_pic ?? null,
      embedUrl: `https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true&muted=false`,
    }
  } catch {
    return null
  }
}

async function twitchLive(logins: string[]): Promise<Map<string, Live>> {
  const live = new Map<string, Live>()
  if (!logins.length) return live
  const query = `query{${logins.map((l, i) => `u${i}:user(login:${JSON.stringify(l)}){profileImageURL(width:70) stream{title viewersCount}}`).join(' ')}}`
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-Id': TWITCH_WEB_CLIENT_ID, 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ query }),
      next: { revalidate: 120 },
    })
    if (!res.ok) return live
    const json = (await res.json()) as {
      data?: Record<string, { profileImageURL?: string; stream?: { title?: string; viewersCount?: number } | null } | null>
    }
    logins.forEach((login, i) => {
      const u = json.data?.[`u${i}`]
      if (!u?.stream) return
      live.set(login, {
        title: u.stream.title ?? null,
        viewers: u.stream.viewersCount ?? null,
        avatar: u.profileImageURL ?? null,
        // The board appends `&parent=<host>` on the client; Twitch requires the embedding hostname.
        embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&autoplay=true`,
      })
    })
  } catch {
    // Treat a failed check as offline.
  }
  return live
}

async function youtubeLive(path: string): Promise<Live | null> {
  const id = await getLiveVideoId(path)
  return id ? { title: null, viewers: null, avatar: null, embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&mute=0&playsinline=1` } : null
}

type StreamRow = { user_id: string; platform: StreamPlatform; channel: string; name: string | null }

const PLATFORM_TAG: Record<StreamPlatform, string> = { kick: 'Kick', twitch: 'Twitch', youtube: 'YouTube' }

/** Member-linked channels plus Telegram video chats, shaped as KankaTV channels in the "uye" group. */
export async function getMemberChannels(): Promise<Channel[]> {
  try {
    await ensureTables()
    const [streams, telegram] = await Promise.all([
      rows<StreamRow>(sql`SELECT s.user_id, s.platform, s.channel, u.name FROM member_streams s
        LEFT JOIN "user" u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT ${MAX_CHECKED}`),
      rows<{ chat_id: string; title: string; url: string; name: string | null }>(sql`SELECT t.chat_id, t.title, t.url, u.name
        FROM tg_live t LEFT JOIN "user" u ON u.id = t.user_id
        WHERE t.started_at > now() - make_interval(hours => ${TELEGRAM_LIVE_TTL_HOURS}) ORDER BY t.started_at DESC`),
    ])

    const twitch = await twitchLive(streams.filter((s) => s.platform === 'twitch').map((s) => s.channel))
    const checks = await Promise.all(
      streams.map((s) => (s.platform === 'kick' ? kickLive(s.channel) : s.platform === 'youtube' ? youtubeLive(s.channel) : twitch.get(s.channel) ?? null)),
    )

    const live: Channel[] = []
    const offline: Channel[] = []
    streams.forEach((s, i) => {
      const status = checks[i]
      const member = s.name || 'Kanka'
      const channel: Channel = {
        slug: `uye-${s.platform}-${s.channel.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`,
        name: member,
        group: 'uye',
        tag: `${PLATFORM_TAG[s.platform]} · ${s.channel.replace(/^channel\//, '')}`,
        live: Boolean(status),
        embedUrl: status?.embedUrl ?? null,
        externalUrl: null,
        title: status?.title ?? null,
        avatar: status?.avatar ?? null,
        viewers: status?.viewers ?? null,
      }
      if (status) live.push(channel)
      else if (offline.length < MAX_OFFLINE_SHOWN) offline.push(channel)
    })
    live.sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0))

    const tg: Channel[] = telegram.map((t) => ({
      slug: `uye-tg-${t.chat_id.replace(/[^0-9]/g, '')}`,
      name: t.name ? `${t.name} · ${t.title}` : t.title,
      group: 'uye',
      tag: 'Telegram canlı yayın',
      live: true,
      embedUrl: null,
      externalUrl: t.url,
      title: null,
      avatar: null,
      viewers: null,
    }))

    return [...tg, ...live, ...offline]
  } catch (error) {
    console.error('[member-streams]', error)
    return []
  }
}

// --- Telegram video chats ------------------------------------------------------

type VideoChatMessage = {
  chat: { id: number; type: string; title?: string }
  from?: { id: number }
  video_chat_started?: object
  video_chat_ended?: object
}

/** Records a Telegram live stream starting or ending. Returns true when the message was a video chat event. */
export async function handleVideoChat(m: VideoChatMessage, botId: number): Promise<boolean> {
  if (!m.video_chat_started && !m.video_chat_ended) return false
  await ensureTables()
  const chatId = String(m.chat.id)
  if (m.video_chat_ended) {
    await rows(sql`DELETE FROM tg_live WHERE chat_id = ${chatId}`)
    return true
  }
  const info = await callBot<{ username?: string; invite_link?: string; title?: string }>(await botToken(botId), 'getChat', { chat_id: m.chat.id }).catch(
    () => null,
  )
  const param = m.chat.type === 'channel' ? 'livestream' : 'videochat'
  const url = info?.username ? `https://t.me/${info.username}?${param}` : info?.invite_link
  if (!url) return true
  const link = m.from ? await rows<{ user_id: string }>(sql`SELECT user_id FROM tg_links WHERE tg_id = ${m.from.id}`).catch(() => []) : []
  const title = (info?.title ?? m.chat.title ?? 'Telegram').slice(0, 80)
  await rows(sql`INSERT INTO tg_live (chat_id, title, url, user_id) VALUES (${chatId}, ${title}, ${url}, ${link[0]?.user_id ?? null})
    ON CONFLICT (chat_id) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, user_id = EXCLUDED.user_id, started_at = now()`)
  return true
}
