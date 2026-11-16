import 'server-only'
import type { SQL } from 'drizzle-orm'
import { rows, sql } from '@/lib/db'
import { clientIp, getPanelSession } from '@/lib/panel-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { AUDIT_EXPORT_LIMIT, AUDIT_PAGE_SIZE, type AuditPage, type AuditQuery, type AuditRow } from '@/lib/panel-log-shared'

export type AuditArea = PanelModule | 'auth' | 'staff' | 'account' | 'history'

type DbRow = { id: number; actor: string; area: string | null; action: string; target: string | null; detail: string | null; ip: string | null; created_at: string }

let ready: Promise<void> | null = null

export function ensurePanelLog() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS panel_audit (
      id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target text, detail text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE panel_audit ADD COLUMN IF NOT EXISTS area text`)
    await rows(sql`ALTER TABLE panel_audit ADD COLUMN IF NOT EXISTS ip text`)
    await rows(sql`CREATE INDEX IF NOT EXISTS panel_audit_created ON panel_audit (created_at DESC)`)
    // Everything written before areas existed came from the member screens.
    await rows(sql`UPDATE panel_audit SET area = 'users' WHERE area IS NULL`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/**
 * Records a panel action. Never throws: a failed log write must not undo or block the action itself.
 * `actor` is only passed where there is no session yet (a login attempt).
 */
export async function logPanel(area: AuditArea, action: string, target?: string | null, detail?: string | null, actor?: string) {
  try {
    await ensurePanelLog()
    const session = actor ? null : await getPanelSession()
    const who = actor ?? (session ? `${session.displayName} (@${session.username})` : 'sistem')
    const ip = await clientIp().catch(() => null)
    await rows(sql`INSERT INTO panel_audit (actor, area, action, target, detail, ip)
      VALUES (${who}, ${area}, ${action.slice(0, 120)}, ${target ? target.slice(0, 160) : null}, ${detail ? detail.slice(0, 400) : null}, ${ip})`)
  } catch (error) {
    console.error('[panel-log]', error)
  }
}

/**
 * Logs a finished action from the message it shows the admin and hands the result back, so a `return` stays one line.
 * The first sentence becomes the action, the rest the detail. Results that did not succeed are not logged.
 */
export async function logged<T extends { ok?: boolean; message?: string }>(area: AuditArea, result: T | Promise<T>): Promise<T> {
  const settled = await result
  const text = settled.ok ? String(settled.message ?? '').trim() : ''
  if (!text) return settled
  const end = text.search(/[.:!?](\s|$)/)
  const action = (end > 0 ? text.slice(0, end) : text).trim()
  const detail = end > 0 ? text.slice(end + 1).trim() : ''
  await logPanel(area, action || text, null, detail || null)
  return settled
}

/** "Ad <e-posta>" for a log line; falls back to the id so a deleted member never breaks the action being logged. */
export async function memberTag(userId: string) {
  try {
    const [u] = await rows<{ name: string | null; email: string }>(sql`SELECT name, email FROM public."user" WHERE id = ${userId}`)
    return u ? `${u.name || 'Kanka'} <${u.email}>` : `Üye ${userId}`
  } catch {
    return `Üye ${userId}`
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function where(query: AuditQuery): SQL {
  const parts: SQL[] = []
  const q = String(query.q ?? '').trim().slice(0, 80)
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    parts.push(sql`(actor ILIKE ${like} OR action ILIKE ${like} OR target ILIKE ${like} OR detail ILIKE ${like} OR ip ILIKE ${like})`)
  }
  if (query.actor) parts.push(sql`actor = ${String(query.actor).slice(0, 120)}`)
  if (query.area) parts.push(sql`area = ${String(query.area).slice(0, 40)}`)
  let from = DAY.test(query.from ?? '') ? query.from! : null
  let to = DAY.test(query.to ?? '') ? query.to! : null
  if (from && to && from > to) [from, to] = [to, from]
  if (from) parts.push(sql`created_at >= (${from}::timestamp AT TIME ZONE 'Europe/Istanbul')`)
  if (to) parts.push(sql`created_at < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul')`)
  return parts.length ? sql`WHERE ${sql.join(parts, sql` AND `)}` : sql``
}

