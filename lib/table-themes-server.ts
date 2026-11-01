import 'server-only'
import { rows, sql } from '@/lib/db'
import { isThemeId, THEME_GAMES, type ThemeGame } from '@/lib/table-themes'

let ready: Promise<void> | null = null

function ensure() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS table_theme_pick (
    user_id text NOT NULL, game text NOT NULL, theme_id text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, game))`)
    .then(() => undefined)
    .catch((e) => {
      ready = null
      throw e
    })
  return ready
}

export const isThemeGame = (g: unknown): g is ThemeGame => typeof g === 'string' && (THEME_GAMES as string[]).includes(g)

export async function getThemePicks(userId: string): Promise<Partial<Record<ThemeGame, string>>> {
  await ensure()
  const r = await rows<{ game: string; theme_id: string }>(sql`SELECT game, theme_id FROM table_theme_pick WHERE user_id = ${userId}`)
  const out: Partial<Record<ThemeGame, string>> = {}
  for (const row of r) if (isThemeGame(row.game) && isThemeId(row.theme_id)) out[row.game] = row.theme_id
  return out
}

export async function setThemePick(userId: string, game: ThemeGame, themeId: string | null) {
  await ensure()
  if (!themeId) {
    await rows(sql`DELETE FROM table_theme_pick WHERE user_id = ${userId} AND game = ${game}`)
    return
  }
  await rows(sql`INSERT INTO table_theme_pick (user_id, game, theme_id) VALUES (${userId}, ${game}, ${themeId})
    ON CONFLICT (user_id, game) DO UPDATE SET theme_id = EXCLUDED.theme_id, updated_at = now()`)
}
