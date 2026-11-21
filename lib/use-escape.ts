'use client'

import { useEffect, useRef } from 'react'

/** Closes a hand-built overlay on Escape, the way a native dialog already does. */
export function useEscape(active: boolean, onEscape: () => void) {
  const latest = useRef(onEscape)
  useEffect(() => {
    latest.current = onEscape
  })
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
