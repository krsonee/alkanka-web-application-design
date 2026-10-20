import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getMember } from '@/lib/member'
import { getTableRow } from '@/lib/pvp/tables'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const MAX_SDP = 20000

/**
 * Signalling relay for real-time duels (kafa topu / kafa basketbolu). Only the two seated humans may
 * exchange one offer/answer; gameplay itself then flows browser-to-browser over a WebRTC data channel.
 */
async function opponentOf(room: string, userId: string) {
  const t = await getTableRow(room)
  if (!t || t.status === 'iptal' || t.status === 'bitti') return null
  const humans = t.players.filter((p) => !p.bot)
  if (!humans.some((p) => p.id === userId)) return null
  return humans.find((p) => p.id !== userId)?.id ?? null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'Giriş yapmalısın.' }, { status: 401 })
  if (await hitRateLimit(`link:${m.id}`, 120, 60)) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })

  const body = (await req.json().catch(() => ({}))) as { action?: string; kind?: string; payload?: unknown }
  const opp = await opponentOf(room, m.id)
  if (!opp) return NextResponse.json({ error: 'Bu masada rakibin yok.' }, { status: 404 })
  const key = `game:${room}`

  if (body.action === 'signal') {
    if (body.kind !== 'offer' && body.kind !== 'answer') return NextResponse.json({ error: 'Geçersiz sinyal.' }, { status: 400 })
    const payload = JSON.stringify(body.payload ?? {})
    if (payload.length > MAX_SDP) return NextResponse.json({ error: 'Sinyal çok büyük.' }, { status: 400 })
    if (body.kind === 'offer') await pool.query(`DELETE FROM voice_signals WHERE room = $1`, [key])
    await pool.query(`INSERT INTO voice_signals (room, from_id, to_id, kind, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`, [
      key,
      m.id,
      opp,
      body.kind,
      payload,
    ])
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'poll') {
    const r = await pool.query(
      `DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 AND created_at > now() - interval '2 minutes' RETURNING kind, payload`,
      [key, m.id],
    )
    return NextResponse.json({ signals: r.rows })
  }

  return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
}
