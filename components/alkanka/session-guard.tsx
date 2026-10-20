'use client'

import { useEffect } from 'react'
import { authClient, useSession } from '@/lib/auth-client'

const IDLE_LIMIT_MS = 30 * 60 * 1000
const CHECK_EVERY_MS = 60 * 1000
const ACTIVITY_KEY = 'alkanka:last-activity'
const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const

function readActivity() {
  const v = Number(window.localStorage.getItem(ACTIVITY_KEY))
  return Number.isFinite(v) && v > 0 ? v : Date.now()
}

/**
 * Signs the member out after 30 minutes without interaction (shared across tabs)
 * and reloads when the session was revoked by a login on another device.
 */
export function SessionGuard() {
  const { data } = useSession()
  const userId = data?.user?.id

  useEffect(() => {
    if (!userId) return
    let lastWrite = 0
    const mark = () => {
      const now = Date.now()
      if (now - lastWrite < 15_000) return
      lastWrite = now
      window.localStorage.setItem(ACTIVITY_KEY, String(now))
    }
    window.localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
    EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }))

    let stopped = false
    const check = async () => {
      if (stopped) return
      if (Date.now() - readActivity() > IDLE_LIMIT_MS) {
        stopped = true
        await authClient.signOut().catch(() => {})
        window.location.assign('/?oturum=zaman-asimi')
        return
      }
      const res = await authClient.getSession().catch(() => null)
      if (res && !res.error && !res.data?.session) {
        stopped = true
        window.location.assign('/?oturum=baska-cihaz')
      }
    }
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      EVENTS.forEach((e) => window.removeEventListener(e, mark))
    }
  }, [userId])

  return null
}
