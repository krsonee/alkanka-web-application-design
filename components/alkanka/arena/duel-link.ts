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
      dc.onopen = () => alive && setStatus('open')
      dc.onclose = () => alive && setStatus('lost')
      dc.onmessage = (e) => {
        try {
          onMessage.current?.(JSON.parse(e.data as string))
        } catch {
          // Ignore malformed frames.
        }
      }
    }

    const fresh = () => {
      pc?.close()
      channel.current = null
      pc = new RTCPeerConnection(ICE)
      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') && alive) setStatus('lost')
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

    void tick()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
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
    },
  }
}
