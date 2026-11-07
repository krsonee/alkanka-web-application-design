import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getMember } from '@/lib/member'
import { duelChannel, opponentOf } from '@/lib/pvp/duel-channel'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const MAX_SDP = 20000
/** Postgres caps a NOTIFY payload at 8000 bytes. */
const NOTIFY_MAX = 7600

/** Packs frames into NOTIFY-sized JSON arrays, keeping their order. */
function chunkFrames(msgs: unknown[]) {
  const out: string[] = []
  let cur: string[] = []
  let size = 2
  for (const m of msgs) {
    const s = JSON.stringify(m)
    if (s.length + 2 > NOTIFY_MAX) continue
    if (cur.length && size + s.length + 1 > NOTIFY_MAX) {
      out.push(`[${cur.join(',')}]`)
      cur = []
      size = 2
    }
    cur.push(s)
    size += s.length + 1
  }
  if (cur.length) out.push(`[${cur.join(',')}]`)
  return out
}

/**
 * The relay is hit ~25×/s per player during a match. Re-checking the session, rate limit and table seat on
 * every packet cost 4-5 DB round trips and made play stutter, so a verified (cookie, room) pair is reused briefly.
 */
const RELAY_AUTH_TTL = 20_000
const relayAuth = new Map<string, { me: string; opp: string; until: number; hits: number; windowAt: number }>()

async function relayIdentity(req: Request, room: string) {
  const cookie = req.headers.get('cookie') ?? ''
  const cacheKey = `${room}|${cookie}`
  const now = Date.now()
  const hit = relayAuth.get(cacheKey)
  if (hit && hit.until > now) return hit
  const m = await getMember()
  if (!m) return null
  const opp = await opponentOf(room, m.id)
  if (!opp) return null
  if (relayAuth.size > 500) for (const [k, v] of relayAuth) if (v.until <= now) relayAuth.delete(k)
  const entry = { me: m.id, opp, until: now + RELAY_AUTH_TTL, hits: 0, windowAt: now }
  relayAuth.set(cacheKey, entry)
  return entry
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const body = (await req.json().catch(() => ({}))) as { action?: string; kind?: string; payload?: unknown; drain?: boolean }
  const key = `game:${room}`

  // Push relay: frames are NOTIFY'd straight to the rival's open stream (see ../stream) with no polling wait.
  // Match-ending frames are also stored so the rival's periodic drain still gets them across a stream reconnect.
  if (body.action === 'push') {
    const who = await relayIdentity(req, room)
    if (!who) return NextResponse.json({ error: 'Bu masada rakibin yok.' }, { status: 404 })
    const now = Date.now()
    if (now - who.windowAt > 10_000) {
      who.windowAt = now
      who.hits = 0
    }
    if (++who.hits > 1500) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    const msgs = Array.isArray(body.payload) ? body.payload.slice(0, 20) : []
    const chunks = chunkFrames(msgs)
    const keep = msgs.filter((m) => (m as { t?: string })?.t === 'end')
    await Promise.all([
      chunks.length
        ? pool.query(`SELECT pg_notify($1, c) FROM unnest($2::text[]) WITH ORDINALITY AS u(c, n) ORDER BY n`, [
            duelChannel(key, who.opp),
            chunks,
          ])
        : null,
      keep.length
        ? pool.query(`INSERT INTO voice_signals (room, from_id, to_id, kind, payload) VALUES ($1,$2,$3,'relay',$4::jsonb)`, [
            key,
            who.me,
            who.opp,
            JSON.stringify(keep),
          ])
        : null,
    ])
    if (!body.drain) return NextResponse.json({ ok: true })
    const r = await pool.query<{ id: string; payload: unknown[] }>(
      `DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 AND kind = 'relay' RETURNING id, payload`,
      [key, who.me],
    )
    const rows = r.rows.sort((a, b) => Number(a.id) - Number(b.id))
    return NextResponse.json({ ok: true, msgs: rows.flatMap((row) => (Array.isArray(row.payload) ? row.payload : [])) })
  }

  // Polling relay: fallback when the push stream cannot be opened.
  if (body.action === 'relay') {
    const who = await relayIdentity(req, room)
    if (!who) return NextResponse.json({ error: 'Bu masada rakibin yok.' }, { status: 404 })
    const now = Date.now()
    if (now - who.windowAt > 10_000) {
      who.windowAt = now
      who.hits = 0
    }
    if (++who.hits > 1200) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    const msgs = Array.isArray(body.payload) ? body.payload.slice(0, 20) : []
    const payload = msgs.length ? JSON.stringify(msgs) : null
    if (payload && payload.length > MAX_SDP) return NextResponse.json({ error: 'Sinyal çok büyük.' }, { status: 400 })
    // Write our batch and drain the rival's in a single round trip.
    const r = await pool.query<{ id: string; payload: unknown[] }>(
      `WITH ins AS (
         INSERT INTO voice_signals (room, from_id, to_id, kind, payload)
         SELECT $1, $2, $3, 'relay', $4::jsonb WHERE $4::text IS NOT NULL
       )
       DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 AND kind = 'relay' RETURNING id, payload`,
      [key, who.me, who.opp, payload],
    )
    const rows = r.rows.sort((a, b) => Number(a.id) - Number(b.id))
    return NextResponse.json({ msgs: rows.flatMap((row) => (Array.isArray(row.payload) ? row.payload : [])) })
  }

  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'Giriş yapmalısın.' }, { status: 401 })
  if (await hitRateLimit(`link:${m.id}`, 120, 60)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
  }
  const opp = await opponentOf(room, m.id)
  if (!opp) return NextResponse.json({ error: 'Bu masada rakibin yok.' }, { status: 404 })

  if (body.action === 'signal') {
    if (body.kind !== 'offer' && body.kind !== 'answer') return NextResponse.json({ error: 'Geçersiz sinyal.' }, { status: 400 })
    const payload = JSON.stringify(body.payload ?? {})
    if (payload.length > MAX_SDP) return NextResponse.json({ error: 'Sinyal çok büyük.' }, { status: 400 })
    if (body.kind === 'offer') await pool.query(`DELETE FROM voice_signals WHERE room = $1 AND kind <> 'relay'`, [key])
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
      `DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 AND kind <> 'relay' AND created_at > now() - interval '2 minutes' RETURNING kind, payload`,
      [key, m.id],
    )
    return NextResponse.json({ signals: r.rows })
  }

  return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
}
