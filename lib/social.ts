import 'server-only'
import { randomBytes } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { getContent, setContent } from '@/lib/content'
import { ensureKp } from '@/lib/kanka-puan'
import {
  cleanHandle,
  isPlatform,
  isPlatformUrl,
  type AccountStatus,
  type EntryStatus,
  type MyEntry,
  type SocialAccount,
  type SocialEvent,
  type SocialLinks,
  type SocialPlatform,
} from '@/lib/social-shared'

export * from '@/lib/social-shared'

export const SOCIAL_KEY = 'social:links'

let ready: Promise<unknown> | null = null
function ensureSocial() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS social_accounts (
      user_id text NOT NULL, platform text NOT NULL, handle text NOT NULL, code text NOT NULL,
      status text NOT NULL DEFAULT 'pending', note text, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, platform))`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_handle ON social_accounts (platform, lower(handle)) WHERE status <> 'rejected'`)
    await rows(sql`CREATE TABLE IF NOT EXISTS social_events (
      id serial PRIMARY KEY, platform text NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '',
      post_url text NOT NULL, reward int NOT NULL DEFAULT 0, ends_at timestamptz, active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS social_entries (
      event_id int NOT NULL REFERENCES social_events(id) ON DELETE CASCADE, user_id text NOT NULL, comment_url text NOT NULL,
      status text NOT NULL DEFAULT 'pending', note text, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (event_id, user_id))`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS social_entries_url ON social_entries (event_id, lower(comment_url))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)

// --- Official accounts ---------------------------------------------------

export async function getSocialLinks(): Promise<SocialLinks> {
  return (await getContent<SocialLinks>(SOCIAL_KEY)) ?? {}
}

export async function saveSocialLinks(input: SocialLinks) {
  const out: SocialLinks = {}
  for (const [key, raw] of Object.entries(input)) {
    if (!isPlatform(key)) continue
    const url = String(raw ?? '').trim()
    if (!url) continue
    if (!isPlatformUrl(key, url)) throw new Error(`${key} adresi geçersiz. https:// ile başlayan profil linkini yapıştır.`)
    out[key] = url
  }
  await setContent(SOCIAL_KEY, out)
  return out
}

// --- Member accounts -----------------------------------------------------

const mapAccount = (r: Record<string, unknown>): SocialAccount => ({
  platform: r.platform as SocialPlatform,
  handle: String(r.handle),
  code: String(r.code),
  status: r.status as AccountStatus,
  note: r.note ? String(r.note) : null,
})

export async function mySocialAccounts(userId: string): Promise<SocialAccount[]> {
  await ensureSocial()
  const r = await rows(sql`SELECT * FROM social_accounts WHERE user_id = ${userId} ORDER BY platform`)
  return r.map(mapAccount)
}

export async function linkSocialAccount(userId: string, platform: string, raw: string) {
  if (!isPlatform(platform)) throw new Error('Platform geçersiz.')
  const handle = cleanHandle(platform, raw)
  if (!handle) throw new Error('Kullanıcı adı geçersiz. Sadece @ sonrasındaki adı yaz.')
  await ensureSocial()
  const taken = await rows(sql`SELECT 1 FROM social_accounts
    WHERE platform = ${platform} AND lower(handle) = lower(${handle}) AND status <> 'rejected' AND user_id <> ${userId}`)
  if (taken.length) throw new Error('Bu hesap başka bir üyeye bağlı. Hesap senin ise destekle iletişime geç.')
  const code = `KANKA-${randomBytes(3).toString('hex').toUpperCase()}`
  await rows(sql`INSERT INTO social_accounts (user_id, platform, handle, code, status)
    VALUES (${userId}, ${platform}, ${handle}, ${code}, 'pending')
    ON CONFLICT (user_id, platform) DO UPDATE SET handle = EXCLUDED.handle, code = EXCLUDED.code,
      status = 'pending', note = NULL, updated_at = now()`)
}

