'use client'

import { useEffect, useRef, useState } from 'react'

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }],
}
const POLL_MS = 1200
/** Host waits this long for an answer before sending a fresh offer. */
const RETRY_MS = 12000
/** Once answered, ICE gets this long to open the channel before redialling. */
const CONNECT_MS = 15000
/** Outgoing frames are flushed this often while no direct channel is open. */
const FLUSH_MS = 33
/** Concurrent flush requests; the game reorders by timestamp/sequence, so overlap only cuts latency. */
const MAX_IN_FLIGHT = 4
/** A refused push stream is retried this often; meanwhile frames are drained by polling. */
const STREAM_RETRY_MS = 4000
/** While the push stream is open, stored frames are still drained this often as a safety net across reconnects. */
const DRAIN_EVERY = 45
/** Consecutive send failures before the link is shown as lost. */
const FAILS_LOST = 40

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
    setTimeout(resolve, 2000)
  })
}

/**
 * Real-time link between the two seated players of a duel table.
 * Preferred: a direct WebRTC data channel (host dials, guest answers). Until/unless that opens, frames travel
 * through the server: sent with short POSTs and received instantly over a server-sent-event stream (push),
 * or — if the stream cannot open — by the older polling relay.
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

    let heard = false
    const deliver = (msgs: { t?: string }[]) => {
      for (const m of msgs) {
        if (!m || typeof m !== 'object') continue
        if (!heard) {
          heard = true
          setStatus('open')
        }
        if (m.t !== '__hi') onMessage.current?.(m)
      }
    }

    const attach = (dc: RTCDataChannel) => {
      channel.current = dc
      dc.onopen = () => {
        if (!alive) return
        stopServer()
        setStatus('open')
      }
      dc.onclose = () => {
        if (alive) startServer()
      }
      dc.onmessage = (e) => {
        try {
          onMessage.current?.(JSON.parse(e.data as string))
        } catch {
          // Ignore malformed frames.
        }
      }
    }

    type Frame = { t?: string; ev?: unknown[]; e?: unknown[] }
    let outbox: Frame[] = []
    // 'i' (guest input) carries press counters, so only the newest one matters; without this ~60 inputs/s flood the batch.
    const COALESCE = new Set(['k', 'i', '__hi'])
    // Host snapshots are interpolated on the guest, so a few real intermediate states per batch keep arcs smooth.
    const SNAP_KEEP = 3

    // Games carry their one-shot events (sounds, pops, banners) in `ev` (kafa topu) or `e` (basketbol).
    const carryEvents = (from: Frame | undefined, into: Frame): Frame => {
      if (!from) return into
      const out = { ...into }
      if (from.ev?.length) out.ev = [...from.ev, ...(into.ev ?? [])].slice(-24)
      if (from.e?.length) out.e = [...from.e, ...(into.e ?? [])].slice(-24)
      return out
    }

    const queue = (msg: unknown) => {
      let m = msg as Frame
      if (m?.t && COALESCE.has(m.t)) {
        m = carryEvents(outbox.find((o) => o.t === m.t), m)
        outbox = outbox.filter((o) => o.t !== m.t)
      } else if (m?.t === 's') {
        const snaps = outbox.filter((o) => o.t === 's')
        if (snaps.length >= SNAP_KEEP) {
          const oldest = snaps[0]
          const next = snaps[1] ?? m
          const merged = carryEvents(oldest, next)
          outbox = outbox.filter((o) => o !== oldest).map((o) => (o === next ? merged : o))
          if (next === m) m = merged
        }
      }
      outbox.push(m)
      if (outbox.length > 20) outbox = outbox.slice(-20)
    }
    relaySend.current = queue

    // ---- server path: frames go out with short POSTs; incoming ones arrive on the push stream when it is
    // open, otherwise every POST also drains what the server stored for us (polling fallback). ----
    let serverOn = false
    let es: EventSource | null = null
    let streamOpen = false
    let retryStream: ReturnType<typeof setTimeout> | null = null
    let flushTimer: ReturnType<typeof setInterval> | null = null
    let inFlight = 0
    let fails = 0
    let ticks = 0

    const openStream = () => {
      if (es || !alive || !serverOn) return
      const source = new EventSource(`/api/tables/${roomId}/stream`)
      es = source
      source.onopen = () => {
        streamOpen = true
        // Collect anything stored for us before the rival noticed our stream.
        ticks = DRAIN_EVERY - 1
      }
      source.onmessage = (e) => {
        try {
          const msgs = JSON.parse(e.data as string)
          if (Array.isArray(msgs)) deliver(msgs)
        } catch {
          // Ignore malformed frames.
        }
      }
      // EventSource retries by itself after a dropped connection; a refused one (4xx/5xx) closes for good,
      // so it is reopened later while the polling fallback carries the match.
      source.onerror = () => {
        streamOpen = false
        if (source.readyState === EventSource.CLOSED && es === source) {
          es = null
          retryStream = setTimeout(openStream, STREAM_RETRY_MS)
        }
      }
    }

    const closeStream = () => {
      if (retryStream) clearTimeout(retryStream)
      retryStream = null
      es?.close()
      es = null
      streamOpen = false
    }

    const flush = async () => {
      if (!alive || !serverOn || inFlight >= MAX_IN_FLIGHT) return
      ticks++
      const drain = !streamOpen || ticks % DRAIN_EVERY === 0
      if (!outbox.length && !drain && heard) return
      inFlight++
      if (!heard) queue({ t: '__hi' })
      const batch = outbox
      outbox = []
      try {
        const r = await post({ action: 'relay', payload: batch, drain })
        if (r.ok) {
          fails = 0
          const { msgs } = (await r.json()) as { msgs?: { t?: string }[] }
          if (msgs?.length) deliver(msgs)
        } else {
          outbox = [...batch.filter((m) => m.t === 'end'), ...outbox]
          fails++
        }
      } catch {
        outbox = [...batch.filter((m) => m.t === 'end'), ...outbox]
        fails++
      }
      if (fails === FAILS_LOST && heard && alive) setStatus('lost')
      inFlight--
    }

    const startServer = () => {
      if (serverOn || !alive) return
      serverOn = true
      openStream()
      flushTimer = setInterval(() => void flush(), FLUSH_MS)
      void flush()
    }

    const stopServer = () => {
      if (!serverOn) return
      serverOn = false
      if (flushTimer) clearInterval(flushTimer)
      flushTimer = null
      closeStream()
      outbox = outbox.filter((m) => m.t === 'end')
    }

    // ---- direct WebRTC path ----
    // TURN credentials are minted server-side and expire; refetched for each fresh connection after 1 hour.
    let ice: RTCConfiguration = ICE
    let iceAt = 0
    const loadIce = async () => {
      if (Date.now() - iceAt < 3600_000) return
      try {
        const r = await fetch(`/api/tables/${roomId}/ice`, { cache: 'no-store' })
        if (r.ok) {
          const { iceServers } = (await r.json()) as { iceServers?: RTCIceServer[] }
          if (iceServers?.length) {
            ice = { iceServers }
            iceAt = Date.now()
          }
        }
      } catch {
        // STUN-only fallback.
      }
    }

    const fresh = () => {
      pc?.close()
      channel.current = null
      pc = new RTCPeerConnection(ice)
      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') && alive) startServer()
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
      await loadIce()
      if (!alive || id !== offerId) return
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
              await loadIce()
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

    startServer()
    void tick()
    return () => {
      alive = false
      relaySend.current = null
      if (timer) clearTimeout(timer)
      if (flushTimer) clearInterval(flushTimer)
      closeStream()
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
