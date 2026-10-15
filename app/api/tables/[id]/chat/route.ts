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
  const r = await pool.query(
    `SELECT id, user_id, user_name, is_player, body, created_at FROM (
       SELECT * FROM table_messages WHERE table_id = $1 AND id > $2 ORDER BY id DESC LIMIT 60
     ) m ORDER BY id ASC`,
    [id, after],
  )
  return NextResponse.json({
    messages: r.rows.map((m) => ({
      id: Number(m.id),
      userId: String(m.user_id),
      name: String(m.user_name),
      player: Boolean(m.is_player),
      body: String(m.body),
      at: new Date(m.created_at).toISOString(),
    })),
  })
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

  const payload = (await req.json().catch(() => ({}))) as { body?: unknown }
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
  await pool.query(`INSERT INTO table_messages (table_id, user_id, user_name, is_player, body) VALUES ($1,$2,$3,$4,$5)`, [
    id,
    m.id,
    m.name.slice(0, 40),
    isPlayer,
    body,
  ])
  return NextResponse.json({ ok: true })
}
