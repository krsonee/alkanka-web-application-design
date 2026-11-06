'use client'

import { useEffect, useRef } from 'react'
import { RotatePrompt, useMedia } from './controls'

type Score = { for: number; against: number }
type GameMessage = { source: 'alk-kafa'; type: 'ready' | 'screen' | 'score' | 'end' | 'exit' | 'quit' | 'rematch'; for?: number; against?: number }

const GAME_SRC = '/games/kafa-topu/index.html'
const MOBILE_QUERY = '(pointer: coarse), (max-width: 640px), (max-height: 500px)'

/**
 * Solo football runs the standalone Kafa Topu v2 build as-is in a same-origin iframe.
 * The page posts goals and the final score; this wrapper only reports them to the stake flow.
 */
export function KafaTopuFrame({ onEnd, onRematch }: { onEnd: (score: Score) => void; onRematch?: (score: Score) => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const score = useRef<Score>({ for: 0, against: 0 })
  const reported = useRef(false)
  const endRef = useRef(onEnd)
  endRef.current = onEnd
  const rematchRef = useRef(onRematch)
  rematchRef.current = onRematch

  const touch = useMedia(MOBILE_QUERY)
  const portrait = useMedia('(orientation: portrait)')
  const needRotate = touch && portrait

  useEffect(() => {
    const send = (type: 'start' | 'pause') =>
      frame.current?.contentWindow?.postMessage({ source: 'alk-host', type }, window.location.origin)
    const finish = (s: Score) => {
      if (reported.current) return
      reported.current = true
      endRef.current(s)
    }
    const onMessage = (e: MessageEvent<GameMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      const msg = e.data
      if (!msg || msg.source !== 'alk-kafa') return
      const s = { for: Number(msg.for) || 0, against: Number(msg.against) || 0 }
      if (msg.type === 'score' || msg.type === 'end') score.current = s
      if (msg.type === 'quit') finish(s)
      if (msg.type === 'exit') finish(score.current)
      if (msg.type === 'rematch') {
        const again = rematchRef.current
        if (again && !reported.current) {
          reported.current = true
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
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[70] bg-background">
      <iframe
        ref={frame}
        src={GAME_SRC}
        title="Alkanka Kafa Topu"
        allow="autoplay; fullscreen"
        className="block size-full border-0"
      />
      {needRotate && <RotatePrompt sport="futbol" paused={false} />}
    </div>
  )
}
