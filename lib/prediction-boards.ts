import 'server-only'
import { rows, sql } from '@/lib/db'
import { checkPrize, ensureLeague, openBoardId, standings, type LeagueRow } from '@/lib/predictions'
import { MAX_BOARD_NAME, MAX_LEAGUE_PLACES, MAX_OPEN_BOARDS, normalizePrize, type Board, type BoardWinner, type Prize } from '@/lib/predictions-shared'

const DAY_MS = 86_400_000

const places = (raw: unknown): Prize[] => (Array.isArray(raw) ? raw : []).map(normalizePrize).filter((p): p is Prize => p !== null)

const toBoard = (x: Record<string, unknown>): Board => ({
  id: Number(x.id),
  name: String(x.name),
  general: Boolean(x.general),
  places: places(x.places),
  open: x.status === 'open',
  winners: Array.isArray(x.winners) ? (x.winners as BoardWinner[]) : [],
  closedAt: x.closed_at ? new Date(String(x.closed_at)).toISOString() : null,
  matches: Number(x.matches ?? 0),
  waiting: Number(x.waiting ?? 0),
})

/** Special leagues, open ones first. `recentDays` leaves out leagues closed longer ago than that. */
export async function listBoards(opts: { recentDays?: number } = {}): Promise<Board[]> {
  await ensureLeague()
  const cutoff = opts.recentDays === undefined ? null : new Date(Date.now() - opts.recentDays * DAY_MS).toISOString()
  const r = await rows(sql`SELECT b.*,
      (SELECT count(*) FROM league_matches m WHERE m.board_id = b.id) AS matches,
      (SELECT count(*) FROM league_matches m WHERE m.board_id = b.id AND NOT m.settled) AS waiting
    FROM league_boards b
    WHERE ${cutoff}::timestamptz IS NULL OR b.status = 'open' OR b.closed_at > ${cutoff}::timestamptz
    ORDER BY (b.status = 'open') DESC, b.created_at DESC, b.id DESC LIMIT 60`)
  return r.map(toBoard)
}

export async function boardTable(id: number, limit = 50): Promise<LeagueRow[]> {
  await ensureLeague()
  return standings(null, null, limit, id)
}

async function boardById(id: number): Promise<Board | null> {
  return (await listBoards()).find((b) => b.id === id) ?? null
}

