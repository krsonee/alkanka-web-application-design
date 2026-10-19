import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureCommunity } from '@/lib/community'
import { ensureTv, sendToTargets } from '@/lib/kankatv-engage'
import { getGameLive, type GameLive } from '@/lib/kankatv'
import { isRoleHolder } from '@/lib/kanka-puan'
import { credit, debit, getBalance } from '@/lib/member'
import { trDay } from '@/lib/task-period'
import {
  BET_KINDS,
  cleanBetsConfig,
  DEFAULT_BETS,
  type AdminMarket,
  type BetKind,
  type BetPhase,
  type BetsBotStatus,
  type BetsConfig,
  type BetsLog,
  type BetsState,
  type BetsStats,
  type BetStatus,
  type MarketStatus,
  type TvBet,
  type TvGameState,
  type TvMarket,
} from '@/lib/tv-bets-shared'

const CONFIG_KEY = 'tv_bets'
const SYNC_KEY = 'tv_bets_sync'
const BOT_KEY = 'tv_bets_bot'
const SYNC_EVERY_SECONDS = 40
/** Unsettled events older than this after kick-off are refunded (postponed / abandoned / no data). */
const VOID_AFTER_HOURS = 4

let ready: Promise<unknown> | null = null
export function ensureBets() {
  ready ??= (async () => {
    await ensureTv()
    await ensureCommunity()
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_markets (
      id serial PRIMARY KEY, slot text UNIQUE NOT NULL, game_id bigint NOT NULL, home text NOT NULL, away text NOT NULL,
      league text NOT NULL DEFAULT '', kickoff timestamptz NOT NULL, kind text NOT NULL, title text NOT NULL,
      line double precision, base int, phase text NOT NULL, mode text NOT NULL DEFAULT 'pool', status text NOT NULL DEFAULT 'open',
      options jsonb NOT NULL, rake int NOT NULL DEFAULT 0, close_minute int NOT NULL DEFAULT 0, suspended_until timestamptz,
      result text, created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tv_markets_live ON tv_markets (game_id, status)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_bets (
      id serial PRIMARY KEY, market_id int NOT NULL REFERENCES tv_markets(id) ON DELETE CASCADE, user_id text NOT NULL,
      pick text NOT NULL, stake int NOT NULL, odd double precision, payout int NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz, UNIQUE (market_id, user_id))`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tv_bets_user ON tv_bets (user_id, created_at DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_bet_games (
      game_id bigint PRIMARY KEY, home text NOT NULL, away text NOT NULL, league text NOT NULL DEFAULT '', kickoff timestamptz NOT NULL,
      home_goals int NOT NULL DEFAULT 0, away_goals int NOT NULL DEFAULT 0, minute int NOT NULL DEFAULT 0, state text NOT NULL DEFAULT 'pre',
      updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tv_bet_log (id serial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, detail text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

async function readSetting<T>(key: string): Promise<T | null> {
  const [row] = await rows<{ value: T }>(sql`SELECT value FROM kp_settings WHERE key = ${key}`)
  return row?.value ?? null
}
async function writeSetting(key: string, value: unknown) {
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

export async function getBetsConfig(): Promise<BetsConfig> {
  await ensureBets()
  const raw = await readSetting<unknown>(CONFIG_KEY)
  return raw ? cleanBetsConfig(raw) : DEFAULT_BETS
}

export async function saveBetsConfig(input: unknown, actor: string) {
  await ensureBets()
  const cfg = cleanBetsConfig(input)
  await writeSetting(CONFIG_KEY, cfg)
  await log(actor, 'ayar', `Açık: ${cfg.enabled ? 'evet' : 'hayır'} · kesinti %${cfg.rake} · bahis ${cfg.minStake}-${cfg.maxStake} · min aktif ${cfg.minActive} dk`)
}

async function log(actor: string, action: string, detail: string) {
  await rows(sql`INSERT INTO tv_bet_log (actor, action, detail) VALUES (${actor}, ${action}, ${detail.slice(0, 500)})`)
}

const intList = (ids: number[]) => `{${ids.filter((n) => Number.isSafeInteger(n)).join(',')}}`

// --- Market definitions ----------------------------------------------------

type OptionDef = { key: string; label: string; odd?: number | null }
type MarketDef = { slot: string; kind: BetKind; title: string; line: number | null; base: number | null; closeMinute: number; options: OptionDef[] }
type GameRow = { ext_id: string; home: string; away: string; league: string; kickoff: string }

const fmtLine = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1 })

function defineMarket(kind: BetKind, g: { id: number; home: string; away: string }, phase: BetPhase, cfg: BetsConfig, live?: GameLive): MarketDef | null {
  const total = live ? live.home.score + live.away.score : 0
  const close = phase === 'pre' ? 0 : cfg.closeMinute
  const slot = (extra: string | number = '') => `${g.id}:${phase}:${kind}:${extra}`
  switch (kind) {
    case 'ms':
      if (phase === 'live' && live && live.minute >= 60) return null
      return {
        slot: slot(),
        kind,
        title: 'Maç sonucu',
        line: null,
        base: null,
        closeMinute: phase === 'pre' ? 0 : Math.min(60, cfg.closeMinute),
        options: [
          { key: '1', label: g.home },
          { key: 'X', label: 'Beraberlik' },
          { key: '2', label: g.away },
        ],
      }
    case 'ou': {
      const line = phase === 'pre' ? cfg.goalLine : Math.max(cfg.goalLine, total + 1.5)
      return { slot: slot(line), kind, title: `Toplam gol ${fmtLine(line)}`, line, base: null, closeMinute: close, options: [{ key: 'over', label: `${fmtLine(line)} Üst` }, { key: 'under', label: `${fmtLine(line)} Alt` }] }
    }
    case 'btts':
      if (live && live.home.score > 0 && live.away.score > 0) return null
      return { slot: slot(), kind, title: 'Karşılıklı gol', line: null, base: null, closeMinute: close, options: [{ key: 'yes', label: 'Var' }, { key: 'no', label: 'Yok' }] }
    case 'next':
      if (phase !== 'live' || !live) return null
      return {
        slot: slot(total),
        kind,
        title: `Sıradaki gol (${total + 1}. gol)`,
        line: null,
        base: total,
        closeMinute: Math.min(88, cfg.closeMinute + 5),
        options: [
          { key: 'home', label: g.home },
          { key: 'none', label: 'Gol olmaz' },
          { key: 'away', label: g.away },
        ],
      }
    case 'corners': {
      if (phase === 'live' && (!live || live.corners == null)) return null
      const line = phase === 'pre' ? cfg.cornerLine : Math.max(cfg.cornerLine, (live?.corners ?? 0) + 2.5)
      return { slot: slot(line), kind, title: `Toplam korner ${fmtLine(line)}`, line, base: null, closeMinute: close, options: [{ key: 'over', label: `${fmtLine(line)} Üst` }, { key: 'under', label: `${fmtLine(line)} Alt` }] }
    }
    case 'red':
      if (live && live.reds > 0) return null
      return { slot: slot(), kind, title: 'Kırmızı kart', line: null, base: null, closeMinute: close, options: [{ key: 'yes', label: 'Çıkar' }, { key: 'no', label: 'Çıkmaz' }] }
  }
}

type MarketRow = {
  id: number
  slot: string
  game_id: string
  home: string
  away: string
  league: string
  kickoff: string
  kind: BetKind
  title: string
  line: number | null
  base: number | null
  phase: BetPhase
  mode: 'pool' | 'fixed'
  status: MarketStatus
  options: OptionDef[]
  rake: number
  close_minute: number
  suspended_until: string | null
  result: string | null
  created_at: string
}

/** Winning option key once it is certain, or null while still undecided. 'void' when the data can't decide it. */
function resolve(m: MarketRow, live: GameLive): string | null {
  const total = live.home.score + live.away.score
  const done = live.state === 'post'
  switch (m.kind) {
    case 'ms':
      if (!done) return null
      return live.home.score > live.away.score ? '1' : live.home.score === live.away.score ? 'X' : '2'
    case 'ou':
      if (m.line != null && total > m.line) return 'over'
      return done ? 'under' : null
    case 'btts':
      if (live.home.score > 0 && live.away.score > 0) return 'yes'
      return done ? 'no' : null
    case 'next': {
      const base = m.base ?? 0
      if (total > base) return live.goals[base] ?? 'void'
      return done ? 'none' : null
    }
    case 'corners':
      if (live.corners == null) return done ? 'void' : null
      if (m.line != null && live.corners > m.line) return 'over'
      return done ? 'under' : null
    case 'red':
      if (live.reds > 0) return 'yes'
      return done ? 'no' : null
  }
}

// --- Settlement -----------------------------------------------------------

type BetRow = { id: number; user_id: string; pick: string; stake: number; odd: number | null; created_at: string }

async function payBet(bet: BetRow, status: BetStatus, payout: number) {
  const updated = await rows(sql`UPDATE tv_bets SET status = ${status}, payout = ${payout}, settled_at = now() WHERE id = ${bet.id} AND status = 'open' RETURNING id`)
  if (updated.length && payout > 0) await credit(bet.user_id, payout)
  return updated.length > 0
}

export async function settleMarket(marketId: number, result: string, actor = 'sistem') {
  await ensureBets()
  if (result === 'void') return voidMarket(marketId, actor, 'Veri sonucu belirleyemedi')
  const [m] = await rows<MarketRow>(sql`UPDATE tv_markets SET status = 'settled', result = ${result}, settled_at = now()
    WHERE id = ${marketId} AND status IN ('open', 'locked') RETURNING *`)
  if (!m) return null
  const bets = await rows<BetRow>(sql`SELECT id, user_id, pick, stake, odd, created_at FROM tv_bets WHERE market_id = ${marketId} AND status = 'open'`)
  const total = bets.reduce((a, b) => a + b.stake, 0)
  const winners = bets.filter((b) => b.pick === result)
  const winPool = winners.reduce((a, b) => a + b.stake, 0)
  let paid = 0
  if (m.mode === 'pool' && winners.length === 0) {
    for (const b of bets) if (await payBet(b, 'refund', b.stake)) paid += b.stake
  } else {
    const distributable = Math.floor((total - winPool) * (1 - m.rake / 100))
    for (const b of bets) {
      if (b.pick !== result) {
        await payBet(b, 'lost', 0)
        continue
      }
      const payout = m.mode === 'fixed' ? Math.floor(b.stake * (b.odd ?? 1)) : b.stake + Math.floor((distributable * b.stake) / winPool)
      if (await payBet(b, 'won', payout)) paid += payout
    }
  }
  const label = m.options.find((o) => o.key === result)?.label ?? result
  await log(actor, 'sonuc', `#${m.id} ${m.home}-${m.away} · ${m.title}: ${label} · ${winners.length}/${bets.length} kazandı · ${paid} coin ödendi`)
  return { market: m, label, winners: winners.length, bets: bets.length, paid, total }
}

export async function voidMarket(marketId: number, actor = 'sistem', reason = 'İptal') {
  await ensureBets()
  const [m] = await rows<MarketRow>(sql`UPDATE tv_markets SET status = 'void', result = 'void', settled_at = now()
    WHERE id = ${marketId} AND status IN ('open', 'locked') RETURNING *`)
  if (!m) return null
  const bets = await rows<BetRow>(sql`SELECT id, user_id, pick, stake, odd, created_at FROM tv_bets WHERE market_id = ${marketId} AND status = 'open'`)
  let refunded = 0
  for (const b of bets) if (await payBet(b, 'refund', b.stake)) refunded += b.stake
  await log(actor, 'iptal', `#${m.id} ${m.home}-${m.away} · ${m.title} · ${reason} · ${refunded} coin iade`)
  return { refunded, bets: bets.length }
}

// --- Bot -------------------------------------------------------------------

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

async function siteOrigin() {
  const { SITE_URL } = await import('@/lib/seo')
  return SITE_URL.replace(/\/$/, '')
}

async function botStatus(): Promise<BetsBotStatus> {
  return (await readSetting<BetsBotStatus>(BOT_KEY)) ?? { lastRunAt: null, lastError: null, sent: 0, opened: 0, settled: 0, voided: 0 }
}

export async function betsBotStatus() {
  await ensureBets()
  return botStatus()
}

async function patchBot(patch: Partial<BetsBotStatus>) {
  await writeSetting(BOT_KEY, { ...(await botStatus()), ...patch })
}

async function botSend(cfg: BetsConfig, text: string) {
  if (!cfg.bot.enabled || !cfg.bot.targetIds.length) return { sent: 0, error: null as string | null }
  try {
    const r = await sendToTargets(cfg.bot.targetIds, text)
    return { sent: r.sent, error: r.errors.length ? r.errors.join(' | ') : null }
  } catch (error) {
    return { sent: 0, error: (error as Error).message }
  }
}

export async function testBetsBot() {
  const cfg = await getBetsConfig()
  if (!cfg.bot.targetIds.length) throw new Error('Önce en az bir hedef grup seçip kaydet')
  const origin = await siteOrigin()
  const text = fill(cfg.bot.openTemplate, {
    ev: 'Test FK',
    dep: 'Deneme SK',
    skor: '1 - 0',
    dakika: "34'",
    lig: 'Test Ligi',
    etkinlikler: '• Sıradaki gol (2. gol)\n• Toplam gol 2,5\n• Toplam korner 9,5',
    link: `${origin}/kankatv`,
  })
  const r = await sendToTargets(cfg.bot.targetIds, `[TEST] ${text}`)
  await patchBot({ lastError: r.errors.length ? r.errors.join(' | ') : null })
  return r.sent
}

// --- Sync (create, lock, settle) ------------------------------------------

async function createMarket(def: MarketDef, g: GameRow, phase: BetPhase, cfg: BetsConfig) {
  const inserted = await rows<{ id: number }>(sql`INSERT INTO tv_markets (slot, game_id, home, away, league, kickoff, kind, title, line, base, phase, options, rake, close_minute)
    VALUES (${def.slot}, ${Number(g.ext_id)}, ${g.home}, ${g.away}, ${g.league}, ${new Date(g.kickoff).toISOString()}, ${def.kind}, ${def.title},
      ${def.line}, ${def.base}, ${phase}, ${JSON.stringify(def.options)}::jsonb, ${cfg.rake}, ${def.closeMinute})
    ON CONFLICT (slot) DO NOTHING RETURNING id`)
  return inserted.length > 0
}

export type SyncResult = { ran: boolean; games: number; opened: number; settled: number; voided: number; refundedLate: number; sent: number; error: string | null }

/** Creates, locks and settles every TV event. Throttled so viewer traffic and the cron can both call it. */
export async function syncBets(force = false): Promise<SyncResult> {
  const empty: SyncResult = { ran: false, games: 0, opened: 0, settled: 0, voided: 0, refundedLate: 0, sent: 0, error: null }
  const cfg = await getBetsConfig()
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${SYNC_KEY}, '{"at":"1970-01-01T00:00:00Z"}'::jsonb) ON CONFLICT DO NOTHING`)
  const claimed = await rows(sql`UPDATE kp_settings SET value = jsonb_build_object('at', now())
    WHERE key = ${SYNC_KEY} AND (${force}::boolean OR (value->>'at')::timestamptz < now() - make_interval(secs => ${SYNC_EVERY_SECONDS}))
    RETURNING key`)
  if (!claimed.length) return empty

  const result: SyncResult = { ...empty, ran: true }
  const origin = await siteOrigin()
  const games = await rows<GameRow>(sql`SELECT ext_id, home, away, league, kickoff FROM league_matches
    WHERE ext_id IS NOT NULL AND kickoff > now() - make_interval(hours => ${VOID_AFTER_HOURS}) AND kickoff < now() + interval '36 hours'
    ORDER BY kickoff LIMIT 40`)
  const enabledKinds = BET_KINDS.filter((k) => cfg.kinds[k])

  for (const g of games) {
    const gameId = Number(g.ext_id)
    const meta = { id: gameId, home: g.home, away: g.away }
    const started = new Date(g.kickoff).getTime() <= Date.now()
    await rows(sql`INSERT INTO tv_bet_games (game_id, home, away, league, kickoff) VALUES (${gameId}, ${g.home}, ${g.away}, ${g.league}, ${new Date(g.kickoff).toISOString()})
      ON CONFLICT (game_id) DO UPDATE SET home = EXCLUDED.home, away = EXCLUDED.away, league = EXCLUDED.league, kickoff = EXCLUDED.kickoff`)

    if (!started) {
      if (cfg.enabled && cfg.pre) {
        for (const kind of enabledKinds) {
          const def = defineMarket(kind, meta, 'pre', cfg)
          if (def && (await createMarket(def, g, 'pre', cfg))) result.opened++
        }
      }
      continue
    }

    result.games++
    await rows(sql`UPDATE tv_markets SET status = 'locked' WHERE game_id = ${gameId} AND phase = 'pre' AND status = 'open'`)
    const live = await getGameLive(gameId)
    if (!live) continue

    const [prev] = await rows<{ home_goals: number; away_goals: number; state: string }>(sql`SELECT home_goals, away_goals, state FROM tv_bet_games WHERE game_id = ${gameId}`)
    const goalsNow = live.home.score + live.away.score
    const goalsBefore = prev ? prev.home_goals + prev.away_goals : goalsNow
    await rows(sql`UPDATE tv_bet_games SET home_goals = ${live.home.score}, away_goals = ${live.away.score}, minute = ${live.minute}, state = ${live.state}, updated_at = now() WHERE game_id = ${gameId}`)

    if (prev && prev.state === 'in' && goalsNow > goalsBefore) {
      if (cfg.suspendSeconds > 0) {
        await rows(sql`UPDATE tv_markets SET suspended_until = now() + make_interval(secs => ${cfg.suspendSeconds}) WHERE game_id = ${gameId} AND status = 'open'`)
      }
      if (cfg.lateWindow > 0) {
        const late = await rows<BetRow>(sql`SELECT b.id, b.user_id, b.pick, b.stake, b.odd, b.created_at FROM tv_bets b JOIN tv_markets m ON m.id = b.market_id
          WHERE m.game_id = ${gameId} AND m.phase = 'live' AND b.status = 'open' AND b.created_at > now() - make_interval(secs => ${cfg.lateWindow + SYNC_EVERY_SECONDS})`)
        for (const b of late) if (await payBet(b, 'refund', b.stake)) result.refundedLate++
        if (late.length) await log('sistem', 'gec-bahis', `${g.home}-${g.away} gol sonrası ${late.length} geç bahis iade edildi`)
      }
    }

    const createdTitles: string[] = []
    if (cfg.enabled && cfg.live && live.state === 'in' && live.minute < cfg.closeMinute) {
      for (const kind of enabledKinds) {
        const def = defineMarket(kind, meta, 'live', cfg, live)
        if (def && live.minute < def.closeMinute && (await createMarket(def, g, 'live', cfg))) {
          result.opened++
          createdTitles.push(def.title)
        }
      }
    }
    await rows(sql`UPDATE tv_markets SET status = 'locked' WHERE game_id = ${gameId} AND phase = 'live' AND status = 'open' AND close_minute <= ${live.minute}`)

    const pending = await rows<MarketRow>(sql`SELECT * FROM tv_markets WHERE game_id = ${gameId} AND status IN ('open', 'locked')`)
    for (const m of pending) {
      const outcome = resolve(m, live)
      if (!outcome) continue
      const r = await settleMarket(m.id, outcome)
      if (outcome === 'void') {
        result.voided++
        continue
      }
      if (!r || !('label' in r)) continue
      result.settled++
      if (cfg.bot.announceSettle && r.bets > 0) {
        const s = await botSend(cfg, fill(cfg.bot.settleTemplate, {
          ev: g.home, dep: g.away, lig: g.league, etkinlik: m.title, sonuc: r.label, kazanan: String(r.winners), dagitilan: String(r.paid), link: `${origin}/kankatv`,
        }))
        result.sent += s.sent
        result.error = s.error ?? result.error
      }
    }

    if (createdTitles.length && cfg.bot.announceOpen) {
      const s = await botSend(cfg, fill(cfg.bot.openTemplate, {
        ev: g.home,
        dep: g.away,
        skor: `${live.home.score} - ${live.away.score}`,
        dakika: `${live.minute}'`,
        lig: g.league,
        etkinlikler: createdTitles.map((t) => `• ${t}`).join('\n'),
        link: `${origin}/kankatv`,
      }))
      result.sent += s.sent
      result.error = s.error ?? result.error
    }
  }

  const stale = await rows<{ id: number }>(sql`SELECT id FROM tv_markets WHERE status IN ('open', 'locked') AND kickoff < now() - make_interval(hours => ${VOID_AFTER_HOURS})`)
  for (const s of stale) if (await voidMarket(s.id, 'sistem', 'Maç sonucu gelmedi (erteleme/veri yok)')) result.voided++

  const prevBot = await botStatus()
  await patchBot({
    lastRunAt: new Date().toISOString(),
    lastError: result.error,
    sent: prevBot.sent + result.sent,
    opened: prevBot.opened + result.opened,
    settled: prevBot.settled + result.settled,
    voided: prevBot.voided + result.voided,
  })
  return result
}

