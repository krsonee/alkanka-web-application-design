'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Headphones, HeadphoneOff, Loader2, Mic, MicOff, PhoneOff, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '../points-context'

type Peer = { id: string; name: string; canSpeak: boolean; muted: boolean }
type Signal = { from: string; kind: 'offer' | 'answer' | 'bye'; payload: RTCSessionDescriptionInit }
type Beat = { me: string; canSpeak: boolean; peers: Peer[]; signals: Signal[] }

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}
const BEAT_MS = 2000
const RETRY_MS = 8000

/** Waits for ICE gathering so each side sends one complete SDP instead of trickling candidates through the server. */
function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    const check = () => pc.iceGatheringState === 'complete' && done()
    pc.addEventListener('icegatheringstatechange', check)
    setTimeout(done, 2500)
  })
}

/**
 * Peer-to-peer table voice. Audio flows directly between browsers (WebRTC); the server only relays
 * one offer/answer per pair and a presence heartbeat. Seated players speak, spectators only listen.
 */
export function VoiceChat({ roomId, className }: { roomId: string; className?: string }) {
  const { member, requireLogin } = usePoints()
  const [status, setStatus] = useState<'off' | 'joining' | 'on'>('off')
  const [canSpeak, setCanSpeak] = useState(false)
  const [muted, setMuted] = useState(true)
  const [deaf, setDeaf] = useState(false)
  const [peers, setPeers] = useState<Peer[]>([])
  const [linked, setLinked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)

  const me = useRef<string | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const pcs = useRef(new Map<string, RTCPeerConnection>())
  const audios = useRef(new Map<string, HTMLAudioElement>())
  const attempts = useRef(new Map<string, number>())
  const mutedRef = useRef(true)
  const deafRef = useRef(false)
  const speakRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)

  const url = `/api/tables/${roomId}/voice`
  const post = useCallback(
    (body: object) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    [url],
  )

  const markLinked = () => {
    const ids = new Set<string>()
    pcs.current.forEach((pc, id) => pc.connectionState === 'connected' && ids.add(id))
    setLinked(ids)
  }

  const closePeer = useCallback((id: string) => {
    pcs.current.get(id)?.close()
    pcs.current.delete(id)
    const a = audios.current.get(id)
    if (a) {
      a.srcObject = null
      a.remove()
    }
    audios.current.delete(id)
    markLinked()
  }, [])

  const makePc = useCallback(
    (id: string) => {
      closePeer(id)
      const pc = new RTCPeerConnection(ICE)
      pcs.current.set(id, pc)
      pc.ontrack = (e) => {
        let a = audios.current.get(id)
        if (!a) {
          a = document.createElement('audio')
          a.autoplay = true
          a.setAttribute('playsinline', '')
          document.body.appendChild(a)
          audios.current.set(id, a)
        }
        a.srcObject = e.streams[0] ?? new MediaStream([e.track])
        a.muted = deafRef.current
        void a.play().catch(() => {})
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (pcs.current.get(id) === pc) closePeer(id)
        } else markLinked()
      }
      return pc
    },
    [closePeer],
  )

  const localTrack = () => stream.current?.getAudioTracks()[0] ?? null

  /** Asks the browser for the mic and explains exactly why it failed, so the user knows what to fix. */
  const requestMic = async (): Promise<MediaStream | null> => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Mikrofon sadece güvenli (https) bağlantıda çalışır.')
      return null
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      setError(null)
      return s
    } catch (e) {
      const name = (e as DOMException)?.name
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Mikrofon izni engelli. Adres çubuğundaki kilit simgesine tıklayıp Mikrofon’u "İzin ver" yap, sonra mikrofon butonuna tekrar bas.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'Mikrofon bulunamadı. Cihazına mikrofon bağlı olduğundan emin ol.'
            : name === 'NotReadableError'
              ? 'Mikrofon başka bir uygulama tarafından kullanılıyor. O uygulamayı kapatıp tekrar dene.'
              : 'Mikrofon açılamadı, tekrar dene.',
      )
      return null
    }
  }

  const call = useCallback(
    async (id: string) => {
      attempts.current.set(id, Date.now())
      const pc = makePc(id)
      const track = localTrack()
      if (track) pc.addTransceiver(track, { direction: 'sendrecv', streams: [stream.current!] })
      else pc.addTransceiver('audio', { direction: 'recvonly' })
      await pc.setLocalDescription(await pc.createOffer())
      await gathered(pc)
      if (pcs.current.get(id) !== pc || !pc.localDescription) return
      await post({ action: 'signal', to: id, kind: 'offer', payload: pc.localDescription.toJSON() })
    },
    [makePc, post],
  )

  const answer = useCallback(
    async (id: string, offer: RTCSessionDescriptionInit) => {
      const pc = makePc(id)
      await pc.setRemoteDescription(offer)
      const track = localTrack()
      const tr = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio')
      if (track && tr) {
        tr.direction = 'sendrecv'
        await tr.sender.replaceTrack(track)
        tr.sender.setStreams?.(stream.current!)
      }
      await pc.setLocalDescription(await pc.createAnswer())
      await gathered(pc)
      if (pcs.current.get(id) !== pc || !pc.localDescription) return
      await post({ action: 'signal', to: id, kind: 'answer', payload: pc.localDescription.toJSON() })
    },
    [makePc, post],
  )

  const teardown = useCallback(() => {
    active.current = false
    if (timer.current) clearTimeout(timer.current)
    pcs.current.forEach((_, id) => closePeer(id))
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    attempts.current.clear()
    setPeers([])
  }, [closePeer])

  const leave = useCallback(() => {
    if (!active.current) return
    teardown()
    void post({ action: 'leave' }).catch(() => {})
    setStatus('off')
    setMuted(true)
    mutedRef.current = true
  }, [post, teardown])

  const tick = useCallback(async () => {
    if (!active.current) return
    try {
      const r = await post({ action: 'beat', muted: mutedRef.current })
      if (!active.current) return
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))).error
        if (r.status === 404) {
          setError(err ?? 'Sesli oda kapandı.')
          leave()
          return
        }
      } else {
        const data = (await r.json()) as Beat
        me.current = data.me
        if (data.canSpeak !== speakRef.current) {
          // Seat changed (sat down or stood up): rebuild every link with the new mic rights.
          speakRef.current = data.canSpeak
          setCanSpeak(data.canSpeak)
          pcs.current.forEach((_, id) => closePeer(id))
          attempts.current.clear()
          if (data.canSpeak && !stream.current) stream.current = await requestMic()
          if (!data.canSpeak) {
            stream.current?.getTracks().forEach((t) => t.stop())
            stream.current = null
            mutedRef.current = true
            setMuted(true)
          }
          const t = localTrack()
          if (t) t.enabled = !mutedRef.current
        }

        for (const s of data.signals) {
          if (s.kind === 'offer') await answer(s.from, s.payload).catch(() => closePeer(s.from))
          else if (s.kind === 'answer') {
            const pc = pcs.current.get(s.from)
            if (pc?.signalingState === 'have-local-offer') await pc.setRemoteDescription(s.payload).catch(() => closePeer(s.from))
          } else closePeer(s.from)
        }

        const ids = new Set(data.peers.map((p) => p.id))
        pcs.current.forEach((_, id) => !ids.has(id) && closePeer(id))
        for (const p of data.peers) {
          // Two listeners have nothing to exchange; the lower id dials so each pair is offered once.
          if (!speakRef.current && !p.canSpeak) {
            if (pcs.current.has(p.id)) closePeer(p.id)
            continue
          }
          if (pcs.current.has(p.id) || data.me > p.id) continue
          if (Date.now() - (attempts.current.get(p.id) ?? 0) < RETRY_MS) continue
          void call(p.id).catch(() => closePeer(p.id))
        }
        setPeers(data.peers)
      }
    } catch {
      // Network blips are retried on the next beat.
    }
    if (active.current) timer.current = setTimeout(tick, BEAT_MS)
  }, [answer, call, closePeer, leave, post])

  const join = async () => {
    if (!requireLogin()) return
    if (!window.RTCPeerConnection) {
      setError('Tarayıcın sesli sohbeti desteklemiyor.')
      return
    }
    setError(null)
    setStatus('joining')
    const r = await post({ action: 'join', muted: true }).catch(() => null)
    if (!r?.ok) {
      setError((await r?.json().catch(() => ({})))?.error ?? 'Sesliye bağlanılamadı.')
      setStatus('off')
      return
    }
    const data = (await r.json()) as Beat
    me.current = data.me
    speakRef.current = data.canSpeak
    setCanSpeak(data.canSpeak)
    if (data.canSpeak) {
      stream.current = await requestMic()
      const t = localTrack()
      if (t) t.enabled = false
    }
    mutedRef.current = true
    setMuted(true)
    active.current = true
    setStatus('on')
    void tick()
  }

  const [, forceRender] = useState(0)
  const toggleMic = async () => {
    if (!localTrack()) {
      // No mic yet (permission denied or dismissed): ask again on this tap, then relink peers so they get the track.
      const s = await requestMic()
      if (!s) return
      stream.current = s
      pcs.current.forEach((_, id) => closePeer(id))
      attempts.current.clear()
      mutedRef.current = false
      setMuted(false)
      forceRender((n) => n + 1)
      return
    }
    const t = localTrack()
    if (!t) return
    const next = !mutedRef.current
    mutedRef.current = next
    t.enabled = !next
    setMuted(next)
  }

  const toggleDeaf = () => {
    const next = !deafRef.current
    deafRef.current = next
    audios.current.forEach((a) => (a.muted = next))
    setDeaf(next)
  }

  useEffect(() => {
    const onHide = () => {
      if (active.current) navigator.sendBeacon(url, JSON.stringify({ action: 'leave' }))
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      leave()
    }
  }, [url, leave])

  if (!member) return null

  if (status !== 'on') {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          onClick={join}
          disabled={status === 'joining'}
          title="Masanın sesli sohbetine katıl"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-60"
        >
          {status === 'joining' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Headphones className="size-4" aria-hidden="true" />}
          <span>Sesli</span>
        </button>
        {error && (
          <p role="alert" className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-border bg-popover p-2 text-xs text-destructive shadow-lg">
            {error}
          </p>
        )}
      </div>
    )
  }

  const hasMic = canSpeak && !!stream.current
  return (
    <div className={cn('relative flex items-center gap-1', className)} role="group" aria-label="Sesli sohbet">
      <button
        type="button"
        onClick={toggleMic}
        disabled={!canSpeak}
        aria-pressed={hasMic && !muted}
        aria-label={!canSpeak ? 'İzleyiciler sadece dinler' : !hasMic ? 'Mikrofon izni ver' : muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
        title={!canSpeak ? 'İzleyiciler sadece dinler' : !hasMic ? 'Mikrofon izni ver' : muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
        className={cn(
          'flex size-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          hasMic && !muted ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-muted-foreground',
        )}
      >
        {hasMic && !muted ? <Mic className="size-4" aria-hidden="true" /> : <MicOff className="size-4" aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={toggleDeaf}
        aria-pressed={deaf}
        aria-label={deaf ? 'Sesleri duy' : 'Herkesi sustur'}
        title={deaf ? 'Sesleri duy' : 'Herkesi sustur'}
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-secondary/70"
      >
        {deaf ? <HeadphoneOff className="size-4 text-muted-foreground" aria-hidden="true" /> : <Headphones className="size-4" aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={() => setListOpen((o) => !o)}
        aria-expanded={listOpen}
        aria-label="Seslidekiler"
        className="flex h-8 items-center gap-1 rounded-lg border border-border bg-secondary px-2 text-xs font-bold tabular-nums text-foreground"
      >
        <Users className="size-3.5" aria-hidden="true" />
        {peers.length + 1}
      </button>
      <button
        type="button"
        onClick={leave}
        aria-label="Sesliden çık"
        title="Sesliden çık"
        className="flex size-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
      >
        <PhoneOff className="size-4" aria-hidden="true" />
      </button>

      {(listOpen || error) && (
        <div className="absolute right-0 top-10 z-30 flex w-60 flex-col gap-2 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {listOpen && (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {canSpeak ? 'Oyuncusun, mikrofonunu açıp konuşabilirsin.' : 'İzleyicisin, oyuncuları dinleyebilirsin.'}
              </p>
              <ul className="flex flex-col gap-1.5 text-sm">
                <li className="flex items-center gap-2">
                  {hasMic && !muted ? <Mic className="size-3.5 text-primary" aria-hidden="true" /> : <MicOff className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                  <span className="truncate font-semibold">Sen</span>
                </li>
                {peers.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    {p.canSpeak && !p.muted ? <Mic className="size-3.5 text-primary" aria-hidden="true" /> : <MicOff className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {!p.canSpeak && !canSpeak ? 'izleyici' : linked.has(p.id) ? (p.canSpeak ? 'oyuncu' : 'izleyici') : 'bağlanıyor'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
