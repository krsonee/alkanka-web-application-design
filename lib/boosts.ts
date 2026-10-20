import 'server-only'
import { rows, sql } from '@/lib/db'
import { getContent, setContent } from '@/lib/content'
import {
  activeBoosts,
  applyMult,
  boostFor,
  cleanBoosts,
  trDayOf,
  type BoostConfig,
  type BoostSource,
} from '@/lib/boosts-shared'

const KEY = 'boosts:config'
const LOYALTY_BADGE = 'sponsor-mudavimi'
let cache: { at: number; cfg: BoostConfig } | null = null

export async function getBoostConfig(): Promise<BoostConfig> {
  if (cache && Date.now() - cache.at < 30_000) return cache.cfg
  const cfg = cleanBoosts(await getContent<Partial<BoostConfig>>(KEY).catch(() => null))
  cache = { at: Date.now(), cfg }
  return cfg
}

export async function saveBoostConfig(input: Partial<BoostConfig>) {
  const cfg = cleanBoosts(input)
  await setContent(KEY, cfg)
  cache = { at: Date.now(), cfg }
  return cfg
}

export async function currentBoosts() {
  return activeBoosts(await getBoostConfig())
}

/** Returns the boosted reward for a source. Never throws: a config read failure falls back to the base amount. */
export async function boosted(source: BoostSource, amount: number) {
  if (amount <= 0) return amount
  const cfg = await getBoostConfig().catch(() => null)
  return cfg ? applyMult(amount, boostFor(cfg, source)) : amount
}

let ready: Promise<void> | null = null
function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS streak_shields (user_id text PRIMARY KEY, count int NOT NULL DEFAULT 0, used int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS member_birthdays (user_id text PRIMARY KEY, birth date NOT NULL, set_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`INSERT INTO kp_badges (id, name, description, icon, tier, bonus, auto, sort)
      VALUES (${LOYALTY_BADGE}, 'Sponsor Müdavimi', 'Bir sponsorda 30 gün aktif kalan kankalar', 'handshake', 'altin', 200, NULL, 70)
      ON CONFLICT DO NOTHING`).catch(() => {})
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

// --- Streak shield (K4) ---------------------------------------------------

export async function shieldCount(userId: string) {
  await ensure()
  const [r] = await rows<{ count: number }>(sql`SELECT count FROM streak_shields WHERE user_id = ${userId}`)
  return Number(r?.count ?? 0)
}

export async function buyShield(userId: string) {
  await ensure()
  const cfg = await getBoostConfig()
  if ((await shieldCount(userId)) >= 3) throw new Error('En fazla 3 seri kalkanı biriktirebilirsin.')
  const { debit, recordHistory } = await import('@/lib/member')
  if (!(await debit(userId, cfg.shieldPrice))) throw new Error('Kanka Coin bakiyen yetersiz.')
  await rows(sql`INSERT INTO streak_shields (user_id, count) VALUES (${userId}, 1)
    ON CONFLICT (user_id) DO UPDATE SET count = streak_shields.count + 1, updated_at = now()`)
  await recordHistory({ userId, userName: 'Kanka', game: 'market', mode: 'harcama', opponent: 'Seri Kalkanı', stake: cfg.shieldPrice, result: 'loss', delta: -cfg.shieldPrice }).catch(() => {})
  return shieldCount(userId)
}

/**
 * Runs on a member's first active minute of the day. Fills exactly one missed day with a shield,
 * pays the comeback bonus after a long absence and the yearly birthday gift.
 */
export async function onFirstMinuteOfDay(userId: string) {
  await ensure()
  const cfg = await getBoostConfig()
  const today = trDayOf()
  const yesterday = trDayOf(Date.now() - 86_400_000)
  const before = trDayOf(Date.now() - 2 * 86_400_000)
  const days = await rows<{ d: string }>(sql`SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Istanbul')::date::text AS d FROM kp_events
    WHERE user_id = ${userId} AND source = 'sure' AND created_at >= now() - interval '4 days'`)
  const seen = new Set(days.map((r) => r.d))

  if (!seen.has(yesterday) && seen.has(before)) {
    const used = await rows(sql`UPDATE streak_shields SET count = count - 1, used = used + 1, updated_at = now()
      WHERE user_id = ${userId} AND count > 0 RETURNING count`)
    if (used.length) {
      await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note, created_at)
        VALUES (${userId}, 'sure', 0, ${`kalkan:${yesterday}`}, 'Seri kalkanı', (${yesterday}::date + time '12:00') AT TIME ZONE 'Europe/Istanbul')
        ON CONFLICT DO NOTHING`)
    }
  }

  const { credit } = await import('@/lib/member')
  if (cfg.comeback.on && cfg.comeback.coin > 0) {
    const [last] = await rows<{ d: string | null }>(sql`SELECT max(created_at AT TIME ZONE 'Europe/Istanbul')::date::text AS d FROM kp_events
      WHERE user_id = ${userId} AND source = 'sure' AND created_at < (${today}::date AT TIME ZONE 'Europe/Istanbul')`)
    const gap = last?.d ? Math.round((Date.parse(today) - Date.parse(last.d)) / 86_400_000) : 0
    if (gap >= cfg.comeback.days) {
      const ins = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
        VALUES (${userId}, 'kampanya', 0, ${cfg.comeback.coin}, ${`geri-don:${today}`}, 'Geri dönüş hediyesi') ON CONFLICT DO NOTHING RETURNING id`)
      if (ins.length) await credit(userId, cfg.comeback.coin)
    }
  }

  if (cfg.birthday.on && cfg.birthday.coin > 0) {
    const [b] = await rows<{ md: string }>(sql`SELECT to_char(birth, 'MM-DD') AS md FROM member_birthdays WHERE user_id = ${userId}`)
    if (b?.md === today.slice(5)) {
      const ins = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
        VALUES (${userId}, 'kampanya', 0, ${cfg.birthday.coin}, ${`dogum-gunu:${today.slice(0, 4)}`}, 'Doğum günü hediyesi') ON CONFLICT DO NOTHING RETURNING id`)
      if (ins.length) await credit(userId, cfg.birthday.coin)
    }
  }
}

// --- Birthday (K6) --------------------------------------------------------

export async function getBirthday(userId: string) {
  await ensure()
  const [r] = await rows<{ b: string }>(sql`SELECT birth::text AS b FROM member_birthdays WHERE user_id = ${userId}`)
  return r?.b ?? null
}

/** A birthday can be set once so it can't be moved around to farm the gift. */
export async function setBirthday(userId: string, raw: string) {
  await ensure()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) throw new Error('Geçerli bir tarih seç.')
  const year = Number(raw.slice(0, 4))
  const now = new Date().getFullYear()
  if (year < now - 100 || year > now - 18) throw new Error('18 yaşından büyük olmalısın.')
  const ins = await rows(sql`INSERT INTO member_birthdays (user_id, birth) VALUES (${userId}, ${raw}::date) ON CONFLICT DO NOTHING RETURNING user_id`)
  if (!ins.length) throw new Error('Doğum günün zaten kayıtlı, değiştirmek için destek ekibine yaz.')
}

// --- Market discount (K7, K8) ----------------------------------------------

/** Best single discount for this member right now. Discounts never stack. */
export async function marketDiscountPct(userId: string) {
  const cfg = await getBoostConfig()
  const active = activeBoosts(cfg)
  let pct = active.some((b) => b.id === 'flash') ? cfg.flash.pct : 0
  if (active.some((b) => b.id === 'badgeDay')) {
    const own = await rows(sql`SELECT 1 FROM kp_awards WHERE user_id = ${userId} AND badge_id = ${cfg.badgeDay.badgeId} LIMIT 1`).catch(() => [])
    if (own.length) pct = Math.max(pct, cfg.badgeDay.pct)
  }
  return pct
}

export const discounted = (price: number, pct: number) => (pct > 0 ? Math.max(1, Math.round(price * (1 - pct / 100))) : price)

// --- Best bonus showcase (K14) -------------------------------------------

export async function claimBestBonus(userId: string) {
  const cfg = await getBoostConfig()
  if (!cfg.bestBonus.on || !cfg.bestBonus.siteId) throw new Error('Bu hafta vitrin kapalı.')
  if (cfg.bestBonus.kp <= 0) return { kp: 0 }
  const ins = await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
    VALUES (${userId}, 'kampanya', ${cfg.bestBonus.kp}, ${`vitrin:${trDayOf()}`}, 'Haftanın bonusuna göz attı') ON CONFLICT DO NOTHING RETURNING id`)
  return { kp: ins.length ? cfg.bestBonus.kp : 0 }
}

