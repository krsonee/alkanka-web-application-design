'use client'

import { useEffect, useRef, useState } from 'react'

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}
const POLL_MS = 1200
const RETRY_MS = 9000

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

    const dial = async () => {
      lastDial = Date.now()
      const conn = fresh()
      attach(conn.createDataChannel('duel', { ordered: false, maxRetransmits: 0 }))
      await conn.setLocalDescription(await conn.createOffer())
      await gathered(conn)
      if (conn !== pc || !conn.localDescription) return
      await post({ action: 'signal', kind: 'offer', payload: conn.localDescription.toJSON() })
    }

    const tick = async () => {
      if (!alive) return
      const open = channel.current?.readyState === 'open'
      try {
        if (!open) {
          if (host && Date.now() - lastDial > RETRY_MS) await dial()
          const r = await post({ action: 'poll' })
          if (r.ok) {
            const { signals } = (await r.json()) as { signals: { kind: string; payload: RTCSessionDescriptionInit }[] }
            for (const s of signals) {
              if (s.kind === 'offer' && !host) {
                const conn = fresh()
                await conn.setRemoteDescription(s.payload)
                await conn.setLocalDescription(await conn.createAnswer())
                await gathered(conn)
                if (conn === pc && conn.localDescription) {
                  await post({ action: 'signal', kind: 'answer', payload: conn.localDescription.toJSON() })
                }
              } else if (s.kind === 'answer' && host && pc?.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(s.payload)
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
