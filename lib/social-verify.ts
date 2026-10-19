import 'server-only'
import { deleteContent, getContent, setContent } from '@/lib/content'
import { rows, sql } from '@/lib/db'
import { AUTO_CHECKS, cleanHandle, PLATFORM_LABEL, SOCIAL_PLATFORMS, type SocialApiSummary, type SocialPlatform } from '@/lib/social-shared'

/**
 * Panel-entered API credentials for checking follows/likes made with the member's verified account.
 * Stored server-side only; the panel gets back connection flags and non-secret ids, never the secrets.
 */
type ApiConfig = {
  x?: { bearer: string }
  youtube?: { apiKey: string; channelId?: string }
  twitch?: { clientId: string; token: string; broadcasterId?: string }
  instagram?: { enabled: true }
}

const API_KEY = 'social:api'

export const API_FIELDS: Record<SocialPlatform, { key: string; label: string; secret: boolean; required: boolean }[]> = {
  x: [{ key: 'bearer', label: 'Bearer token', secret: true, required: true }],
  youtube: [
    { key: 'apiKey', label: 'API anahtarı', secret: true, required: true },
    { key: 'channelId', label: 'Kanal ID (UC…, boşsa resmi linkten bulunur)', secret: false, required: false },
  ],
  twitch: [
    { key: 'clientId', label: 'Client ID', secret: false, required: true },
    { key: 'token', label: 'Yayıncı erişim tokenı (moderator:read:followers)', secret: true, required: true },
    { key: 'broadcasterId', label: 'Yayıncı ID (boşsa resmi linkten bulunur)', secret: false, required: false },
  ],
  instagram: [],
}

async function getApi(): Promise<ApiConfig> {
  return (await getContent<ApiConfig>(API_KEY).catch(() => null)) ?? {}
}

export async function socialApiSummary(): Promise<SocialApiSummary> {
  const cfg = await getApi()
  const out = {} as SocialApiSummary
  for (const platform of SOCIAL_PLATFORMS) {
    const entry = (cfg[platform] ?? null) as Record<string, string> | null
    const fields: Record<string, string> = {}
    for (const f of API_FIELDS[platform]) if (!f.secret && entry?.[f.key]) fields[f.key] = entry[f.key]
    out[platform] = { connected: Boolean(entry), fields }
  }
  return out
}

/** Blank secret fields keep the stored value so admins can edit ids without re-pasting tokens. */
export async function saveSocialApi(platform: SocialPlatform, input: Record<string, string>) {
  if (!SOCIAL_PLATFORMS.includes(platform)) throw new Error('Platform geçersiz.')
  const cfg = await getApi()
  const current = (cfg[platform] ?? {}) as Record<string, string>
  const next: Record<string, string> = {}
  for (const f of API_FIELDS[platform]) {
    const value = String(input[f.key] ?? '').trim().slice(0, 400)
    const kept = value || (f.secret ? current[f.key] ?? '' : '')
    if (f.required && !kept) throw new Error(`${f.label} gerekli.`)
    if (kept) next[f.key] = kept
  }
  const updated = { ...cfg, [platform]: platform === 'instagram' ? { enabled: true } : next }
  await setContent(API_KEY, updated)
}

export async function clearSocialApi(platform: SocialPlatform) {
  const cfg = await getApi()
  delete cfg[platform]
  if (Object.keys(cfg).length) await setContent(API_KEY, cfg)
  else await deleteContent(API_KEY)
}

type Verdict = 'yes' | 'no' | 'review'

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
  return res.json() as Promise<Record<string, unknown>>
}

async function xUserId(bearer: string, handle: string): Promise<string | null> {
  const data = await getJson(`https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`, { Authorization: `Bearer ${bearer}` })
  return (data.data as { id?: string } | undefined)?.id ?? null
}

/** Walks up to a few pages of a user-id list endpoint looking for one id. */
async function xListHas(bearer: string, base: string, wanted: string, pages: number) {
  let token: string | undefined
  for (let i = 0; i < pages; i++) {
    const url = `${base}${base.includes('?') ? '&' : '?'}max_results=${base.includes('liking_users') ? 100 : 1000}${token ? `&pagination_token=${token}` : ''}`
    const data = await getJson(url, { Authorization: `Bearer ${bearer}` })
    const list = (data.data as { id: string }[] | undefined) ?? []
    if (list.some((u) => u.id === wanted)) return true
    token = (data.meta as { next_token?: string } | undefined)?.next_token
    if (!token) return false
  }
  return false
}

async function verifyX(cfg: NonNullable<ApiConfig['x']>, member: string, kind: 'follow' | 'like', target: string): Promise<Verdict> {
  const memberId = await xUserId(cfg.bearer, member)
  if (!memberId) return 'no'
  if (kind === 'follow') {
    const officialId = await xUserId(cfg.bearer, target)
    if (!officialId) return 'review'
    return (await xListHas(cfg.bearer, `https://api.x.com/2/users/${memberId}/following`, officialId, 3)) ? 'yes' : 'no'
  }
  const tweetId = target.match(/status(?:es)?\/(\d+)/)?.[1]
  if (!tweetId) return 'review'
  return (await xListHas(cfg.bearer, `https://api.x.com/2/tweets/${tweetId}/liking_users`, memberId, 5)) ? 'yes' : 'no'
}

