'use client'

import { useSyncExternalStore } from 'react'

const IDLE_AFTER_MS = 2 * 60 * 1000
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

let idle = false
let timer: number | undefined
let lastMove = 0
const listeners = new Set<() => void>()

function setIdle(next: boolean) {
  if (idle === next) return
  idle = next
  listeners.forEach((l) => l())
}

function arm() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => setIdle(true), IDLE_AFTER_MS)
}

function onActivity() {
  const now = Date.now()
  if (!idle && now - lastMove < 1000) return
  lastMove = now
  setIdle(false)
  arm()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    arm()
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      window.clearTimeout(timer)
      idle = false
    }
  }
}

/** True after 2 minutes without any mouse, touch, scroll or keyboard activity. Used to slow down polling. */
export function useIdle() {
  return useSyncExternalStore(subscribe, () => idle, () => false)
}
