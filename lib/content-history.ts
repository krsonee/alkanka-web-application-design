import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureContentHistory as ensureHistory } from '@/lib/content'
import { HISTORY_PAGE_SIZE, trackedSetting, type HistoryChange, type HistoryPage, type HistoryRow } from '@/lib/panel-log-shared'

const MAX_CHANGES = 12

function flatten(value: unknown, path: string, out: Map<string, string>) {
  if (Array.isArray(value)) {
    if (!value.length) out.set(path, '(boş liste)')
    value.forEach((v, i) => flatten(v, `${path}[${i + 1}]`, out))
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) out.set(path, '(boş)')
    for (const [k, v] of entries) flatten(v, path ? `${path}.${k}` : k, out)
  } else {
    out.set(path || '(değer)', value === null || value === undefined || value === '' ? '(boş)' : String(value))
  }
}

function diff(before: unknown, after: unknown): { changes: HistoryChange[]; more: number } {
  const a = new Map<string, string>()
  const b = new Map<string, string>()
  if (before !== null && before !== undefined) flatten(before, '', a)
  if (after !== null && after !== undefined) flatten(after, '', b)
  const changes: HistoryChange[] = []
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(path) ?? '(yok)'
    const y = b.get(path) ?? '(yok)'
    if (x !== y) changes.push({ path, before: x.slice(0, 160), after: y.slice(0, 160) })
  }
  return { changes: changes.slice(0, MAX_CHANGES), more: Math.max(0, changes.length - MAX_CHANGES) }
}

type DbRow = { id: number; key: string; before: unknown; after: unknown; actor: string; created_at: string }

function toRow(r: DbRow): HistoryRow {
  const setting = trackedSetting(r.key)
  const { changes, more } = diff(r.before, r.after)
  return {
    id: Number(r.id),
    key: r.key,
    label: setting?.label ?? r.key,
    area: setting?.area ?? null,
    actor: r.actor,
    createdAt: new Date(r.created_at).toISOString(),
    changes,
    moreChanges: more,
    hadBefore: r.before !== null && r.before !== undefined,
  }
}

export async function listContentHistory(page = 0): Promise<HistoryPage> {
  await ensureHistory()
  const at = Math.max(0, Math.floor(Number(page) || 0))
  const [list, count] = await Promise.all([
    rows<DbRow>(sql`SELECT id, key, before, after, actor, created_at FROM site_content_history ORDER BY created_at DESC, id DESC LIMIT ${HISTORY_PAGE_SIZE} OFFSET ${at * HISTORY_PAGE_SIZE}`),
    rows<{ n: number }>(sql`SELECT count(*)::int AS n FROM site_content_history`),
  ])
  const mapped = list.map(toRow)
  return { rows: mapped, total: count[0]?.n ?? 0, page: at, pageSize: HISTORY_PAGE_SIZE, areas: [...new Set(mapped.map((r) => r.area).filter((a): a is string => Boolean(a)))] }
}

/** The state to go back to: what the setting held before the given save. */
export async function historyEntry(id: number): Promise<{ key: string; before: unknown; label: string; createdAt: string } | null> {
  await ensureHistory()
  const [r] = await rows<DbRow>(sql`SELECT id, key, before, after, actor, created_at FROM site_content_history WHERE id = ${id}`)
  if (!r) return null
  return { key: r.key, before: r.before, label: trackedSetting(r.key)?.label ?? r.key, createdAt: new Date(r.created_at).toISOString() }
}
