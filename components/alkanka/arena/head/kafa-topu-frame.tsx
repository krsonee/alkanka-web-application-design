'use client'

import { useEffect, useRef, useState } from 'react'
import { RotatePrompt, useMedia } from './controls'
import type { DuelLink } from '../duel-link'

type Score = { for: number; against: number }
type GameMessage = {
  source: 'alk-kafa'
  type: 'ready' | 'screen' | 'score' | 'end' | 'exit' | 'quit' | 'rematch' | 'net'
  for?: number
  against?: number
  msg?: unknown
}
type Online = { role: 'host' | 'guest'; link: DuelLink; names: [string, string] }

const GAME = {
  futbol: { src: '/games/kafa-topu/index.html', title: 'Alkanka Kafa Topu' },
  basket: { src: '/games/kafa-basketbolu/index.html', title: 'Alkanka Kafa Basketbolu' },
} as const
const MOBILE_QUERY = '(pointer: coarse), (max-width: 640px), (max-height: 500px)'

const TRANSPORT_LABEL = { direct: 'Doğrudan', turn: 'Hızlı röle', server: 'Sunucu' } as const

function LinkBadge({ link }: { link: DuelLink }) {
  const slow = link.transport === 'server'
  return (
    <div
      role="status"
      className={`pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 font-mono text-[10px] leading-4 ${
        slow ? 'bg-destructive text-destructive-foreground' : 'bg-foreground/60 text-background'
      }`}
    >
      {TRANSPORT_LABEL[link.transport]}
      {link.rtt != null ? ` · ${link.rtt} ms` : ''}
    </div>
  )
}

/**
 * Football runs the standalone Kafa Topu v2 build as-is in a same-origin iframe, solo and online.
 * The page posts goals and the final score; this wrapper reports them to the stake flow and,
 * in duels, relays the game's network messages over the peer link.
 */
export function KafaTopuFrame({
  onEnd,
  onRematch,
  online,
  sport = 'futbol',
}: {
  sport?: keyof typeof GAME
  onEnd: (score: Score) => void
  onRematch?: (score: Score) => void
  online?: Online
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const score = useRef<Score>({ for: 0, against: 0 })
  const reported = useRef(false)
  const ended = useRef(false)
  const endRef = useRef(onEnd)
  endRef.current = onEnd
  const rematchRef = useRef(onRematch)
  rematchRef.current = onRematch
  const onlineRef = useRef(online)
  onlineRef.current = online

  const [closed, setClosed] = useState(false)
  const touch = useMedia(MOBILE_QUERY)
  const portrait = useMedia('(orientation: portrait)')
  const needRotate = touch && portrait
  const linkStatus = online?.link.status

  useEffect(() => {
    if (!online) return
    online.link.onMessage.current = (msg) =>
      frame.current?.contentWindow?.postMessage({ source: 'alk-host', type: 'net', msg }, window.location.origin)
  })

  useEffect(() => {
    if (linkStatus) frame.current?.contentWindow?.postMessage({ source: 'alk-host', type: 'link', status: linkStatus }, window.location.origin)
  }, [linkStatus])

  useEffect(() => {
    const post = (data: Record<string, unknown>) =>
      frame.current?.contentWindow?.postMessage({ source: 'alk-host', ...data }, window.location.origin)
    const send = (type: 'start' | 'pause') => post({ type })
    const finish = (s: Score) => {
      // Close the full-screen game right away; the score round-trip to the server must never keep the player stuck inside it.
      setClosed(true)
      if (reported.current) return
      reported.current = true
      endRef.current(s)
    }
    const onMessage = (e: MessageEvent<GameMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      const msg = e.data
      if (!msg || msg.source !== 'alk-kafa') return
      const net = onlineRef.current
      if (msg.type === 'net') {
        net?.link.send(msg.msg)
        return
      }
      if (msg.type === 'ready' && net) {
        post({ type: 'init', role: net.role, names: net.names })
        post({ type: 'link', status: net.link.status })
      }
      const s = { for: Number(msg.for) || 0, against: Number(msg.against) || 0 }
      if (msg.type === 'score' || msg.type === 'end') score.current = s
      if (msg.type === 'end') ended.current = true
      // Leaving before the final whistle is a forfeit, never a refunded draw.
      if (msg.type === 'quit') finish(ended.current ? s : { for: s.for, against: Math.max(s.against, s.for + 1) })
      if (msg.type === 'exit') finish(score.current)
      if (msg.type === 'rematch') {
        const again = rematchRef.current
        if (again && !reported.current) {
          reported.current = true
          setClosed(true)
          again(score.current)
        } else if (!again) {
          score.current = { for: 0, against: 0 }
          send('start')
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (needRotate) frame.current?.contentWindow?.postMessage({ source: 'alk-host', type: 'pause' }, window.location.origin)
  }, [needRotate])

  // The game owns the window: no page scroll or pull-to-refresh behind it.
  useEffect(() => {
    if (closed) return
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prev
    }
  }, [closed])

  if (closed) return <p className="py-8 text-center text-sm text-muted-foreground">Sonuç kaydediliyor...</p>

  return (
    <div className="fixed inset-0 z-[70] bg-background">
      <iframe
        ref={frame}
        src={GAME[sport].src}
        title={GAME[sport].title}
        allow="autoplay; fullscreen"
        className="block size-full border-0"
      />
      {online && online.link.status === 'open' && <LinkBadge link={online.link} />}
      {needRotate && <RotatePrompt sport={sport} paused={false} />}
    </div>
  )
}
