import 'server-only'
import { rows, sql } from '@/lib/db'

// Slots sit just under a minute so the once-a-minute scheduler never loses a turn to its own jitter.
const SLOT_SEC = 50
// A warm instance asks the database for a slot at most this often, however many pages it renders.
const LOCAL_GAP_MS = 10_000

let lastAttempt = 0

/**
 * Atomically claims a time slot so only one request per interval runs the job,
 * no matter how many visitors or scheduler calls arrive at once.
 */
async function claim(key: string, seconds: number) {
  const r = await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE tg_settings.value::timestamptz < now() - make_interval(secs => ${seconds})
    RETURNING key`)
  return r.length > 0
}

async function telegramTick() {
  if (!(await claim('auto_tick_telegram', SLOT_SEC))) return
  const [{ runMirror }, { pollShareBot }, { pollOddsBot }] = await Promise.all([
    import('@/lib/telegram-mirror'),
    import('@/lib/telegram-bots'),
    import('@/lib/special-odds'),
  ])
  await pollShareBot().catch((e) => console.error('[auto-tick] share bot', e))
  await pollOddsBot().catch((e) => console.error('[auto-tick] odds bot', e))
  await runMirror().catch((e) => console.error('[auto-tick] mirror', e))
}

async function kankatvTick() {
  if (!(await claim('auto_tick_kankatv', SLOT_SEC))) return
  const [{ scanGoals, settlePredictions }, { syncBets }] = await Promise.all([
    import('@/lib/kankatv-engage'),
    import('@/lib/tv-bets'),
  ])
  await Promise.all([
    scanGoals().catch((e) => console.error('[auto-tick] goals', e)),
    settlePredictions({ limit: 100 }).catch((e) => console.error('[auto-tick] predictions', e)),
    syncBets().catch((e) => console.error('[auto-tick] bets', e)),
  ])
}

async function hubTickSlot() {
  if (!(await claim('auto_tick_hub', SLOT_SEC))) return
  const { hubTick } = await import('@/lib/tg-hub-jobs')
  await hubTick()
}

/**
 * Runs every background job whose slot is free. Called once a minute by the scheduler
 * (/api/cron/tick) and after page renders as a backup, so both paths share the same slots.
 * `telegram: false` is for callers that have just run the Telegram jobs themselves.
 */
export async function runAutoTick({ telegram = true, force = false }: { telegram?: boolean; force?: boolean } = {}) {
  const now = Date.now()
  if (!force && now - lastAttempt < LOCAL_GAP_MS) return
  lastAttempt = now
  await Promise.all([
    telegram ? telegramTick().catch((e) => console.error('[auto-tick] telegram', e)) : null,
    kankatvTick().catch((e) => console.error('[auto-tick] kankatv', e)),
    hubTickSlot().catch((e) => console.error('[auto-tick] hub', e)),
  ])
}
