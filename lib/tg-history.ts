import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureHubTables } from '@/lib/tg-hub'
import type { HubConfig } from '@/lib/tg-hub-shared'
import { describeChanges, type ConfigChange } from '@/lib/tg-resilience-shared'

const KEEP = 200

let ready: Promise<void> | null = null
function ensureHistoryTables() {
  ready ??= (async () => {
    await ensureHubTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_config_log (
      id serial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), who text NOT NULL DEFAULT '', what text NOT NULL DEFAULT '',
      changes text NOT NULL DEFAULT '[]', before text NOT NULL)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/**
 * Keeps the settings as they were before a save, with who saved and what differs. A save that changes
 * nothing leaves no entry. Returns the lines it stored.
 */
export async function recordHubChange(before: HubConfig, after: HubConfig, who: string, what: string) {
  const changes = describeChanges(before, after)
  if (!changes.length) return changes
  await ensureHistoryTables()
  await rows(sql`INSERT INTO tg_config_log (who, what, changes, before) VALUES (${who}, ${what}, ${JSON.stringify(changes)}, ${JSON.stringify(before)})`)
  await rows(sql`DELETE FROM tg_config_log WHERE id <= (SELECT max(id) FROM tg_config_log) - ${KEEP}`)
  return changes
}

export async function listHubChanges(limit = 60): Promise<ConfigChange[]> {
  await ensureHistoryTables()
  const r = await rows(sql`SELECT id, at, who, what, changes FROM tg_config_log ORDER BY id DESC LIMIT ${limit}`)
  return r.map((x) => {
    let changes: string[] = []
    try {
      changes = (JSON.parse(String(x.changes)) as unknown[]).map(String)
    } catch {
      changes = []
    }
    return { id: Number(x.id), at: new Date(String(x.at)).toISOString(), who: String(x.who), what: String(x.what), changes }
  })
}

/** The settings as they stood just before the given change was saved, exactly as stored. */
export async function snapshotBefore(id: number): Promise<{ config: unknown; at: string; what: string } | null> {
  await ensureHistoryTables()
  const [row] = await rows<{ before: string; at: string; what: string }>(sql`SELECT before, at, what FROM tg_config_log WHERE id = ${id}`)
  if (!row) return null
  try {
    return { config: JSON.parse(row.before), at: new Date(String(row.at)).toISOString(), what: String(row.what) }
  } catch {
    return null
  }
}
