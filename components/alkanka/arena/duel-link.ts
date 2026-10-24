'use client'

import { useEffect, useRef, useState } from 'react'

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    // Public relay fallback for mobile/strict NATs where a direct path cannot be punched.
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
}
const POLL_MS = 1200
/** Host waits this long for an answer before sending a fresh offer. */
const RETRY_MS = 12000
/** Once answered, ICE gets this long to open the channel before redialling. */
const CONNECT_MS = 15000
/** Server relay runs from the first second and carries the match until (and unless) a direct channel opens. */
const RELAY_MS = 35
/** Consecutive relay failures before the link is shown as lost. */
const RELAY_FAILS_LOST = 40

export type DuelLink = {
  status: 'connecting' | 'open' | 'lost'
  send: (msg: unknown) => void
  /** Latest-message subscriber; replaced on every render by the game loop. */
  onMessage: React.MutableRefObject<((msg: unknown) => void) | null>
}

function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const check = () => {
      if (pc.iceGatheringState !== 'complete') return
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    pc.addEventListener('icegatheringstatechange', check)
    setTimeout(resolve, 2500)
  })
}

/**
 * Browser-to-browser data channel between the two seated players of a duel table.
 * The host (seat 0) dials; the guest answers. The server only relays one offer/answer pair.
 */