// --- Daily cron (K5, K12, K13) --------------------------------------------

export async function runBoostCron() {
  await ensure()
  const cfg = await getBoostConfig()
  const { sendToUsers } = await import('@/lib/push')
  const out = { comeback: 0, cashback: 0, loyalty: 0 }

  if (cfg.comeback.on) {
    const gone = await rows<{ user_id: string }>(sql`SELECT user_id FROM kp_events WHERE source = 'sure'
      GROUP BY user_id HAVING (max(created_at) AT TIME ZONE 'Europe/Istanbul')::date = (now() AT TIME ZONE 'Europe/Istanbul')::date - ${cfg.comeback.days}::int`)
    if (gone.length) {
      await sendToUsers(gone.map((r) => r.user_id), {
        title: 'Seni özledik kanka',
        body: `Bugün uğrarsan ${cfg.comeback.coin} KC geri dönüş hediyen hazır.`,
        url: '/',
      }).catch(() => {})
      out.comeback = gone.length
    }
  }

  const weekday = new Date(Date.now() + 3 * 3_600_000).getUTCDay()
  for (const c of cfg.cashback.filter((x) => x.weekday === weekday)) {
    const users = await rows<{ user_id: string }>(sql`SELECT user_id FROM sponsor_accounts WHERE site_id = ${c.siteId} AND status = 'approved'`).catch(() => [])
    if (!users.length) continue
    await sendToUsers(users.map((u) => u.user_id), {
      title: 'Bugün kayıp bonusu günü kanka',
      body: c.text || 'Sponsorunda bugün kayıp bonusu var, talep etmeyi unutma.',
      url: '/kampanyalar',
    }).catch(() => {})
    out.cashback += users.length
  }

  const loyal = await rows<{ user_id: string }>(sql`SELECT DISTINCT a.user_id FROM sponsor_accounts a
    WHERE a.status = 'approved' AND a.updated_at <= now() - make_interval(days => ${cfg.loyaltyDays})
      AND EXISTS (SELECT 1 FROM kp_events e WHERE e.user_id = a.user_id AND e.source = 'sure' AND e.created_at >= now() - interval '7 days')
      AND NOT EXISTS (SELECT 1 FROM kp_awards w WHERE w.user_id = a.user_id AND w.badge_id = ${LOYALTY_BADGE})
    LIMIT 200`).catch(() => [])
  if (loyal.length) {
    const { awardBadge } = await import('@/lib/kanka-puan')
    for (const u of loyal) {
      await awardBadge(LOYALTY_BADGE, u.user_id, 'tek', `${cfg.loyaltyDays} gün sponsor müdavimi`).catch(() => {})
      out.loyalty++
    }
  }
  return out
}