export async function removeSocialAccount(userId: string, platform: string) {
  await ensureSocial()
  await rows(sql`DELETE FROM social_accounts WHERE user_id = ${userId} AND platform = ${platform}`)
}

export type AdminSocialAccount = SocialAccount & { userId: string; userName: string; email: string; updatedAt: string }

export async function adminSocialAccounts(): Promise<AdminSocialAccount[]> {
  await ensureSocial()
  const r = await rows(sql`SELECT a.*, u.name, u.email FROM social_accounts a LEFT JOIN public."user" u ON u.id = a.user_id
    ORDER BY (a.status = 'pending') DESC, a.updated_at DESC LIMIT 200`)
  return r.map((x) => ({
    ...mapAccount(x),
    userId: String(x.user_id),
    userName: String(x.name ?? 'Kanka'),
    email: String(x.email ?? ''),
    updatedAt: iso(x.updated_at) ?? '',
  }))
}

export async function setSocialAccountStatus(userId: string, platform: string, status: AccountStatus, note: string) {
  await ensureSocial()
  await rows(sql`UPDATE social_accounts SET status = ${status}, note = ${note.trim().slice(0, 120) || null}, updated_at = now()
    WHERE user_id = ${userId} AND platform = ${platform}`)
}

// --- Events --------------------------------------------------------------

const mapEvent = (r: Record<string, unknown>): SocialEvent => ({
  id: Number(r.id),
  platform: r.platform as SocialPlatform,
  title: String(r.title),
  description: String(r.description ?? ''),
  postUrl: String(r.post_url),
  reward: Number(r.reward),
  endsAt: iso(r.ends_at),
  active: Boolean(r.active),
  entries: Number(r.entries ?? 0),
})

export async function listSocialEvents(opts: { includeInactive?: boolean } = {}): Promise<SocialEvent[]> {
  await ensureSocial()
  const r = opts.includeInactive
    ? await rows(sql`SELECT e.*, (SELECT count(*) FROM social_entries s WHERE s.event_id = e.id) AS entries
        FROM social_events e ORDER BY e.created_at DESC LIMIT 50`)
    : await rows(sql`SELECT e.*, (SELECT count(*) FROM social_entries s WHERE s.event_id = e.id AND s.status = 'approved') AS entries
        FROM social_events e WHERE e.active AND (e.ends_at IS NULL OR e.ends_at > now()) ORDER BY e.created_at DESC`)
  return r.map(mapEvent)
}

export type EventInput = { platform: string; title: string; description: string; postUrl: string; reward: number; endsAt: string | null }

export async function createSocialEvent(input: EventInput) {
  if (!isPlatform(input.platform)) throw new Error('Platform geçersiz.')
  const title = input.title.trim().slice(0, 80)
  if (title.length < 3) throw new Error('Başlık en az 3 karakter olmalı.')
  if (!isPlatformUrl(input.platform, input.postUrl)) throw new Error('Gönderi linki seçilen platforma ait olmalı.')
  const reward = Math.floor(Number(input.reward))
  if (!Number.isFinite(reward) || reward < 0 || reward > 10000) throw new Error('Ödül 0 ile 10.000 KP arasında olmalı.')
  const endsAt = input.endsAt ? new Date(input.endsAt) : null
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error('Bitiş tarihi geçersiz.')
  await ensureSocial()
  await rows(sql`INSERT INTO social_events (platform, title, description, post_url, reward, ends_at)
    VALUES (${input.platform}, ${title}, ${input.description.trim().slice(0, 400)}, ${input.postUrl.trim()}, ${reward}, ${endsAt?.toISOString() ?? null})`)
}

export async function setSocialEventActive(id: number, active: boolean) {
  await ensureSocial()
  await rows(sql`UPDATE social_events SET active = ${active} WHERE id = ${id}`)
}

export async function deleteSocialEvent(id: number) {
  await ensureSocial()
  await rows(sql`DELETE FROM social_events WHERE id = ${id}`)
}