const toRow = (a: DbRow): AuditRow => ({
  id: Number(a.id),
  actor: a.actor,
  area: a.area,
  action: a.action,
  target: a.target,
  detail: a.detail,
  ip: a.ip,
  createdAt: new Date(a.created_at).toISOString(),
})

const COLUMNS = sql`id, actor, area, action, target, detail, ip, created_at`

export async function searchAudit(query: AuditQuery = {}): Promise<AuditPage> {
  await ensurePanelLog()
  const filter = where(query)
  const page = Math.max(0, Math.floor(Number(query.page) || 0))
  const [list, count, actors, areas] = await Promise.all([
    rows<DbRow>(sql`SELECT ${COLUMNS} FROM panel_audit ${filter} ORDER BY created_at DESC, id DESC LIMIT ${AUDIT_PAGE_SIZE} OFFSET ${page * AUDIT_PAGE_SIZE}`),
    rows<{ n: number }>(sql`SELECT count(*)::int AS n FROM panel_audit ${filter}`),
    rows<{ actor: string }>(sql`SELECT DISTINCT actor FROM panel_audit ORDER BY actor`),
    rows<{ area: string }>(sql`SELECT DISTINCT area FROM panel_audit WHERE area IS NOT NULL ORDER BY area`),
  ])
  return {
    rows: list.map(toRow),
    total: count[0]?.n ?? 0,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    actors: actors.map((a) => a.actor),
    areas: areas.map((a) => a.area),
  }
}

export async function exportAudit(query: AuditQuery = {}): Promise<AuditRow[]> {
  await ensurePanelLog()
  const list = await rows<DbRow>(sql`SELECT ${COLUMNS} FROM panel_audit ${where(query)} ORDER BY created_at DESC, id DESC LIMIT ${AUDIT_EXPORT_LIMIT}`)
  return list.map(toRow)
}

/** Latest actions for the overview card. Sign-ins are left out so they do not push real work off the list. */
export async function recentAudit(limit = 8): Promise<AuditRow[]> {
  await ensurePanelLog()
  const list = await rows<DbRow>(sql`SELECT ${COLUMNS} FROM panel_audit WHERE area IS DISTINCT FROM 'auth' ORDER BY created_at DESC, id DESC LIMIT ${limit}`)
  return list.map(toRow)
}

export const LOGIN_ACTION = 'Panele giriş yapıldı'

/** Address of each account's latest sign-in, keyed by username. */
export async function lastLoginAddresses(): Promise<Record<string, string>> {
  await ensurePanelLog()
  const list = await rows<{ actor: string; ip: string | null }>(sql`
    SELECT DISTINCT ON (actor) actor, ip FROM panel_audit
    WHERE area = 'auth' AND action = ${LOGIN_ACTION}
    ORDER BY actor, created_at DESC`)
  const out: Record<string, string> = {}
  for (const r of list) {
    const username = /\(@([^)]+)\)$/.exec(r.actor)?.[1]
    if (username && r.ip) out[username.toLowerCase()] = r.ip
  }
  return out
}

/** True when the same line was already written for this target in the last `minutes`; keeps repeated blocked sign-ins from flooding the log. */
export async function loggedRecently(area: AuditArea, action: string, target: string, minutes: number) {
  try {
    await ensurePanelLog()
    const [hit] = await rows(sql`SELECT 1 FROM panel_audit WHERE area = ${area} AND action = ${action} AND target = ${target} AND created_at > now() - make_interval(mins => ${minutes}) LIMIT 1`)
    return Boolean(hit)
  } catch {
    return true
  }
}
