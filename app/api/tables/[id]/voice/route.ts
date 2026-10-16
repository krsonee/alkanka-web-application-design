import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getMember } from '@/lib/member'
import { getTableRow } from '@/lib/pvp/tables'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'
import { isSeatedAt } from '@/lib/blackjack-live'

export const dynamic = 'force-dynamic'

const BLACKJACK_ROOM = /^blackjack-masa-(\d{1,3})$/
const MAX_PEERS = 16
const STALE_SECONDS = 12
const MAX_SDP = 20000

type Body = {
  action?: 'join' | 'beat' | 'signal' | 'leave'
  muted?: boolean
  to?: string
  kind?: 'offer' | 'answer' | 'bye'
  payload?: unknown
}

/** Only seated human players may speak; everyone else at the table joins as a listener. Null means no voice room exists. */
async function speakRight(room: string, userId: string): Promise<boolean | null> {
  const bj = BLACKJACK_ROOM.exec(room)
  if (bj) return isSeatedAt(userId, Number(bj[1]))
  const t = await getTableRow(room)
  if (!t || t.status === 'iptal' || t.status === 'bitti') return null
  return t.players.some((p) => p.id === userId && !p.bot)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'Sesli sohbet için giriş yapmalısın.' }, { status: 401 })
  if (await hitRateLimit(`voice:${m.id}`, 150, 60)) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })

  const body = (await req.json().catch(() => ({}))) as Body

  if (body.action === 'leave') {
    await pool.query(`DELETE FROM voice_peers WHERE room = $1 AND user_id = $2`, [room, m.id])
    await pool.query(`DELETE FROM voice_signals WHERE room = $1 AND (from_id = $2 OR to_id = $2)`, [room, m.id])
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'signal') {
    const kind = body.kind
    if (kind !== 'offer' && kind !== 'answer' && kind !== 'bye') return NextResponse.json({ error: 'Geçersiz sinyal.' }, { status: 400 })
    const to = String(body.to ?? '')
    const payload = JSON.stringify(body.payload ?? {})
    if (payload.length > MAX_SDP) return NextResponse.json({ error: 'Sinyal çok büyük.' }, { status: 400 })
    const pair = await pool.query(
      `SELECT count(*)::int AS n FROM voice_peers WHERE room = $1 AND user_id = ANY($2::text[]) AND last_seen > now() - make_interval(secs => $3)`,
      [room, [m.id, to], STALE_SECONDS],
    )
    if (pair.rows[0].n < 2) return NextResponse.json({ error: 'Karşı taraf seslide değil.' }, { status: 404 })
    await pool.query(`INSERT INTO voice_signals (room, from_id, to_id, kind, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`, [room, m.id, to, kind, payload])
    return NextResponse.json({ ok: true })
  }

  if (body.action !== 'join' && body.action !== 'beat') return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const canSpeak = await speakRight(room, m.id)
  if (canSpeak === null) return NextResponse.json({ error: 'Bu masada sesli sohbet yok.' }, { status: 404 })
  const muted = canSpeak ? body.muted !== false : true

  if (body.action === 'join') {
    if (Math.random() < 0.1) {
      void pool.query(`DELETE FROM voice_peers WHERE last_seen < now() - interval '5 minutes'`).catch(() => {})
      void pool.query(`DELETE FROM voice_signals WHERE created_at < now() - interval '2 minutes'`).catch(() => {})
    }
    const count = await pool.query(
      `SELECT count(*)::int AS n FROM voice_peers WHERE room = $1 AND user_id <> $2 AND last_seen > now() - make_interval(secs => $3)`,
      [room, m.id, STALE_SECONDS],
    )
    if (count.rows[0].n >= MAX_PEERS) return NextResponse.json({ error: 'Sesli oda dolu.' }, { status: 409 })
    await pool.query(`DELETE FROM voice_signals WHERE room = $1 AND to_id = $2`, [room, m.id])
  }

  await pool.query(
    `INSERT INTO voice_peers (room, user_id, name, can_speak, muted) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (room, user_id) DO UPDATE SET name = EXCLUDED.name, can_speak = EXCLUDED.can_speak, muted = EXCLUDED.muted, last_seen = now()`,
    [room, m.id, m.name.slice(0, 40), canSpeak, muted],
  )

  const [peers, signals] = await Promise.all([
    pool.query(
      `SELECT user_id, name, can_speak, muted FROM voice_peers
       WHERE room = $1 AND user_id <> $2 AND last_seen > now() - make_interval(secs => $3) ORDER BY joined_at`,
      [room, m.id, STALE_SECONDS],
    ),
    pool.query(`DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 RETURNING id, from_id, kind, payload`, [room, m.id]),
  ])

  return NextResponse.json({
    me: m.id,
    canSpeak,
    peers: peers.rows.map((p) => ({ id: String(p.user_id), name: String(p.name), canSpeak: Boolean(p.can_speak), muted: Boolean(p.muted) })),
    signals: signals.rows
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((s) => ({ from: String(s.from_id), kind: String(s.kind), payload: s.payload })),
  })
}
