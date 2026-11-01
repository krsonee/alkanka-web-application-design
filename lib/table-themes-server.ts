import 'server-only'
import { rows, sql } from '@/lib/db'
import {
  DEFAULT_OFFERS,
  getTableTheme,
  isThemeId,
  MAX_THEME_LEVEL,
  RARITY_RANK,
  THEME_GAMES,
  themeLock,
  type ThemeGame,
  type ThemeOffer,
  type ThemeSource,
  type ThemeState,
} from '@/lib/table-themes'

let ready: Promise<void> | null = null

function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS table_theme_pick (
      user_id text NOT NULL, game text NOT NULL, theme_id text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, game))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS table_theme_own (
      user_id text NOT NULL, theme_id text NOT NULL, source text NOT NULL, price int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, theme_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS table_theme_cfg (
      theme_id text PRIMARY KEY, source text NOT NULL, price int NOT NULL, min_level int NOT NULL,
      active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

export const isThemeGame = (g: unknown): g is ThemeGame => typeof g === 'string' && (THEME_GAMES as string[]).includes(g)
const isSource = (s: unknown): s is ThemeSource => s === 'free' || s === 'shop' || s === 'task'

export async function getThemeCatalog(): Promise<Record<string, ThemeOffer>> {
  await ensure()
  const out: Record<string, ThemeOffer> = Object.fromEntries(Object.entries(DEFAULT_OFFERS).map(([k, v]) => [k, { ...v }]))
  const r = await rows<{ theme_id: string; source: string; price: number; min_level: number; active: boolean }>(
    sql`SELECT theme_id, source, price, min_level, active FROM table_theme_cfg`,
  )
  for (const row of r) {
    if (!out[row.theme_id] || !isSource(row.source)) continue
    out[row.theme_id] = { id: row.theme_id, source: row.source, price: Number(row.price), minLevel: Number(row.min_level), active: Boolean(row.active) }
  }
  return out
}

export async function saveThemeOffer(input: ThemeOffer) {
  await ensure()
  if (!isThemeId(input.id)) throw new Error('Tema bulunamadı.')
  if (!isSource(input.source)) throw new Error('Geçersiz kaynak.')
  const price = Math.trunc(Number(input.price))
  const minLevel = Math.trunc(Number(input.minLevel))
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) throw new Error('Fiyat 0 ile 1.000.000 arasında olmalı.')
  if (input.source === 'shop' && price < 1) throw new Error('Mağaza temasının fiyatı en az 1 KC olmalı.')
  if (!Number.isFinite(minLevel) || minLevel < 1 || minLevel > MAX_THEME_LEVEL) throw new Error(`Rozet seviyesi 1 ile ${MAX_THEME_LEVEL} arasında olmalı.`)
  await rows(sql`INSERT INTO table_theme_cfg (theme_id, source, price, min_level, active)
    VALUES (${input.id}, ${input.source}, ${input.source === 'shop' ? price : 0}, ${minLevel}, ${Boolean(input.active)})
    ON CONFLICT (theme_id) DO UPDATE SET source = EXCLUDED.source, price = EXCLUDED.price, min_level = EXCLUDED.min_level,
      active = EXCLUDED.active, updated_at = now()`)
}

export async function getOwnedThemes(userId: string): Promise<string[]> {
  await ensure()
  const r = await rows<{ theme_id: string }>(sql`SELECT theme_id FROM table_theme_own WHERE user_id = ${userId}`)
  return r.map((x) => x.theme_id).filter(isThemeId)
}

/** Grants a theme for good; returns false when the member already had it. */
export async function grantTheme(userId: string, themeId: string, source: ThemeSource = 'task', price = 0): Promise<boolean> {
  await ensure()
  if (!isThemeId(themeId)) return false
  const r = await rows<{ theme_id: string }>(sql`INSERT INTO table_theme_own (user_id, theme_id, source, price)
    VALUES (${userId}, ${themeId}, ${source}, ${price}) ON CONFLICT DO NOTHING RETURNING theme_id`)
  return r.length > 0
}

export async function getThemePicks(userId: string): Promise<Partial<Record<ThemeGame, string>>> {
  await ensure()
  const r = await rows<{ game: string; theme_id: string }>(sql`SELECT game, theme_id FROM table_theme_pick WHERE user_id = ${userId}`)
  const out: Partial<Record<ThemeGame, string>> = {}
  for (const row of r) if (isThemeGame(row.game) && isThemeId(row.theme_id)) out[row.game] = row.theme_id
  return out
}

async function levelOf(userId: string) {
  const { memberLevel } = await import('@/lib/kanka-puan')
  return memberLevel(userId).catch(() => ({ level: 1, names: [] as string[] }))
}

export async function getThemeState(userId: string | null): Promise<ThemeState> {
  const catalog = await getThemeCatalog()
  if (!userId) return { picks: {}, owned: [], level: 0, levelNames: [], catalog, signedIn: false }
  const [picks, owned, lv] = await Promise.all([getThemePicks(userId), getOwnedThemes(userId), levelOf(userId)])
  return { picks, owned, level: lv.level, levelNames: lv.names, catalog, signedIn: true }
}

const lockMessage = (lock: NonNullable<ReturnType<typeof themeLock>>) =>
  lock.kind === 'level'
    ? `Bu tema için Lv ${lock.level} rozetine ulaşman lazım.`
    : lock.kind === 'shop'
      ? 'Bu temayı önce mağazadan almalısın.'
      : lock.kind === 'task'
        ? 'Bu tema sadece görev ödülü olarak kazanılıyor.'
        : 'Bu tema şu an kullanılamıyor.'

export async function setThemePick(userId: string, game: ThemeGame, themeId: string | null) {
  await ensure()
  if (!themeId) {
    await rows(sql`DELETE FROM table_theme_pick WHERE user_id = ${userId} AND game = ${game}`)
    return
  }
  const [catalog, owned, lv] = await Promise.all([getThemeCatalog(), getOwnedThemes(userId), levelOf(userId)])
  const lock = themeLock(catalog[themeId], owned.includes(themeId), lv.level)
  if (lock) throw new Error(lockMessage(lock))
  await rows(sql`INSERT INTO table_theme_pick (user_id, game, theme_id) VALUES (${userId}, ${game}, ${themeId})
    ON CONFLICT (user_id, game) DO UPDATE SET theme_id = EXCLUDED.theme_id, updated_at = now()`)
}

export async function buyTheme(userId: string, userName: string, themeId: string): Promise<{ balance: number }> {
  if (!isThemeId(themeId)) throw new Error('Tema bulunamadı.')
  const { withUserLock } = await import('@/lib/user-lock')
  const { debit, getBalance, recordHistory } = await import('@/lib/member')
  const { assertCanBuy } = await import('@/lib/member-limits')
  return withUserLock(`theme-buy:${userId}`, async () => {
    const [catalog, owned, lv] = await Promise.all([getThemeCatalog(), getOwnedThemes(userId), levelOf(userId)])
    if (owned.includes(themeId)) throw new Error('Bu tema zaten sende.')
    const offer = catalog[themeId]
    if (!offer || offer.source !== 'shop' || !offer.active) throw new Error('Bu tema mağazada satılmıyor.')
    if (lv.level < offer.minLevel) throw new Error(`Bu temayı almak için Lv ${offer.minLevel} rozetine ulaşman lazım.`)
    await assertCanBuy(userId, offer.price)
    if (!(await debit(userId, offer.price))) throw new Error('Kanka Coin bakiyen yetmiyor.')
    await grantTheme(userId, themeId, 'shop', offer.price)
    await recordHistory({
      userId,
      userName,
      game: 'market',
      mode: 'harcama',
      opponent: `Masa teması: ${getTableTheme(themeId)?.name ?? themeId}`,
      stake: offer.price,
      result: 'loss',
      delta: -offer.price,
    }).catch((e) => console.error('[themes] history', (e as Error).message))
    return { balance: await getBalance(userId) }
  })
}

/** The rarest theme any seated player picked for this game; ties keep the earlier seat. */
export async function bestTheme(game: ThemeGame, userIds: string[]): Promise<string | null> {
  await ensure()
  const ids = Array.from(new Set(userIds.filter(Boolean))).slice(0, 8)
  if (!ids.length) return null
  const r = await rows<{ user_id: string; theme_id: string }>(
    sql`SELECT user_id, theme_id FROM table_theme_pick WHERE game = ${game} AND user_id IN ${ids}`,
  )
  let best: { id: string; rank: number; seat: number } | null = null
  for (const row of r) {
    const t = getTableTheme(row.theme_id)
    if (!t) continue
    const rank = RARITY_RANK[t.rarity]
    const seat = ids.indexOf(row.user_id)
    if (!best || rank > best.rank || (rank === best.rank && seat < best.seat)) best = { id: t.id, rank, seat }
  }
  return best?.id ?? null
}
