import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getMember } from '@/lib/member'
import { duelChannel, opponentOf } from '@/lib/pvp/duel-channel'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const MAX_SDP = 20000
/** Postgres caps a NOTIFY payload at 8000 bytes. */
const NOTIFY_MAX = 7600
/** How long a "rival's push stream is open" answer is trusted before re-checking. */
const LIVE_TTL = 1500

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
 * The relay is hit ~30×/s per player during a match. Re-checking the session, rate limit and table seat on
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

const liveCache = new Map<string, { live: boolean; until: number }>()

/** Whether `userId` currently holds an open push stream (../stream keeps a 'live' heartbeat row). */
async function streamLive(key: string, userId: string) {
  const id = `${key}|${userId}`
  const now = Date.now()
  const hit = liveCache.get(id)
  if (hit && hit.until > now) return hit.live
  const r = await pool.query(
    `SELECT 1 FROM voice_signals WHERE room = $1 AND to_id = $2 AND kind = 'live' AND created_at > now() - interval '25 seconds' LIMIT 1`,
    [key, userId],
  )
  if (liveCache.size > 500) for (const [k, v] of liveCache) if (v.until <= now) liveCache.delete(k)
  const live = r.rowCount! > 0
  liveCache.set(id, { live, until: now + LIVE_TTL })
  return live
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const body = (await req.json().catch(() => ({}))) as { action?: string; kind?: string; payload?: unknown; drain?: boolean }
  const key = `game:${room}`

  /**
   * Match relay, used until a direct peer-to-peer channel opens (or for the whole match on strict NATs).
   * Frames go out instantly via NOTIFY when the rival's push stream is open; otherwise they are stored for the
   * rival's next drain. Match-ending frames are always stored too, so a stream reconnect cannot swallow them.
   */
  if (body.action === 'relay') {
    const who = await relayIdentity(req, room)
    if (!who) return NextResponse.json({ error: 'Bu masada rakibin yok.' }, { status: 404 })
    const now = Date.now()
    if (now - who.windowAt > 10_000) {
      who.windowAt = now
      who.hits = 0
    }
    if (++who.hits > 1500) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    const msgs = Array.isArray(body.payload) ? body.payload.slice(0, 20) : []
    if (JSON.stringify(msgs).length > MAX_SDP) return NextResponse.json({ error: 'Sinyal çok büyük.' }, { status: 400 })

    const live = msgs.length ? await streamLive(key, who.opp) : false
    const stored = live ? msgs.filter((m) => (m as { t?: string })?.t === 'end') : msgs
    const chunks = live ? chunkFrames(msgs) : []
    const drain = body.drain !== false

    const [, r] = await Promise.all([
      chunks.length
        ? pool.query(`SELECT pg_notify($1, c) FROM unnest($2::text[]) WITH ORDINALITY AS u(c, n) ORDER BY n`, [
            duelChannel(key, who.opp),
            chunks,
          ])
        : null,
      stored.length || drain
        ? pool.query<{ id: string; payload: unknown[] }>(
            `WITH ins AS (
               INSERT INTO voice_signals (room, from_id, to_id, kind, payload)
               SELECT $1, $2, $3, 'relay', $4::jsonb WHERE $4::text IS NOT NULL
             )
             DELETE FROM voice_signals WHERE $5::boolean AND room = $1 AND to_id = $2 AND kind = 'relay' RETURNING id, payload`,
            [key, who.me, who.opp, stored.length ? JSON.stringify(stored) : null, drain],
          )
        : null,
    ])
    const rows = (r?.rows ?? []).sort((a, b) => Number(a.id) - Number(b.id))
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
    if (body.kind === 'offer') await pool.query(`DELETE FROM voice_signals WHERE room = $1 AND kind IN ('offer', 'answer')`, [key])
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
      `DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 AND kind IN ('offer', 'answer') AND created_at > now() - interval '2 minutes' RETURNING kind, payload`,
      [key, m.id],
    )
    return NextResponse.json({ signals: r.rows })
  }

  return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
}