export async function saveBoard(input: unknown): Promise<{ board: Board; created: boolean }> {
  await ensureLeague()
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const name = String(raw.name ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_BOARD_NAME)
  if (name.length < 3) throw new Error('Lige en az 3 harfli bir ad ver.')
  const list = Array.isArray(raw.places) ? raw.places : []
  if (list.length > MAX_LEAGUE_PLACES) throw new Error(`En fazla ${MAX_LEAGUE_PLACES} sıraya ödül verilebilir.`)
  const prizes: Prize[] = []
  for (const [i, p] of list.entries()) {
    const prize = normalizePrize(p)
    if (!prize) throw new Error(`${i + 1}. sıranın ödülü eksik. Tutarı ya da ürünü seç, istemiyorsan sırayı kaldır.`)
    prizes.push(await checkPrize(prize))
  }
  const general = Boolean(raw.general)
  const id = Number(raw.id)
  const editing = Number.isSafeInteger(id) && id > 0
  const taken = await rows(sql`SELECT id FROM league_boards WHERE status = 'open' AND lower(name) = lower(${name}) AND id <> ${editing ? id : 0}`)
  if (taken.length) throw new Error('Bu adla açık bir lig zaten var. Başka bir ad seç.')

  if (editing) {
    const saved = await rows(sql`UPDATE league_boards SET name = ${name}, general = ${general}, places = ${JSON.stringify(prizes)}::jsonb
      WHERE id = ${id} AND status = 'open' RETURNING id`)
    if (!saved.length) throw new Error('Lig bulunamadı ya da kapatılmış; kapatılan lig değiştirilemez.')
    return { board: (await boardById(id))!, created: false }
  }
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM league_boards WHERE status = 'open'`)
  if (Number(n) >= MAX_OPEN_BOARDS) throw new Error(`Aynı anda en fazla ${MAX_OPEN_BOARDS} açık lig olabilir. Biten ligleri kapat.`)
  const [made] = await rows(sql`INSERT INTO league_boards (name, general, places) VALUES (${name}, ${general}, ${JSON.stringify(prizes)}::jsonb) RETURNING id`)
  return { board: (await boardById(Number(made.id)))!, created: true }
}

/**
 * Ends a special league: its table is frozen and the prizes go to the first places, once.
 * A league with a match still waiting for its result cannot be closed, so nobody is paid on a half table.
 */
export async function closeBoard(id: number): Promise<{ board: Board; winners: BoardWinner[] }> {
  await ensureLeague()
  const board = Number.isSafeInteger(id) && id > 0 ? await boardById(id) : null
  if (!board) throw new Error('Lig bulunamadı.')
  if (!board.open) throw new Error('Lig zaten kapatılmış.')
  if (board.waiting > 0) throw new Error(`Bu ligde sonucu girilmemiş ${board.waiting} maç var. Önce sonuçlarını gir ya da maçları ligden çıkar.`)
  const claimed = await rows(sql`UPDATE league_boards SET status = 'closed', closed_at = now() WHERE id = ${id} AND status = 'open' RETURNING id`)
  if (!claimed.length) throw new Error('Lig zaten kapatılmış.')

  const { grantAward } = await import('@/lib/prediction-awards')
  const { roleBlocks } = await import('@/lib/kanka-puan')
  const table = await standings(null, null, board.places.length + 20, id)
  const winners: BoardWinner[] = []
  for (const row of table) {
    if (winners.length >= board.places.length) break
    // Staff stay on the table but the prizes are for members.
    if (row.points <= 0 || (await roleBlocks(row.userId, 'events').catch(() => false))) continue
    const place = winners.length + 1
    const prize = board.places[place - 1]
    await grantAward({ userId: row.userId, userName: row.name, source: 'board', ref: `lig:${id}`, place, title: `${board.name} ${place}. sıra`, prize })
    winners.push({ place, userId: row.userId, name: row.name, points: row.points, prize })
  }
  await rows(sql`UPDATE league_boards SET winners = ${JSON.stringify(winners)}::jsonb WHERE id = ${id}`)
  return { board: (await boardById(id))!, winners }
}

/** Only a league without a scored match can be removed; its waiting matches go back to the general league. */
export async function deleteBoard(id: number): Promise<{ name: string; moved: number }> {
  await ensureLeague()
  const board = Number.isSafeInteger(id) && id > 0 ? await boardById(id) : null
  if (!board) throw new Error('Lig bulunamadı.')
  if (!board.open) throw new Error('Kapatılan lig silinemez; kazananları kayıtta kalır.')
  if (board.matches > board.waiting) throw new Error('Bu ligde sonuçlanmış maç var. Silmek yerine ligi kapat.')
  const moved = await rows(sql`UPDATE league_matches SET board_id = NULL WHERE board_id = ${id} RETURNING id`)
  await rows(sql`DELETE FROM league_boards WHERE id = ${id} AND status = 'open'`)
  return { name: board.name, moved: moved.length }
}

/** Files a match under another league. Once a member has answered, the table their points go to is settled. */
export async function setMatchBoard(matchId: number, boardInput: unknown) {
  await ensureLeague()
  const boardId = await openBoardId(boardInput)
  const r = await rows(sql`UPDATE league_matches m SET board_id = ${boardId}
    WHERE m.id = ${matchId} AND NOT m.settled AND NOT EXISTS (SELECT 1 FROM league_picks p WHERE p.match_id = m.id) RETURNING m.id`)
  if (!r.length) throw new Error('Bu maça tahmin yapılmış ya da maç sonuçlanmış; ligi artık değiştirilemez.')
}