// --- Placing bets ----------------------------------------------------------

async function minutesToday(userId: string) {
  const [m] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_watch_ticks WHERE user_id = ${userId} AND (minute AT TIME ZONE 'Europe/Istanbul')::date = ${trDay()}::date`)
  return Number(m?.n ?? 0)
}

async function stakedToday(userId: string) {
  const [s] = await rows<{ n: string }>(sql`SELECT coalesce(sum(stake), 0) AS n FROM tv_bets
    WHERE user_id = ${userId} AND status <> 'refund' AND (created_at AT TIME ZONE 'Europe/Istanbul')::date = ${trDay()}::date`)
  return Number(s?.n ?? 0)
}

export async function placeBet(userId: string, marketId: number, pick: string, stake: number) {
  const cfg = await getBetsConfig()
  if (!cfg.enabled) throw new Error('Canlı etkinlikler şu an kapalı')
  if (!Number.isSafeInteger(marketId) || typeof pick !== 'string') throw new Error('Geçersiz bahis')
  if (!Number.isInteger(stake) || stake < cfg.minStake || stake > cfg.maxStake) throw new Error(`Bahis ${cfg.minStake} - ${cfg.maxStake} coin arasında olmalı`)
  if (await isRoleHolder(userId)) throw new Error('Yetkili hesaplar etkinliklere katılamaz')

  const [m] = await rows<MarketRow>(sql`SELECT * FROM tv_markets WHERE id = ${marketId}`)
  if (!m || m.status !== 'open') throw new Error('Bu etkinlik kapandı')
  if (m.suspended_until && new Date(m.suspended_until).getTime() > Date.now()) throw new Error('Gol sonrası kısa ara, birazdan tekrar dene')
  if (m.phase === 'pre' && new Date(m.kickoff).getTime() <= Date.now()) throw new Error('Maç başladı, maç öncesi etkinlik kapandı')
  const option = m.options.find((o) => o.key === pick)
  if (!option) throw new Error('Geçersiz seçenek')

  const watched = await minutesToday(userId)
  if (watched < cfg.minActive) throw new Error(`Katılmak için bugün en az ${cfg.minActive} dk KankaTV izlemelisin (şu an ${watched} dk)`)
  if (cfg.dailyCap > 0 && (await stakedToday(userId)) + stake > cfg.dailyCap) throw new Error(`Günlük ${cfg.dailyCap} coin bahis sınırına ulaştın`)

  const odd = m.mode === 'fixed' ? Number(option.odd ?? 0) : null
  if (m.mode === 'fixed') {
    if (!odd || odd <= 1) throw new Error('Bu seçeneğin oranı henüz girilmedi')
    const [e] = await rows<{ n: string }>(sql`SELECT coalesce(sum(floor(stake * odd)), 0) AS n FROM tv_bets WHERE market_id = ${marketId} AND pick = ${pick} AND status = 'open'`)
    if (Number(e?.n ?? 0) + Math.floor(stake * odd) > cfg.fixedExposure) throw new Error('Bu seçenek için limit doldu')
  }

  if (!(await debit(userId, stake))) throw new Error('Yeterli kanka coinin yok')
  const inserted = await rows<{ id: number }>(sql`INSERT INTO tv_bets (market_id, user_id, pick, stake, odd) VALUES (${marketId}, ${userId}, ${pick}, ${stake}, ${odd})
    ON CONFLICT (market_id, user_id) DO NOTHING RETURNING id`)
  if (!inserted.length) {
    await credit(userId, stake)
    throw new Error('Bu etkinlikte zaten bahsin var')
  }
  const [still] = await rows(sql`SELECT 1 FROM tv_markets WHERE id = ${marketId} AND status = 'open'`)
  if (!still) {
    await rows(sql`DELETE FROM tv_bets WHERE id = ${inserted[0].id} AND status = 'open'`)
    await credit(userId, stake)
    throw new Error('Bu etkinlik az önce kapandı, coinin iade edildi')
  }
  return { id: inserted[0].id, balance: await getBalance(userId) }
}

// --- Read models -----------------------------------------------------------

async function withPools(list: MarketRow[]): Promise<TvMarket[]> {
  if (!list.length) return []
  const agg = await rows<{ market_id: number; pick: string; s: string; c: string }>(sql`SELECT market_id, pick, sum(stake) AS s, count(*) AS c FROM tv_bets
    WHERE market_id = ANY(${intList(list.map((m) => m.id))}::int[]) AND status <> 'refund' GROUP BY market_id, pick`)
  const key = (id: number, pick: string) => `${id}:${pick}`
  const pools = new Map(agg.map((a) => [key(a.market_id, a.pick), { pool: Number(a.s), count: Number(a.c) }]))
  return list.map((m) => {
    const options = m.options.map((o) => ({ key: o.key, label: o.label, odd: o.odd ?? null, ...(pools.get(key(m.id, o.key)) ?? { pool: 0, count: 0 }) }))
    return {
      id: m.id,
      gameId: Number(m.game_id),
      home: m.home,
      away: m.away,
      league: m.league,
      kind: m.kind,
      title: m.title,
      phase: m.phase,
      mode: m.mode,
      status: m.status,
      options,
      total: options.reduce((a, o) => a + o.pool, 0),
      kickoff: new Date(m.kickoff).toISOString(),
      closeMinute: m.close_minute,
      suspendedUntil: m.suspended_until ? new Date(m.suspended_until).toISOString() : null,
      result: m.result,
    }
  })
}

export async function betsState(userId: string | null): Promise<BetsState> {
  const cfg = await getBetsConfig()
  if (cfg.enabled) await syncBets().catch((e) => console.error('[tv-bets] sync', e))
  const publicCfg = { enabled: cfg.enabled, rake: cfg.rake, minStake: cfg.minStake, maxStake: cfg.maxStake, dailyCap: cfg.dailyCap, minActive: cfg.minActive }
  if (!cfg.enabled) return { config: publicCfg, member: Boolean(userId), balance: null, eligibility: { ok: false, minutes: 0, need: cfg.minActive, stakedToday: 0 }, games: [], markets: [], bets: [] }

  const marketRows = await rows<MarketRow>(sql`SELECT * FROM tv_markets
    WHERE status IN ('open', 'locked') OR (settled_at > now() - interval '20 minutes')
    ORDER BY kickoff, game_id, (phase = 'live') DESC, id DESC LIMIT 120`)
  const gameRows = await rows<{ game_id: string; home: string; away: string; league: string; kickoff: string; home_goals: number; away_goals: number; minute: number; state: string }>(sql`SELECT * FROM tv_bet_games
    WHERE game_id = ANY(${intList([...new Set(marketRows.map((m) => Number(m.game_id)))])}::bigint[])`)
  const games: TvGameState[] = gameRows.map((g) => ({
    gameId: Number(g.game_id),
    home: g.home,
    away: g.away,
    league: g.league,
    minute: g.minute,
    score: `${g.home_goals} - ${g.away_goals}`,
    state: (new Date(g.kickoff).getTime() > Date.now() ? 'pre' : g.state) as TvGameState['state'],
    kickoff: new Date(g.kickoff).toISOString(),
  }))

  let bets: TvBet[] = []
  let balance: number | null = null
  let eligibility = { ok: false, minutes: 0, need: cfg.minActive, stakedToday: 0 }
  if (userId) {
    const [minutes, staked, bal, mine] = await Promise.all([
      minutesToday(userId),
      stakedToday(userId),
      getBalance(userId),
      rows<{ id: number; market_id: number; title: string; home: string; away: string; pick: string; options: OptionDef[]; stake: number; odd: number | null; payout: number; status: BetStatus; created_at: string }>(sql`SELECT b.id, b.market_id, m.title, m.home, m.away, b.pick, m.options, b.stake, b.odd, b.payout, b.status, b.created_at
        FROM tv_bets b JOIN tv_markets m ON m.id = b.market_id WHERE b.user_id = ${userId} ORDER BY b.created_at DESC LIMIT 15`),
    ])
    balance = bal
    eligibility = { ok: minutes >= cfg.minActive, minutes, need: cfg.minActive, stakedToday: staked }
    bets = mine.map((b) => ({
      id: b.id,
      marketId: b.market_id,
      title: b.title,
      match: `${b.home} - ${b.away}`,
      pick: b.options.find((o) => o.key === b.pick)?.label ?? b.pick,
      stake: b.stake,
      odd: b.odd,
      payout: b.payout,
      status: b.status,
      createdAt: new Date(b.created_at).toISOString(),
    }))
  }
  return { config: publicCfg, member: Boolean(userId), balance, eligibility, games, markets: await withPools(marketRows), bets }
}

// --- Admin ------------------------------------------------------------------

export async function adminMarkets(): Promise<AdminMarket[]> {
  await ensureBets()
  const list = await rows<MarketRow>(sql`SELECT * FROM tv_markets
    WHERE status IN ('open', 'locked') OR settled_at > now() - interval '2 days' ORDER BY (status IN ('open', 'locked')) DESC, kickoff DESC, id DESC LIMIT 150`)
  const counts = await rows<{ market_id: number; n: string }>(sql`SELECT market_id, count(*) AS n FROM tv_bets WHERE market_id = ANY(${intList(list.map((m) => m.id))}::int[]) GROUP BY market_id`)
  const byId = new Map(counts.map((c) => [c.market_id, Number(c.n)]))
  const created = new Map(list.map((m) => [m.id, new Date(m.created_at).toISOString()]))
  return (await withPools(list)).map((m) => ({ ...m, bets: byId.get(m.id) ?? 0, createdAt: created.get(m.id)! }))
}

export async function setMarketLock(marketId: number, locked: boolean, actor: string) {
  await ensureBets()
  const r = await rows<MarketRow>(sql`UPDATE tv_markets SET status = ${locked ? 'locked' : 'open'}, suspended_until = NULL
    WHERE id = ${marketId} AND status = ${locked ? 'open' : 'locked'} RETURNING *`)
  if (!r.length) throw new Error('Etkinlik bu duruma alınamaz')
  await log(actor, locked ? 'kilit' : 'ac', `#${marketId} ${r[0].home}-${r[0].away} · ${r[0].title}`)
}

