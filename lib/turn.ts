const STUN: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]

export type IceGrant = { iceServers: RTCIceServer[]; turn: boolean }

/**
 * ICE servers for a browser-to-browser link. Mobile carriers sit behind NATs that block peer-to-peer, so without a
 * TURN relay one side often cannot reach the other. Cloudflare TURN credentials are minted per request and expire,
 * so the long-lived key never reaches the browser.
 */
export async function mintIceServers(): Promise<IceGrant> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN
  if (!keyId || !token) return { iceServers: STUN, turn: false }

  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 4 * 3600 }),
      cache: 'no-store',
      // Without relay servers the link still tries directly; waiting on this would hold the table up.
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) return { iceServers: STUN, turn: false }
    const { iceServers } = (await r.json()) as { iceServers: RTCIceServer[] }
    // Port 53 is blocked by browsers and only stalls gathering.
    const cleaned = iceServers.map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
    }))
    return { iceServers: cleaned, turn: true }
  } catch {
    return { iceServers: STUN, turn: false }
  }
}
