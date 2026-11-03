'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

type Launch = { key: string; fx: number; fy: number; rot: number; at: number }
type PlayResult = boolean | void | Promise<boolean | void>

const DRAG_START_PX = 8
const LAUNCH_TTL_MS = 6000

const buzz = (ms: number) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
}

/**
 * Lets a hand card be dragged up onto the table (tap still works) and remembers where it left the hand,
 * so the card landing on the table can fly in from that exact spot instead of a fixed point.
 * `anchorRef` is the zero-size element the played card is centred on; `offset` is the card's extra
 * design-pixel shift from that anchor once it lands.
 */
export function useCardThrow(anchorRef: RefObject<HTMLElement | null>, offset: [number, number] = [0, 0]) {
  const launch = useRef<Launch | null>(null)
  const suppressUntil = useRef(0)
  const cleanup = useRef<(() => void) | null>(null)
  const [aiming, setAiming] = useState(false)

  useEffect(() => () => cleanup.current?.(), [])

  /** Store the card's current on-screen spot as the start of its flight to the anchor. */
  const measure = useCallback(
    (el: HTMLElement, key: string) => {
      const anchor = anchorRef.current
      const host = el.parentElement
      if (!anchor || !host) return
      const scale = host.getBoundingClientRect().width / (host.offsetWidth || 1) || 1
      const r = el.getBoundingClientRect()
      const a = anchor.getBoundingClientRect()
      launch.current = {
        key,
        fx: (r.left + r.width / 2 - a.left) / scale - offset[0],
        fy: (r.top + r.height / 2 - a.top) / scale - offset[1],
        rot: Number.parseFloat(el.style.rotate || '0') || 0,
        at: Date.now(),
      }
      buzz(12)
    },
    [anchorRef, offset],
  )

  /** Inline style that makes a just-thrown card fly in from the hand. Undefined when it wasn't thrown by me. */
  const throwStyle = (key: string, extra = ''): CSSProperties | undefined => {
    const l = launch.current
    if (!l || l.key !== key || Date.now() - l.at > LAUNCH_TTL_MS) return undefined
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    return {
      '--fx': `${l.fx}px`,
      '--fy': `${l.fy}px`,
      '--fr': `${l.rot}deg`,
      animation: `card-throw 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both${extra ? `, ${extra}` : ''}`,
    } as CSSProperties
  }

  const clickBlocked = () => Date.now() < suppressUntil.current

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, key: string, play: () => PlayResult) => {
    if (e.button !== 0 || !e.isPrimary) return
    cleanup.current?.()
    const el = e.currentTarget
    const host = el.parentElement
    const scale = host ? host.getBoundingClientRect().width / (host.offsetWidth || 1) || 1 : 1
    const startH = el.getBoundingClientRect().height
    const x0 = e.clientX
    const y0 = e.clientY
    let active = false
    let aim = false

    const restore = (animate: boolean) => {
      el.style.transition = animate ? 'translate 180ms ease-out, opacity 120ms' : ''
      el.style.translate = ''
      el.style.opacity = ''
      el.style.zIndex = ''
      el.style.cursor = ''
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      const dx = ev.clientX - x0
      const dy = ev.clientY - y0
      if (!active) {
        if (Math.hypot(dx, dy) < DRAG_START_PX) return
        active = true
        el.style.transition = 'none'
        el.style.zIndex = '80'
        el.style.cursor = 'grabbing'
      }
      el.style.translate = `${dx / scale}px ${dy / scale}px`
      const next = dy < -startH * 0.55
      if (next !== aim) {
        aim = next
        setAiming(next)
        if (next) buzz(6)
      }
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      detach()
      setAiming(false)
      if (!active) return
      suppressUntil.current = Date.now() + 350
      if (!aim || ev.type === 'pointercancel') return restore(true)
      measure(el, key)
      el.style.opacity = '0'
      Promise.resolve(play()).then((ok) => {
        if (ok === false) restore(true)
      })
      // If the table never takes the card (lost connection), bring it back into the hand.
      window.setTimeout(() => el.isConnected && el.style.opacity === '0' && restore(true), 2500)
    }
    const detach = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      cleanup.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    cleanup.current = () => {
      detach()
      restore(false)
    }
  }

  return { aiming, measure, throwStyle, clickBlocked, onPointerDown }
}
