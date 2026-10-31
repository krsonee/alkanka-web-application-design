'use client'

import { useEffect, useRef } from 'react'
import { playSound } from '@/lib/sound'

/**
 * Soft chime when the turn passes to the player. If the tab is in the background the title blinks
 * and the phone gives a short buzz too, so someone looking at another screen notices it.
 */
export function useTurnAlert(myTurn: boolean) {
  const was = useRef(myTurn)
  useEffect(() => {
    const started = myTurn && !was.current
    was.current = myTurn
    if (!started) return
    playSound('yourTurn')
    if (!document.hidden) return
    navigator.vibrate?.(120)
    const original = document.title
    let on = false
    const timer = setInterval(() => {
      on = !on
      document.title = on ? 'Sıra sende!' : original
    }, 1000)
    const stop = () => {
      if (document.hidden) return
      clearInterval(timer)
      document.title = original
    }
    document.addEventListener('visibilitychange', stop)
    return () => {
      clearInterval(timer)
      document.title = original
      document.removeEventListener('visibilitychange', stop)
    }
  }, [myTurn])
}