async function ytChannelId(apiKey: string, handleOrUrl: string): Promise<string | null> {
  const direct = handleOrUrl.match(/(UC[\w-]{20,})/)?.[1]
  if (direct) return direct
  const handle = cleanHandle('youtube', handleOrUrl)
  if (!handle) return null
  const data = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(`@${handle}`)}&key=${apiKey}`, {})
  return (data.items as { id: string }[] | undefined)?.[0]?.id ?? null
}

async function verifyYoutube(cfg: NonNullable<ApiConfig['youtube']>, member: string, target: string): Promise<Verdict> {
  const memberChannel = await ytChannelId(cfg.apiKey, member)
  if (!memberChannel) return 'no'
  const official = cfg.channelId || (await ytChannelId(cfg.apiKey, target))
  if (!official) return 'review'
  try {
    const data = await getJson(
      `https://www.googleapis.com/youtube/v3/subscriptions?part=id&channelId=${memberChannel}&forChannelId=${official}&key=${cfg.apiKey}`,
      {},
    )
    return ((data.items as unknown[] | undefined) ?? []).length > 0 ? 'yes' : 'no'
  } catch (error) {
    // Members with private subscriptions return 403; a human can still check.
    if ((error as { status?: number }).status === 403) return 'review'
    throw error
  }
}

async function verifyTwitch(cfg: NonNullable<ApiConfig['twitch']>, member: string, target: string): Promise<Verdict> {
  const headers = { 'Client-Id': cfg.clientId, Authorization: `Bearer ${cfg.token}` }
  const userId = async (login: string) =>
    ((await getJson(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, headers)).data as { id: string }[] | undefined)?.[0]?.id ?? null
  const memberId = await userId(member)
  if (!memberId) return 'no'
  const officialLogin = cleanHandle('twitch', target)
  const broadcaster = cfg.broadcasterId || (officialLogin ? await userId(officialLogin) : null)
  if (!broadcaster) return 'review'
  const data = await getJson(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcaster}&user_id=${memberId}`, headers)
  return ((data.data as unknown[] | undefined) ?? []).length > 0 ? 'yes' : 'no'
}

let ready: Promise<unknown> | null = null
function ensureChecks() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS social_task_checks (
    user_id text NOT NULL, task_id int NOT NULL, handle text NOT NULL,
    checked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, task_id))`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** Platform calls failing (quota, revoked token) fall back to manual review instead of blocking the member. */
async function verdictFor(platform: SocialPlatform, kind: 'follow' | 'like', member: string, target: string): Promise<Verdict> {
  if (!AUTO_CHECKS[platform][kind]) return 'review'
  const cfg = await getApi()
  try {
    if (platform === 'x' && cfg.x) return await verifyX(cfg.x, member, kind, target)
    if (platform === 'youtube' && cfg.youtube) return await verifyYoutube(cfg.youtube, member, target)
    if (platform === 'twitch' && cfg.twitch) return await verifyTwitch(cfg.twitch, member, target)
  } catch (error) {
    console.error('[social-verify]', platform, kind, (error as Error).message)
  }
  return 'review'
}

export type SocialCheck = 'verified' | 'review'

/**
 * Checks a follow/like task against the member's verified account on that platform.
 * Throws a member-facing message when the action isn't visible yet.
 */
export async function checkSocialTask(
  userId: string,
  task: { id: number; kind: string; param: string | null; link: string | null },
  officialLink: string,
): Promise<SocialCheck> {
  const platform = task.param as SocialPlatform | null
  if (!platform || !SOCIAL_PLATFORMS.includes(platform)) throw new Error('Görevin platformu ayarlı değil.')
  await ensureChecks()
  const done = await rows(sql`SELECT 1 FROM social_task_checks WHERE user_id = ${userId} AND task_id = ${task.id}`)
  if (done.length) return 'verified'
  const account = (await rows<{ handle: string }>(sql`SELECT handle FROM social_accounts
    WHERE user_id = ${userId} AND platform = ${platform} AND status = 'verified'`).catch(() => []))[0]
  if (!account) throw new Error(`Önce ${PLATFORM_LABEL[platform]} hesabını Profil > Sosyal hesaplar bölümünden bağlayıp doğrulat.`)
  const kind = task.kind === 'social_like' ? 'like' : 'follow'
  const target = kind === 'like' ? task.link : officialLink
  if (!target) throw new Error('Görevin bağlantısı ayarlı değil.')
  const verdict = await verdictFor(platform, kind, account.handle, target)
  if (verdict === 'no') {
    throw new Error(kind === 'like'
      ? `@${account.handle} hesabının beğenisi henüz görünmüyor. Beğendiysen birkaç dakika sonra tekrar dene.`
      : `@${account.handle} hesabının takibi henüz görünmüyor. Takip ettiysen birkaç dakika sonra tekrar dene.`)
  }
  if (verdict === 'yes') {
    await rows(sql`INSERT INTO social_task_checks (user_id, task_id, handle) VALUES (${userId}, ${task.id}, ${account.handle}) ON CONFLICT DO NOTHING`)
    return 'verified'
  }
  return 'review'
}

export async function socialCheckCount(userId: string, taskId: number) {
  await ensureChecks()
  const found = await rows(sql`SELECT 1 FROM social_task_checks WHERE user_id = ${userId} AND task_id = ${taskId}`)
  return found.length
}
