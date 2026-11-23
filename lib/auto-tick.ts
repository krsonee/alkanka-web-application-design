import 'server-only'
import { rows, sql } from '@/lib/db'

const TELEGRAM_EVERY_SEC = 180
const KANKATV_EVERY_SEC = 60
const HUB_EVERY_SEC = 60
const LEDGER_PRUNE_EVERY_SEC = 6 * 3600
const LEDGER_LOOK_GAP_MS = 3_600_000
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

let lastLedgerLook = 0

/** Trims the coin ledger a few times a day. A warm instance asks about the slot at most once an hour. */
async function ledgerPruneSlot() {
  const now = Date.now()
  if (now - lastLedgerLook < LEDGER_LOOK_GAP_MS) return
  lastLedgerLook = now
  if (!(await claim('auto_tick_ledger_prune', LEDGER_PRUNE_EVERY_SEC))) return
  const { pruneLedger } = await import('@/lib/wallet-ledger')
  await pruneLedger()
}

async function hubTickSlot() {
  if (!(await claim('auto_tick_hub', HUB_EVERY_SEC))) return
  const [{ hubTick }, { runOutbox }, { settleDueEvents }, { tournamentTick }, { leagueTick }, { goalTick }, { ensureHotIndexes }] = await Promise.all([
    import('@/lib/tg-hub-jobs'),
    import('@/lib/outbox'),
    import('@/lib/event-entries'),
    import('@/lib/tournament-run'),
    import('@/lib/predictions'),
    import('@/lib/goal-rewards'),
    import('@/lib/hot-indexes'),
  ])
  // Scheduled notifications, inbox messages, event payouts, tournament clocks, league prizes and the ledger trim share this slot, so they wake nothing on their own.
  await Promise.all([
    hubTick(),
    runOutbox().catch((e) => console.error('[auto-tick] outbox', e)),
    settleDueEvents().catch((e) => console.error('[auto-tick] events', e)),
    tournamentTick().catch((e) => console.error('[auto-tick] tournaments', e)),
    leagueTick().catch((e) => console.error('[auto-tick] league', e)),
    goalTick().catch((e) => console.error('[auto-tick] goal', e)),
    ledgerPruneSlot().catch((e) => console.error('[auto-tick] ledger prune', e)),
    ensureHotIndexes().catch((e) => console.error('[auto-tick] indexes', e)),
  ])
}

const CHAT_SYNC_EVERY_SEC = 45
const CHAT_SYNC_LOOK_GAP_MS = 20_000
let lastChatSyncLook = 0

/**
 * Clears from the site chat what was deleted in the Telegram group. Rides on someone reading the site
 * chat, so it asks nothing of Telegram or the database while nobody is looking.
 */
export async function runChatSync() {
  const now = Date.now()
  if (now - lastChatSyncLook < CHAT_SYNC_LOOK_GAP_MS) return
  lastChatSyncLook = now
  if (!(await claim('auto_tick_chat_sync', CHAT_SYNC_EVERY_SEC))) return
  const { syncChatWithTelegram } = await import('@/lib/chat-sync')
  await syncChatWithTelegram()
}

let lastPostAttempt = 0

/**
 * For Telegram webhooks. The update has already woken the database, so scheduled posts, scheduled DM announcements,
 * quiet hours and button counters ride along with it instead of waiting for the next site visitor. Starts nothing on its own.
 */
export async function runPostTick() {
  const now = Date.now()
  if (now - lastPostAttempt < LOCAL_GAP_MS) return
  lastPostAttempt = now
  if (!(await claim('auto_tick_posts', HUB_EVERY_SEC))) return
  const [{ runPostJobs }, { processBroadcasts }, { runQuietHours }] = await Promise.all([
    import('@/lib/tg-posts'),
    import('@/lib/tg-broadcast'),
    import('@/lib/tg-quiet'),
  ])
  await Promise.all([
    runPostJobs().catch((e) => console.error('[post-tick] posts', e)),
    processBroadcasts().catch((e) => console.error('[post-tick] broadcast', e)),
    runQuietHours().catch((e) => console.error('[post-tick] quiet hours', e)),
  ])
}

/**
 * Runs every background job whose slot is free. Driven by site traffic (after page renders) and by
 * the keyed external trigger, never by a built-in every-minute schedule: that would keep the
 * database awake around the clock and burn through its monthly compute allowance.
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
