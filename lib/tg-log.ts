import 'server-only'
import type { SQL } from 'drizzle-orm'
import { rows, sql } from '@/lib/db'
import { LOG_COLUMNS, ensureHubTables, mapLogRow } from '@/lib/tg-hub'
import { LOG_KINDS, LOG_PAGE, type LogFilter, type LogPage } from '@/lib/tg-hub-shared'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const EXPORT_MAX = 5000

const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

const startsWithAny = (prefixes: readonly string[]) =>
  sql.join(
    prefixes.map((p) => sql`action LIKE ${`${likeSafe(p)}%`}`),
    sql` OR `,
  )

function where(f: LogFilter, beforeId?: number): SQL {
  const parts: SQL[] = []
  const kind = LOG_KINDS.find((k) => k.key === f.kind)
  if (kind) parts.push(sql`(${startsWithAny(kind.prefixes)})`)
  else if (f.kind === 'other') parts.push(sql`NOT (${startsWithAny(LOG_KINDS.flatMap((k) => [...k.prefixes]))})`)
  if (f.chatId) parts.push(sql`chat_id = ${String(f.chatId).slice(0, 40)}`)
  if (Number.isSafeInteger(f.tgId) && Number(f.tgId) > 0) parts.push(sql`tg_id = ${Number(f.tgId)}`)
  const q = String(f.q ?? '').trim().slice(0, 80)
  if (q) {
    const like = `%${likeSafe(q.replace(/^@/, ''))}%`
    // A bare number is a Telegram id far more often than a word in a reason.
    parts.push(
      /^\d{5,15}$/.test(q)
        ? sql`(tg_id = ${Number(q)} OR who ILIKE ${like} OR reason ILIKE ${like})`
        : sql`(who ILIKE ${like} OR reason ILIKE ${like} OR action ILIKE ${like} OR chat_title ILIKE ${like})`,
    )
  }
  if (f.from && DAY.test(f.from)) parts.push(sql`created_at >= (${f.from}::timestamp AT TIME ZONE 'Europe/Istanbul')`)
  if (f.to && DAY.test(f.to)) parts.push(sql`created_at < ((${f.to}::timestamp + interval '1 day') AT TIME ZONE 'Europe/Istanbul')`)
  if (beforeId) parts.push(sql`id < ${beforeId}`)
  return parts.length ? sql`WHERE ${sql.join(parts, sql` AND `)}` : sql``
}

export async function searchModLog(filter: LogFilter, beforeId?: number, limit = LOG_PAGE): Promise<LogPage> {
  await ensureHubTables()
  const before = Number.isSafeInteger(beforeId) && Number(beforeId) > 0 ? Number(beforeId) : undefined
  const r = await rows(sql`SELECT ${LOG_COLUMNS} FROM tg_mod_log ${where(filter, before)} ORDER BY id DESC LIMIT ${limit + 1}`)
  return { rows: r.slice(0, limit).map(mapLogRow), hasMore: r.length > limit }
}

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v)
  // A leading =, +, - or @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function exportModLog(filter: LogFilter) {
  await ensureHubTables()
  const r = await rows(sql`SELECT id, action, chat_title, tg_id, who, reason, created_at, undone FROM tg_mod_log ${where(filter)} ORDER BY id DESC LIMIT ${EXPORT_MAX + 1}`)
  const list = r.slice(0, EXPORT_MAX)
  const head = ['tarih', 'islem', 'grup', 'kisi', 'telegram_id', 'neden', 'geri_alindi']
  const lines = list.map((x) =>
    [
      new Date(String(x.created_at)).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
      x.action,
      x.chat_title,
      x.who,
      x.tg_id,
      x.reason,
      x.undone ? 'evet' : '',
    ]
      .map(csvCell)
      .join(','),
  )
  return { csv: '\uFEFF' + [head.join(','), ...lines].join('\n'), count: list.length, capped: r.length > EXPORT_MAX }
}
