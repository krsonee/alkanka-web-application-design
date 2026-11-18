import 'server-only'
import { pool } from '@/lib/db'
import { listTournamentTablesDue, nudgeTournamentTable } from './pvp/tables'
import { cutTournament, startDueTournament } from './tournaments'

/** Tables looked at in one pass. The rest wait for the next one, a minute later at most while anyone is on the site. */
const TABLES_PER_TICK = 60

/**
 * Moves every tournament's clock: starts the ones whose time has come, forfeits matches whose players
 * did not sit down, plays the move clock at tables nobody is watching, and closes tournaments at their
 * end time. There is no schedule behind this. It runs when somebody opens the tournament page, with the
 * site's visitor-driven background jobs and once a day, so it costs one small query while no tournament
 * is due or running.
 */
export async function tournamentTick() {
  const due = await pool.query<{ id: number; status: string; ends_at: Date | null }>(
    `SELECT id, status, ends_at FROM tournaments WHERE status = 'basladi' OR (status = 'kayit' AND starts_at <= now()) ORDER BY starts_at ASC`,
  )
  if (!due.rowCount) return

  for (const t of due.rows.filter((r) => r.status === 'kayit')) {
    await startDueTournament(Number(t.id)).catch((error) => console.error('[tournaments] saatinde başlatma', error))
  }

  const running = due.rows.filter((r) => r.status === 'basladi')
  if (!running.length) return
  const now = Date.now()
  const ending = running.filter((r) => r.ends_at && new Date(r.ends_at).getTime() <= now)

  // A tournament at its end time is settled in full first: whoever failed to sit down before the end lost that match.
  for (const t of ending) {
    const late = await listTournamentTablesDue([Number(t.id)], { joinOnly: true, before: new Date(t.ends_at!) })
    for (const table of late) await nudgeTournamentTable(table).catch((error) => console.error('[tournaments] süre sonu masa', error))
  }

  const open = running.filter((r) => !ending.includes(r)).map((r) => Number(r.id))
  if (open.length) {
    const tables = await listTournamentTablesDue(open, { limit: TABLES_PER_TICK })
    for (const table of tables) await nudgeTournamentTable(table).catch((error) => console.error('[tournaments] masa saati', error))
  }

  for (const t of ending) await cutTournament(Number(t.id)).catch((error) => console.error('[tournaments] süre sonu', error))
}
