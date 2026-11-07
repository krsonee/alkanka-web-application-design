import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { opponentOf } from '@/lib/pvp/duel-channel'

export const dynamic = 'force-dynamic'

const STUN: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
]

/**
 * ICE servers for a duel's direct link. Mobile carriers sit behind NATs that block peer-to-peer, so without a
 * TURN relay every frame falls back to the slow server path. Cloudflare TURN credentials are minted per request
 * and expire, so the long-lived key never reaches the browser.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await opponentOf(`game:${room}`, m.id))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN
  if (!keyId || !token) return NextResponse.json({ iceServers: STUN, turn: false })

  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 4 * 3600 }),
      cache: 'no-store',
    })
    if (!r.ok) return NextResponse.json({ iceServers: STUN, turn: false })
    const { iceServers } = (await r.json()) as { iceServers: RTCIceServer[] }
    // Port 53 is blocked by browsers and only stalls gathering.
    const cleaned = iceServers.map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
    }))
    return NextResponse.json({ iceServers: cleaned, turn: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ iceServers: STUN, turn: false })
  }
}
