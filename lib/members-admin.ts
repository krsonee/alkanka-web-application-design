import 'server-only'
import { rows, sql } from '@/lib/db'
import { applyCoins } from '@/lib/wallet-ledger'
import { getPanelSession } from '@/lib/panel-auth'
import { logPanel } from '@/lib/panel-log'

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
  /** How many staff notes this member has. */
  notes: number
}

export type MemberDetail = MemberRow & {
  ipBlocked: boolean
  sessions: number
  lastIp: string | null
  lastSeen: string | null
  sameIpMembers: { id: string; name: string; email: string }[]
}

export type { AuditRow } from '@/lib/panel-log-shared'

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
    await rows(sql`CREATE TABLE IF NOT EXISTS member_notes (
      id bigserial PRIMARY KEY, user_id text NOT NULL, author text NOT NULL, author_username text NOT NULL, body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS member_notes_user ON member_notes (user_id, created_at DESC)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** Records a member-screen action in the panel log. */
export async function logAudit(action: string, target: string | null, detail: string | null) {
  await logPanel('users', action, target, detail)
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
  notes: string | null
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
    notes: Number(m.notes ?? 0),
  }
}

const memberJoins = sql`
  FROM public."user" u
  LEFT JOIN member_origin o ON o.user_id = u.id
  LEFT JOIN wallets w ON w.user_id = u.id
  LEFT JOIN tg_links l ON l.user_id = u.id
  LEFT JOIN member_bans b ON b.user_id = u.id AND (b.until IS NULL OR b.until > now())`

const baseSelect = sql`
  SELECT u.id, u.name, u.email, u.phone, u.image, u."createdAt" AS created_at,
    o.src, o.flagged, w.balance,
    (SELECT coalesce(sum(points), 0) FROM kp_events k WHERE k.user_id = u.id) AS points,
    l.tg_id::text AS tg_id, coalesce(l.tg_username, l.tg_name) AS tg_name,
    b.kind, b.until, b.reason,
    (SELECT count(*) FROM member_origin o2 WHERE o.ip_hash IS NOT NULL AND o2.ip_hash = o.ip_hash AND o2.user_id <> u.id) AS shared_ip,
    (SELECT count(*) FROM member_notes n WHERE n.user_id = u.id) AS notes
  ${memberJoins}`

/** Same rule as toRow(), in SQL, so status filtering and counting happen in the database. */
const statusExpr = sql`CASE
  WHEN b.kind = 'ban' THEN 'banli'
  WHEN b.kind = 'suspend' THEN 'donduruldu'
  WHEN coalesce(o.flagged, false)
    OR (o.ip_hash IS NOT NULL AND EXISTS (SELECT 1 FROM member_origin o2 WHERE o2.ip_hash = o.ip_hash AND o2.user_id <> u.id)) THEN 'supheli'
  ELSE 'aktif' END`

export const MEMBERS_PAGE_SIZE = 100
const EXPORT_LIMIT = 20000

export type MemberSort = 'yeni' | 'eski' | 'bakiye' | 'puan' | 'son'
export const MEMBER_SORTS: readonly MemberSort[] = ['yeni', 'eski', 'bakiye', 'puan', 'son']

export type MemberFilters = {
  q?: string
  status?: MemberStatus | 'tumu'
  sort?: MemberSort
  /** Part of the signup source, e.g. "telegram" or a campaign code. */
  source?: string
  /** Signup date range, YYYY-MM-DD, both ends included. */
  from?: string
  to?: string
  minBalance?: number | null
  maxBalance?: number | null
  telegram?: 'var' | 'yok' | ''
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const wholeOrNull = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)))

function memberWhere(f: MemberFilters, withStatus: boolean) {
  const parts = [sql`TRUE`]
  const q = (f.q ?? '').trim().slice(0, 80)
  if (q) {
    const like = `%${q}%`
    parts.push(sql`(u.name ILIKE ${like} OR u.email ILIKE ${like} OR coalesce(u.phone, '') ILIKE ${like} OR coalesce(l.tg_id::text, '') ILIKE ${like} OR coalesce(l.tg_username, '') ILIKE ${like})`)
  }
  const source = (f.source ?? '').trim().slice(0, 60)
  if (source) parts.push(sql`coalesce(o.src, '') ILIKE ${`%${source}%`}`)
  if (f.from && DAY.test(f.from)) parts.push(sql`u."createdAt" >= ${f.from}::date`)
  if (f.to && DAY.test(f.to)) parts.push(sql`u."createdAt" < (${f.to}::date + 1)`)
  const min = wholeOrNull(f.minBalance)
  const max = wholeOrNull(f.maxBalance)
  if (min != null) parts.push(sql`coalesce(w.balance, 0) >= ${min}`)
  if (max != null) parts.push(sql`coalesce(w.balance, 0) <= ${max}`)
  if (f.telegram === 'var') parts.push(sql`l.tg_id IS NOT NULL`)
  if (f.telegram === 'yok') parts.push(sql`l.tg_id IS NULL`)
  if (withStatus && f.status && f.status !== 'tumu') parts.push(sql`${statusExpr} = ${f.status}`)
  return sql`WHERE ${sql.join(parts, sql` AND `)}`
}

function memberOrder(sort: MemberSort | undefined) {
  if (sort === 'eski') return sql`ORDER BY u."createdAt" ASC`
  if (sort === 'bakiye') return sql`ORDER BY coalesce(w.balance, 0) DESC, u."createdAt" DESC`
  if (sort === 'puan') return sql`ORDER BY points DESC, u."createdAt" DESC`
  if (sort === 'son') return sql`ORDER BY (SELECT max(s."updatedAt") FROM session s WHERE s."userId" = u.id) DESC NULLS LAST, u."createdAt" DESC`
  return sql`ORDER BY u."createdAt" DESC`
}

type MemberCounts = Record<MemberStatus | 'tumu', number>

/** Per-status totals under the given filters (the status filter itself is ignored so every tab shows its own count). */
export async function memberCounts(f: MemberFilters = {}): Promise<MemberCounts> {
  await ensureMemberAdmin()
  const tally = await rows<{ st: MemberStatus; c: string }>(sql`
    SELECT st, count(*) AS c FROM (SELECT ${statusExpr} AS st ${memberJoins} ${memberWhere(f, false)}) x GROUP BY st`)
  const counts: MemberCounts = { tumu: 0, aktif: 0, donduruldu: 0, banli: 0, supheli: 0 }
  for (const t of tally) {
    const n = Number(t.c)
    if (t.st in counts) counts[t.st] = n
    counts.tumu += n
  }
  return counts
}

export async function listMembers(
  opts: MemberFilters & { page?: number } = {},
): Promise<{ members: MemberRow[]; counts: MemberCounts; total: number; page: number; pageSize: number }> {
  const counts = await memberCounts(opts)
  const status = opts.status ?? 'tumu'
  const total = counts[status] ?? 0
  const lastPage = Math.max(0, Math.ceil(total / MEMBERS_PAGE_SIZE) - 1)
  const page = Math.min(Math.max(0, Math.floor(opts.page ?? 0)), lastPage)
  const raw = await rows<RawMember>(
    sql`${baseSelect} ${memberWhere(opts, true)} ${memberOrder(opts.sort)} LIMIT ${MEMBERS_PAGE_SIZE} OFFSET ${page * MEMBERS_PAGE_SIZE}`,
  )
  return { members: raw.map(toRow), counts, total, page, pageSize: MEMBERS_PAGE_SIZE }
}

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function exportMembersCsv(opts: MemberFilters = {}) {
  await ensureMemberAdmin()
  const raw = await rows<RawMember>(sql`${baseSelect} ${memberWhere(opts, true)} ${memberOrder(opts.sort)} LIMIT ${EXPORT_LIMIT}`)
  const filtered = raw.map(toRow)
  const head = ['id', 'ad', 'e-posta', 'telefon', 'kayit', 'kaynak', 'bakiye', 'puan', 'telegram_id', 'telegram', 'durum', 'ortak_ip']
  const lines = filtered.map((m) =>
    [m.id, m.name, m.email, m.phone, m.createdAt, m.source, m.balance, m.points, m.telegramId, m.telegramName, m.status, m.sharedIp].map(csvCell).join(','),
  )
  return { csv: '\uFEFF' + [head.join(','), ...lines].join('\n'), count: filtered.length, capped: filtered.length >= EXPORT_LIMIT }
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

export async function memberLabel(userId: string) {
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
  const n = Number(amount)
  const text = reason.trim()
  if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 1_000_000) throw new Error('Tutar -1.000.000 ile 1.000.000 arasında, sıfırdan farklı bir tam sayı olmalı.')
  if (text.length < 3) throw new Error('İşlem gerekçesi yazmalısın.')
  const label = await memberLabel(userId)
  await rows(sql`INSERT INTO wallets (user_id, balance) VALUES (${userId}, 0) ON CONFLICT (user_id) DO NOTHING`)
  const balance = await applyCoins(userId, n, `Panel düzeltmesi: ${text}`, { min: 0 })
  if (balance === null) throw new Error('Bakiye eksiye düşemez.')
  await logAudit(n > 0 ? 'Manuel Kanka Coin eklendi' : 'Manuel Kanka Coin düşüldü', label, `${n > 0 ? '+' : ''}${n} KC · ${text}`)
  return balance
}

export type MemberActivity = {
  games: { id: number; game: string; mode: string; opponent: string; stake: number; result: string; delta: number; createdAt: string }[]
  gameSummary: { played: number; wins: number; net: number; byGame: { game: string; played: number; net: number }[] }
  points: { id: number; source: string; points: number; note: string | null; createdAt: string }[]
  market: { id: number; itemName: string; price: number; status: string; createdAt: string }[]
  badges: { id: string; name: string; tier: string; count: number; lastAt: string; lastAwardId: number }[]
  audit: { id: number; actor: string; action: string; detail: string | null; createdAt: string }[]
}

const iso = (v: unknown) => new Date(String(v)).toISOString()

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

/** Everything the panel shows on the member detail tabs. Each block tolerates a missing table. */
export async function memberActivity(userId: string): Promise<MemberActivity> {
  await ensureMemberAdmin()
  const [u] = await rows<{ email: string }>(sql`SELECT email FROM public."user" WHERE id = ${userId}`)
  if (!u) throw new Error('Üye bulunamadı.')

  const [games, summary, byGame, points, market, badges, audit] = await Promise.all([
    safe(() => rows(sql`SELECT id, game, mode, opponent, stake, result, delta, created_at FROM game_history WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 60`), []),
    safe(() => rows<{ played: string; wins: string; net: string | null }>(sql`SELECT count(*) FILTER (WHERE game <> 'turnuva') AS played, count(*) FILTER (WHERE result = 'win' AND game <> 'turnuva') AS wins, sum(delta) AS net FROM game_history WHERE user_id = ${userId}`), []),
    safe(() => rows<{ game: string; played: string; net: string | null }>(sql`SELECT game, count(*) AS played, sum(delta) AS net FROM game_history WHERE user_id = ${userId} AND game <> 'turnuva' GROUP BY game ORDER BY count(*) DESC`), []),
    safe(() => rows(sql`SELECT id, source, points, note, created_at FROM kp_events WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 60`), []),
    safe(() => rows(sql`SELECT id, item_name, price, status, created_at FROM market_requests WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 30`), []),
    safe(() => rows(sql`SELECT b.id, b.name, b.tier, count(*) AS n, max(a.awarded_at) AS last_at, max(a.id) AS last_award_id FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id WHERE a.user_id = ${userId} GROUP BY b.id ORDER BY max(a.awarded_at) DESC`), []),
    rows(sql`SELECT id, actor, action, detail, created_at FROM panel_audit WHERE target LIKE ${`%<${u.email}>%`} ORDER BY created_at DESC LIMIT 60`),
  ])

  return {
    games: games.map((g) => ({ id: Number(g.id), game: String(g.game), mode: String(g.mode), opponent: String(g.opponent ?? ''), stake: Number(g.stake), result: String(g.result), delta: Number(g.delta), createdAt: iso(g.created_at) })),
    gameSummary: {
      played: Number(summary[0]?.played ?? 0),
      wins: Number(summary[0]?.wins ?? 0),
      net: Number(summary[0]?.net ?? 0),
      byGame: byGame.map((g) => ({ game: g.game, played: Number(g.played), net: Number(g.net ?? 0) })),
    },
    points: points.map((p) => ({ id: Number(p.id), source: String(p.source), points: Number(p.points), note: p.note ? String(p.note) : null, createdAt: iso(p.created_at) })),
    market: market.map((m) => ({ id: Number(m.id), itemName: String(m.item_name), price: Number(m.price), status: String(m.status), createdAt: iso(m.created_at) })),
    badges: badges.map((b) => ({ id: String(b.id), name: String(b.name), tier: String(b.tier), count: Number(b.n), lastAt: iso(b.last_at), lastAwardId: Number(b.last_award_id) })),
    audit: audit.map((a) => ({ id: Number(a.id), actor: String(a.actor), action: String(a.action), detail: a.detail ? String(a.detail) : null, createdAt: iso(a.created_at) })),
  }
}

/** Credits KC as a gift and drops a note into the member's inbox. */
export async function giftMember(userId: string, amount: number, message: string) {
  await ensureMemberAdmin()
  const n = Math.trunc(Number(amount))
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) throw new Error('Hediye 1 ile 100.000 KC arasında olmalı.')
  const text = message.trim().slice(0, 300)
  const label = await memberLabel(userId)
  await rows(sql`INSERT INTO wallets (user_id, balance) VALUES (${userId}, 0) ON CONFLICT (user_id) DO NOTHING`)
  const balance = await applyCoins(userId, n, 'Panel hediyesi')
  if (balance === null) throw new Error('Üyenin cüzdanı bulunamadı.')
  const session = await getPanelSession()
  const { sendMessage } = await import('@/lib/inbox')
  await sendMessage({
    userId,
    targetLabel: label,
    title: `${n.toLocaleString('tr-TR')} Kanka Coin hediye!`,
    body: text || 'Alkanka ekibinden sana bir hediye var. Keyfini çıkar kanka!',
    url: '/market',
    sentBy: session?.displayName ?? 'Alkanka',
  }).catch((error) => console.error('[gift inbox]', error))
  await logAudit('Hediye gönderildi', label, `+${n} KC${text ? ` · ${text}` : ''}`)
  return balance
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