/** Fixed odds may only be set before anyone has bet, so nobody's payout changes under them. */
export async function setMarketOdds(marketId: number, odds: Record<string, number> | null, actor: string) {
  await ensureBets()
  const [m] = await rows<MarketRow>(sql`SELECT * FROM tv_markets WHERE id = ${marketId}`)
  if (!m || m.status !== 'open') throw new Error('Sadece açık etkinliklere oran girilebilir')
  const [b] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tv_bets WHERE market_id = ${marketId}`)
  if (Number(b?.n ?? 0) > 0) throw new Error('Bahis alınmış etkinliğin oran tipi değiştirilemez')
  if (odds) {
    for (const o of m.options) {
      const v = Number(odds[o.key])
      if (!Number.isFinite(v) || v < 1.01 || v > 50) throw new Error(`${o.label} için 1.01 - 50 arası oran gir`)
    }
  }
  const options = m.options.map((o) => ({ key: o.key, label: o.label, odd: odds ? Math.round(Number(odds[o.key]) * 100) / 100 : null }))
  await rows(sql`UPDATE tv_markets SET mode = ${odds ? 'fixed' : 'pool'}, options = ${JSON.stringify(options)}::jsonb WHERE id = ${marketId}`)
  await log(actor, 'oran', `#${marketId} ${m.home}-${m.away} · ${m.title} · ${odds ? options.map((o) => `${o.label} ${o.odd}`).join(', ') : 'havuza çevrildi'}`)
}

