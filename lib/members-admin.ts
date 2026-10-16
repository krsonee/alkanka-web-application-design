import 'server-only'
import { rows, sql } from '@/lib/db'
import { getPanelSession } from '@/lib/panel-auth'

export type MemberStatus = 'aktif' | 'donduruldu' | 'banli' | 'supheli'

export type MemberRow = {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  createdAt: string
  source: string | null
  balance: number
  points: number
  telegramId: string | null
  telegramName: string | null
  status: MemberStatus
  banUntil: string | null
  banReason: string | null
  sharedIp: number
}

export type MemberDetail = MemberRow & {
  ipBlocked: boolean
  sessions: number
  lastIp: string | null
  lastSeen: string | null
  sameIpMembers: { id: string; name: string; email: string }[]
}

export type AuditRow = { id: number; actor: string; action: string; target: string | null; detail: string | null; createdAt: string }

let ready: Promise<void> | null = null

export function ensureMemberAdmin() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS member_bans (
      user_id text PRIMARY KEY, kind text NOT NULL, until timestamptz, reason text NOT NULL, ip_block boolean NOT NULL DEFAULT false,
      ip text, created_by text, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS panel_audit (
      id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target text, detail text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS panel_audit_created ON panel_audit (created_at DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS member_origin (
      user_id text PRIMARY KEY, src text NOT NULL, ip_hash text, flagged boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS wallets (user_id text PRIMARY KEY, balance int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_events (
      id serial PRIMARY KEY, user_id text NOT NULL, source text NOT NULL, points int NOT NULL, ref text, note text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_links (
      user_id text PRIMARY KEY, tg_id bigint NOT NULL UNIQUE, tg_username text, tg_name text NOT NULL,
      linked_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** Records a panel staff action. Never throws: an audit failure must not block the action itself. */
export async function logAudit(action: string, target: string | null, detail: string | null) {
  try {
    await ensureMemberAdmin()
    const session = await getPanelSession()
    const actor = session ? `${session.displayName} (@${session.username})` : 'sistem'
    await rows(sql`INSERT INTO panel_audit (actor, action, target, detail) VALUES (${actor}, ${action}, ${target?.slice(0, 160) ?? null}, ${detail?.slice(0, 400) ?? null})`)
  } catch (error) {
    console.error('[audit]', error)
  }
}

export async function listAudit(limit = 200): Promise<AuditRow[]> {
  await ensureMemberAdmin()
  const r = await rows<{ id: number; actor: string; action: string; target: string | null; detail: string | null; created_at: string }>(
    sql`SELECT id, actor, action, target, detail, created_at FROM panel_audit ORDER BY created_at DESC LIMIT ${limit}`,
  )
  return r.map((a) => ({ id: Number(a.id), actor: a.actor, action: a.action, target: a.target, detail: a.detail, createdAt: new Date(a.created_at).toISOString() }))
}

/** True when the member is suspended or banned right now. Missing tables count as "not banned". */
export async function isBanned(userId: string): Promise<boolean> {
  try {
    const r = await rows(sql`SELECT 1 FROM member_bans WHERE user_id = ${userId} AND (until IS NULL OR until > now())`)
    return r.length > 0
  } catch {
    return false
  }
}

export async function isIpBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false
  try {
    const r = await rows(sql`SELECT 1 FROM member_bans WHERE ip_block AND ip = ${ip} AND (until IS NULL OR until > now()) LIMIT 1`)
    return r.length > 0
  } catch {
    return false
  }
}

type RawMember = {
  id: string
  name: string | null
  email: string
  phone: string | null
  image: string | null
  created_at: string
  src: string | null
  flagged: boolean | null
  balance: number | null
  points: string | null
  tg_id: string | null
  tg_name: string | null
  kind: string | null
  until: string | null
  reason: string | null
  shared_ip: string | null
}

function toRow(m: RawMember): MemberRow {
  const sharedIp = Number(m.shared_ip ?? 0)
  const status: MemberStatus = m.kind === 'ban' ? 'banli' : m.kind === 'suspend' ? 'donduruldu' : m.flagged || sharedIp > 0 ? 'supheli' : 'aktif'
  return {
    id: m.id,
    name: m.name || 'Kanka',
    email: m.email,
    phone: m.phone,
    image: m.image,
    createdAt: new Date(m.created_at).toISOString(),
    source: m.src,
    balance: Number(m.balance ?? 0),
    points: Number(m.points ?? 0),
    telegramId: m.tg_id ? String(m.tg_id) : null,
    telegramName: m.tg_name,
    status,
    banUntil: m.until ? new Date(m.until).toISOString() : null,
    banReason: m.reason,
    sharedIp,
  }
}

const baseSelect = sql`
  SELECT u.id, u.name, u.email, u.phone, u.image, u."createdAt" AS created_at,
    o.src, o.flagged, w.balance,
    (SELECT coalesce(sum(points), 0) FROM kp_events k WHERE k.user_id = u.id) AS points,
    l.tg_id::text AS tg_id, coalesce(l.tg_username, l.tg_name) AS tg_name,
    b.kind, b.until, b.reason,
    (SELECT count(*) FROM member_origin o2 WHERE o.ip_hash IS NOT NULL AND o2.ip_hash = o.ip_hash AND o2.user_id <> u.id) AS shared_ip
  FROM public."user" u
  LEFT JOIN member_origin o ON o.user_id = u.id
  LEFT JOIN wallets w ON w.user_id = u.id
  LEFT JOIN tg_links l ON l.user_id = u.id
  LEFT JOIN member_bans b ON b.user_id = u.id AND (b.until IS NULL OR b.until > now())`

export async function listMembers(opts: { q?: string; status?: MemberStatus | 'tumu'; limit?: number } = {}): Promise<{ members: MemberRow[]; counts: Record<MemberStatus | 'tumu', number> }> {
  await ensureMemberAdmin()
  const q = (opts.q ?? '').trim()
  const like = `%${q}%`
  const filter = q
    ? sql`WHERE (u.name ILIKE ${like} OR u.email ILIKE ${like} OR coalesce(u.phone, '') ILIKE ${like} OR coalesce(l.tg_id::text, '') ILIKE ${like} OR coalesce(l.tg_username, '') ILIKE ${like})`
    : sql``
  const raw = await rows<RawMember>(sql`${baseSelect} ${filter} ORDER BY u."createdAt" DESC LIMIT 1000`)
  const all = raw.map(toRow)
  const counts = { tumu: all.length, aktif: 0, donduruldu: 0, banli: 0, supheli: 0 }
  for (const m of all) counts[m.status]++
  const status = opts.status ?? 'tumu'
  const members = (status === 'tumu' ? all : all.filter((m) => m.status === status)).slice(0, opts.limit ?? 300)
  return { members, counts }
}

export async function memberDetail(userId: string): Promise<MemberDetail | null> {
  await ensureMemberAdmin()
  const [raw] = await rows<RawMember>(sql`${baseSelect} WHERE u.id = ${userId}`)
  if (!raw) return null
  const [extra] = await rows<{ sessions: string; last_ip: string | null; last_seen: string | null; ip_block: boolean | null }>(sql`
    SELECT (SELECT count(*) FROM session s WHERE s."userId" = ${userId} AND s."expiresAt" > now()) AS sessions,
      (SELECT s."ipAddress" FROM session s WHERE s."userId" = ${userId} ORDER BY s."updatedAt" DESC LIMIT 1) AS last_ip,
      (SELECT max(s."updatedAt") FROM session s WHERE s."userId" = ${userId}) AS last_seen,
      (SELECT ip_block FROM member_bans WHERE user_id = ${userId}) AS ip_block`)
  const same = await rows<{ id: string; name: string | null; email: string }>(sql`
    SELECT DISTINCT u.id, u.name, u.email FROM public."user" u
    WHERE u.id <> ${userId} AND (
      u.id IN (SELECT o2.user_id FROM member_origin o1 JOIN member_origin o2 ON o2.ip_hash = o1.ip_hash WHERE o1.user_id = ${userId} AND o1.ip_hash IS NOT NULL)
      OR u.id IN (SELECT s2."userId" FROM session s1 JOIN session s2 ON s2."ipAddress" = s1."ipAddress" WHERE s1."userId" = ${userId} AND coalesce(s1."ipAddress", '') <> '')
    ) LIMIT 20`)
  return {
    ...toRow(raw),
    sharedIp: Math.max(toRow(raw).sharedIp, same.length),
    ipBlocked: !!extra?.ip_block,
    sessions: Number(extra?.sessions ?? 0),
    lastIp: extra?.last_ip ?? null,
    lastSeen: extra?.last_seen ? new Date(extra.last_seen).toISOString() : null,
    sameIpMembers: same.map((s) => ({ id: s.id, name: s.name || 'Kanka', email: s.email })),
  }
}

async function memberLabel(userId: string) {
  const [u] = await rows<{ name: string | null; email: string }>(sql`SELECT name, email FROM public."user" WHERE id = ${userId}`)
  if (!u) throw new Error('Üye bulunamadı.')
  return `${u.name || 'Kanka'} <${u.email}>`
}

const DURATIONS: Record<string, number | null> = { '1': 1, '7': 7, '30': 30, sure: null }

export async function suspendMember(userId: string, duration: string, reason: string) {
  await ensureMemberAdmin()
  const text = reason.trim()
  if (text.length < 3) throw new Error('Dondurma sebebi yazmalısın.')
  if (!(duration in DURATIONS)) throw new Error('Geçersiz süre.')
  const days = DURATIONS[duration]
  const label = await memberLabel(userId)
  const until = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null
  await rows(sql`INSERT INTO member_bans (user_id, kind, until, reason, ip_block, ip) VALUES (${userId}, 'suspend', ${until}, ${text.slice(0, 500)}, false, null)
    ON CONFLICT (user_id) DO UPDATE SET kind = 'suspend', until = EXCLUDED.until, reason = EXCLUDED.reason, ip_block = false, ip = null, created_at = now()`)
  await rows(sql`DELETE FROM session WHERE "userId" = ${userId}`)
  await logAudit('Üye donduruldu', label, `${days ? `${days} gün` : 'Süresiz'} · ${text}`)
}

export async function banMember(userId: string, reason: string, ipBlock: boolean) {
  await ensureMemberAdmin()
  const text = reason.trim()
  if (text.length < 3) throw new Error('Ban sebebi yazmalısın.')
  const label = await memberLabel(userId)
  const [last] = await rows<{ ip: string | null }>(sql`SELECT "ipAddress" AS ip FROM session WHERE "userId" = ${userId} ORDER BY "updatedAt" DESC LIMIT 1`)
  const ip = ipBlock ? (last?.ip ?? null) : null
  await rows(sql`INSERT INTO member_bans (user_id, kind, until, reason, ip_block, ip) VALUES (${userId}, 'ban', null, ${text.slice(0, 500)}, ${ipBlock}, ${ip})
    ON CONFLICT (user_id) DO UPDATE SET kind = 'ban', until = null, reason = EXCLUDED.reason, ip_block = EXCLUDED.ip_block, ip = EXCLUDED.ip, created_at = now()`)
  await rows(sql`DELETE FROM session WHERE "userId" = ${userId}`)
  await logAudit('Üye kalıcı banlandı', label, `${ipBlock ? 'IP de engellendi · ' : ''}${text}`)
}

export async function restoreMember(userId: string) {
  await ensureMemberAdmin()
  const label = await memberLabel(userId)
  await rows(sql`DELETE FROM member_bans WHERE user_id = ${userId}`)
  await logAudit('Üye hesabı açıldı', label, null)
}

export async function adjustWallet(userId: string, amount: number, reason: string) {
  await ensureMemberAdmin()
  const n = Math.trunc(Number(amount))
  const text = reason.trim()
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1_000_000) throw new Error('Tutar -1.000.000 ile 1.000.000 arasında ve sıfırdan farklı olmalı.')
  if (text.length < 3) throw new Error('İşlem gerekçesi yazmalısın.')
  const label = await memberLabel(userId)
  await rows(sql`INSERT INTO wallets (user_id, balance) VALUES (${userId}, 0) ON CONFLICT (user_id) DO NOTHING`)
  const r = await rows<{ balance: number }>(sql`UPDATE wallets SET balance = balance + ${n}, updated_at = now()
    WHERE user_id = ${userId} AND balance + ${n} >= 0 RETURNING balance`)
  if (!r.length) throw new Error('Bakiye eksiye düşemez.')
  await logAudit(n > 0 ? 'Manuel Kanka Coin eklendi' : 'Manuel Kanka Coin düşüldü', label, `${n > 0 ? '+' : ''}${n} KC · ${text}`)
  return Number(r[0].balance)
}

export async function revokeSessions(userId: string) {
  await ensureMemberAdmin()
  const label = await memberLabel(userId)
  await rows(sql`DELETE FROM session WHERE "userId" = ${userId}`)
  await logAudit('Üyenin tüm oturumları kapatıldı', label, 'Güvenlik sıfırlaması')
}

export async function unlinkTelegram(userId: string) {
  await ensureMemberAdmin()
  const label = await memberLabel(userId)
  await rows(sql`DELETE FROM tg_links WHERE user_id = ${userId}`)
  await logAudit('Telegram bağlantısı kaldırıldı', label, null)
}
