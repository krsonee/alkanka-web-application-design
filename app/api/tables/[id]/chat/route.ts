import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getMember } from '@/lib/member'
import { getTableRow } from '@/lib/pvp/tables'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'
import { isSeatedAt } from '@/lib/blackjack-live'

export const dynamic = 'force-dynamic'

const MAX_LEN = 200
const SHARED_ROOMS = new Set(['rulet-canli'])
const BLACKJACK_ROOM = /^blackjack-masa-(\d{1,3})$/

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const after = Math.max(0, Number(new URL(req.url).searchParams.get('after')) || 0)
  // Partner messages are filtered on the server so the other team (and spectators) never receive them.
  const team = await viewerTeam(id)
  const r = await pool.query(
    `SELECT id, user_id, user_name, is_player, body, created_at, audience FROM (
       SELECT * FROM table_messages WHERE table_id = $1 AND id > $2 AND (audience IS NULL OR audience = $3) ORDER BY id DESC LIMIT 60
     ) m ORDER BY id ASC`,
    [id, after, team ?? '-'],
  )
  return NextResponse.json({
    team,
    messages: r.rows.map((m) => ({
      id: Number(m.id),
      userId: String(m.user_id),
      name: String(m.user_name),
      player: Boolean(m.is_player),
      body: String(m.body),
      at: new Date(m.created_at).toISOString(),
      partner: m.audience != null,
    })),
  })
}

const teamOfSeat = (seat: number) => (seat % 2 === 0 ? 'A' : 'B')

/** The viewer's team letter at a team table, or null for spectators, solo tables and shared rooms. */
async function viewerTeam(id: string) {
  if (SHARED_ROOMS.has(id) || BLACKJACK_ROOM.test(id)) return null
  const [m, t] = await Promise.all([getMember(), getTableRow(id)])
  if (!m || !t || !t.options.team) return null
  const p = t.players.find((x) => x.id === m.id && !x.bot)
  return p ? teamOfSeat(p.seat) : null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'Yazmak için giriş yapmalısın.' }, { status: 401 })
  if (await hitRateLimit(`tablechat:${m.id}`, 6, 15)) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
  // Shared house tables (live roulette) have a fixed room id instead of a PvP table row.
  const bjTable = BLACKJACK_ROOM.exec(id)
  const sharedRoom = SHARED_ROOMS.has(id) || !!bjTable
  const t = sharedRoom ? null : await getTableRow(id)
  if (!sharedRoom && (!t || t.status === 'iptal')) return NextResponse.json({ error: 'Masa bulunamadı.' }, { status: 404 })

  const payload = (await req.json().catch(() => ({}))) as { body?: unknown; partner?: unknown }
  const body = String(payload.body ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN)
  if (!body) return NextResponse.json({ error: 'Mesaj boş olamaz.' }, { status: 400 })

  const recent = await pool.query(
    `SELECT count(*)::int AS n FROM table_messages WHERE user_id = $1 AND created_at > now() - interval '10 seconds'`,
    [m.id],
  )
  if (recent.rows[0].n >= 4) return NextResponse.json({ error: 'Biraz yavaş kanka, birkaç saniye bekle.' }, { status: 429 })

  const isPlayer = t ? t.players.some((p) => p.id === m.id && !p.bot) : bjTable ? await isSeatedAt(m.id, Number(bjTable[1])) : false
  let audience: string | null = null
  if (payload.partner === true) {
    const me = t?.options.team ? t.players.find((p) => p.id === m.id && !p.bot) : undefined
    if (!me) return NextResponse.json({ error: 'Eşine yazmak için eşli masada oturuyor olmalısın.' }, { status: 403 })
    audience = teamOfSeat(me.seat)
  }
  await pool.query(`INSERT INTO table_messages (table_id, user_id, user_name, is_player, body, audience) VALUES ($1,$2,$3,$4,$5,$6)`, [
    id,
    m.id,
    m.name.slice(0, 40),
    isPlayer,
    body,
    audience,
  ])
  return NextResponse.json({ ok: true })
}
