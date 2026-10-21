import 'server-only'
import { rows, sql } from '@/lib/db'

const TELEGRAM_EVERY_SEC = 180
const KANKATV_EVERY_SEC = 60

/**
 * Atomically claims a time slot so only one request per interval runs the job,
 * no matter how many visitors hit the site at once.
 */
async function claim(key: string, seconds: number) {
  const r = await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE tg_settings.value::timestamptz < now() - make_interval(secs => ${seconds})
    RETURNING key`)
  return r.length > 0
}

async function telegramTick() {
  if (!(await claim('auto_tick_telegram', TELEGRAM_EVERY_SEC))) return
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
  if (!(await claim('auto_tick_kankatv', KANKATV_EVERY_SEC))) return
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

/** Keeps bots posting even when no external cron is configured; driven by site traffic. */
export async function runAutoTick() {
  await Promise.all([
    telegramTick().catch((e) => console.error('[auto-tick] telegram', e)),
    kankatvTick().catch((e) => console.error('[auto-tick] kankatv', e)),
  ])
}