export function useDuelLink(roomId: string, host: boolean): DuelLink {
  const [status, setStatus] = useState<DuelLink['status']>('connecting')
  const channel = useRef<RTCDataChannel | null>(null)
  const onMessage = useRef<((msg: unknown) => void) | null>(null)
  const relaySend = useRef<((msg: unknown) => void) | null>(null)

  useEffect(() => {
    if (!roomId) return
    let alive = true
    let pc: RTCPeerConnection | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastDial = 0
    const url = `/api/tables/${roomId}/link`
    const post = (body: object) =>
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    const attach = (dc: RTCDataChannel) => {
      channel.current = dc
      dc.onopen = () => {
        if (!alive) return
        stopRelay()
        setStatus('open')
      }
      dc.onclose = () => {
        if (alive) startRelay()
      }
      dc.onmessage = (e) => {
        try {
          onMessage.current?.(JSON.parse(e.data as string))
        } catch {
          // Ignore malformed frames.
        }
      }
    }

    // Server relay fallback: used when no direct peer path opens in time.
    let relayMode = false
    let relayFails = 0
    let relayHeard = false
    let relayBusy = 0
    let relayTimer: ReturnType<typeof setInterval> | null = null
    let outbox: { t?: string }[] = []
    const COALESCE = new Set(['s', 'k', '__hi'])

    const queue = (msg: unknown) => {
      let m = msg as { t?: string; ev?: unknown[] }
      if (m?.t && COALESCE.has(m.t)) {
        // Only the newest frame travels, but sound/haptic events from the frames it replaces ride along.
        const old = outbox.find((o) => o.t === m.t) as { ev?: unknown[] } | undefined
        if (old?.ev?.length) m = { ...m, ev: [...old.ev, ...(m.ev ?? [])].slice(-24) }
        outbox = outbox.filter((o) => o.t !== m.t)
      }
      outbox.push(m)
      if (outbox.length > 20) outbox = outbox.slice(-20)
    }
    relaySend.current = queue

    const relayTick = async () => {
      // Two requests in flight halve the gap between frames when each round trip is slow.
      if (!alive || relayBusy >= 2) return
      relayBusy++
      if (!relayHeard) queue({ t: '__hi' })
      const batch = outbox
      outbox = []
      try {
        const r = await post({ action: 'relay', payload: batch })
        if (r.ok) {
          const { msgs } = (await r.json()) as { msgs: { t?: string }[] }
          relayFails = 0
          if (msgs.length && !relayHeard) {
            relayHeard = true
            setStatus('open')
          }
          for (const m of msgs) if (m?.t !== '__hi') onMessage.current?.(m)
        } else {
          outbox = [...batch.filter((m) => m.t === 'end'), ...outbox]
          relayFails++
        }
      } catch {
        outbox = [...batch.filter((m) => m.t === 'end'), ...outbox]
        relayFails++
      }
      if (relayFails === RELAY_FAILS_LOST && relayHeard && alive) setStatus('lost')
      relayBusy--
    }

    const startRelay = () => {
      if (relayMode || !alive) return
      relayMode = true
      relayTimer = setInterval(() => void relayTick(), RELAY_MS)
      void relayTick()
    }

    const stopRelay = () => {
      if (!relayMode) return
      relayMode = false
      if (relayTimer) clearInterval(relayTimer)
      relayTimer = null
      outbox = outbox.filter((m) => m.t === 'end')
    }

    const fresh = () => {
      pc?.close()
      channel.current = null
      pc = new RTCPeerConnection(ICE)
      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') && alive) startRelay()
      }
      if (!host) pc.ondatachannel = (e) => attach(e.channel)
      return pc
    }

    let offerId = ''
    let answeredAt = 0
    let lastOfferId = ''

    const dial = async () => {
      lastDial = Date.now()
      answeredAt = 0
      offerId = Math.random().toString(36).slice(2)
      const id = offerId
      const conn = fresh()
      attach(conn.createDataChannel('duel', { ordered: false, maxRetransmits: 0 }))
      await conn.setLocalDescription(await conn.createOffer())
      await gathered(conn)
      if (conn !== pc || !conn.localDescription) return
      const r = await post({ action: 'signal', kind: 'offer', payload: { id, sdp: conn.localDescription.toJSON() } })
      // Rival not seated yet: try again soon instead of waiting a full retry window.
      if (!r.ok) lastDial = Date.now() - RETRY_MS + POLL_MS * 2
    }

    // The host only redials when no answer came back in time, or an answered attempt never opened / failed.
    const shouldDial = () => {
      if (!host) return false
      const now = Date.now()
      const state = pc?.connectionState
      if (state === 'failed' || state === 'closed') return true
      if (answeredAt) return now - answeredAt > CONNECT_MS
      return now - lastDial > RETRY_MS
    }

    const tick = async () => {
      if (!alive) return
      const open = channel.current?.readyState === 'open'
      try {
        if (!open) {
          if (shouldDial()) await dial()
          const r = await post({ action: 'poll' })
          if (r.ok) {
            const { signals } = (await r.json()) as {
              signals: { kind: string; payload: { id?: string; sdp?: RTCSessionDescriptionInit } }[]
            }
            const offers = signals.filter((s) => s.kind === 'offer')
            const latestOffer = offers[offers.length - 1]
            if (!host && latestOffer?.payload.sdp && latestOffer.payload.id !== lastOfferId) {
              lastOfferId = latestOffer.payload.id ?? ''
              const conn = fresh()
              await conn.setRemoteDescription(latestOffer.payload.sdp)
              await conn.setLocalDescription(await conn.createAnswer())
              await gathered(conn)
              if (conn === pc && conn.localDescription) {
                await post({ action: 'signal', kind: 'answer', payload: { id: lastOfferId, sdp: conn.localDescription.toJSON() } })
              }
            }
            if (host) {
              const answer = signals.find((s) => s.kind === 'answer' && s.payload.id === offerId && s.payload.sdp)
              if (answer?.payload.sdp && pc?.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(answer.payload.sdp)
                answeredAt = Date.now()
              }
            }
          }
        }
      } catch {
        // Retried on the next poll.
      }
      if (alive) timer = setTimeout(tick, open ? POLL_MS * 3 : POLL_MS)
    }

    startRelay()
    void tick()
    return () => {
      alive = false
      relaySend.current = null
      if (timer) clearTimeout(timer)
      if (relayTimer) clearInterval(relayTimer)
      pc?.close()
      channel.current = null
    }
  }, [roomId, host])

  return {
    status,
    onMessage,
    send: (msg) => {
      const dc = channel.current
      if (dc?.readyState === 'open') dc.send(JSON.stringify(msg))
      else relaySend.current?.(msg)
    },
  }
}