export async function myEntries(userId: string): Promise<MyEntry[]> {
  await ensureSocial()
  const r = await rows(sql`SELECT event_id, status, note FROM social_entries WHERE user_id = ${userId}`)
  return r.map((x) => ({ eventId: Number(x.event_id), status: x.status as EntryStatus, note: x.note ? String(x.note) : null }))
}

export async function joinSocialEvent(userId: string, eventId: number, commentUrl: string) {
  await ensureSocial()
  const ev = (await rows(sql`SELECT * FROM social_events WHERE id = ${eventId} AND active AND (ends_at IS NULL OR ends_at > now())`))[0]
  if (!ev) throw new Error('Etkinlik bulunamadı veya sona erdi.')
  const platform = ev.platform as SocialPlatform
  const account = (await rows(sql`SELECT status FROM social_accounts WHERE user_id = ${userId} AND platform = ${platform}`))[0]
  if (account?.status !== 'verified') throw new Error('Katılmak için önce bu platformdaki hesabını bağlayıp doğrulatmalısın.')
  const flagged = await rows(sql`SELECT 1 FROM member_origin WHERE user_id = ${userId} AND flagged`).catch(() => [])
  if (flagged.length) throw new Error('Hesabın incelemede. Etkinliklere şu an katılamazsın.')
  const url = commentUrl.trim()
  if (!isPlatformUrl(platform, url)) throw new Error('Yorumunun linkini yapıştır (aynı platformdan olmalı).')
  try {
    await rows(sql`INSERT INTO social_entries (event_id, user_id, comment_url) VALUES (${eventId}, ${userId}, ${url})`)
  } catch {
    throw new Error('Bu etkinliğe zaten katıldın ya da bu yorum linki başka biri tarafından gönderildi.')
  }
}

export type AdminEntry = {
  eventId: number
  eventTitle: string
  platform: SocialPlatform
  userId: string
  userName: string
  handle: string | null
  commentUrl: string
  status: EntryStatus
  createdAt: string
}

export async function adminEntries(): Promise<AdminEntry[]> {
  await ensureSocial()
  const r = await rows(sql`SELECT s.*, e.title, e.platform, u.name, a.handle FROM social_entries s
    JOIN social_events e ON e.id = s.event_id
    LEFT JOIN public."user" u ON u.id = s.user_id
    LEFT JOIN social_accounts a ON a.user_id = s.user_id AND a.platform = e.platform
    ORDER BY (s.status = 'pending') DESC, s.created_at DESC LIMIT 200`)
  return r.map((x) => ({
    eventId: Number(x.event_id),
    eventTitle: String(x.title),
    platform: x.platform as SocialPlatform,
    userId: String(x.user_id),
    userName: String(x.name ?? 'Kanka'),
    handle: x.handle ? String(x.handle) : null,
    commentUrl: String(x.comment_url),
    status: x.status as EntryStatus,
    createdAt: iso(x.created_at) ?? '',
  }))
}

/** Approving pays the event reward once as KP; a later rejection does not claw it back automatically. */
export async function reviewEntry(eventId: number, userId: string, approve: boolean, note: string) {
  await ensureSocial()
  const updated = await rows(sql`UPDATE social_entries SET status = ${approve ? 'approved' : 'rejected'}, note = ${note.trim().slice(0, 120) || null}
    WHERE event_id = ${eventId} AND user_id = ${userId} AND status = 'pending' RETURNING event_id`)
  if (!updated.length || !approve) return 0
  const ev = (await rows(sql`SELECT title, reward FROM social_events WHERE id = ${eventId}`))[0]
  const reward = Number(ev?.reward ?? 0)
  if (reward > 0) {
    await ensureKp()
    await rows(sql`INSERT INTO kp_events (user_id, source, points, note) VALUES (${userId}, 'sosyal', ${reward}, ${`Sosyal etkinlik: ${String(ev.title)}`.slice(0, 120)})`)
  }
  return reward
}