export async function betsStats(): Promise<BetsStats> {
  await ensureBets()
  const day = trDay()
  const [t] = await rows<{ n: string; s: string; p: string }>(sql`SELECT count(*) AS n, coalesce(sum(stake) FILTER (WHERE status <> 'refund'), 0) AS s, count(DISTINCT user_id) AS p
    FROM tv_bets WHERE (created_at AT TIME ZONE 'Europe/Istanbul')::date = ${day}::date`)
  const [s] = await rows<{ paid: string; staked: string }>(sql`SELECT coalesce(sum(payout) FILTER (WHERE status = 'won'), 0) AS paid,
    coalesce(sum(stake) FILTER (WHERE status IN ('won', 'lost')), 0) AS staked FROM tv_bets WHERE (settled_at AT TIME ZONE 'Europe/Istanbul')::date = ${day}::date`)
  const [o] = await rows<{ m: string; s: string }>(sql`SELECT count(DISTINCT m.id) AS m, coalesce(sum(b.stake) FILTER (WHERE b.status = 'open'), 0) AS s
    FROM tv_markets m LEFT JOIN tv_bets b ON b.market_id = m.id WHERE m.status IN ('open', 'locked')`)
  return {
    betsToday: Number(t?.n ?? 0),
    stakedToday: Number(t?.s ?? 0),
    players: Number(t?.p ?? 0),
    paidToday: Number(s?.paid ?? 0),
    burnedToday: Math.max(0, Number(s?.staked ?? 0) - Number(s?.paid ?? 0)),
    openMarkets: Number(o?.m ?? 0),
    openStake: Number(o?.s ?? 0),
  }
}

export async function betsLog(limit = 40): Promise<BetsLog[]> {
  await ensureBets()
  const r = await rows<{ id: number; actor: string; action: string; detail: string; created_at: string }>(sql`SELECT * FROM tv_bet_log ORDER BY id DESC LIMIT ${limit}`)
  return r.map((x) => ({ id: x.id, actor: x.actor, action: x.action, detail: x.detail, createdAt: new Date(x.created_at).toISOString() }))
}
