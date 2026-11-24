'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const AWAY_MS = 15_000
const CHECK_GAP_MS = 2 * 60_000
const RELOADED_KEY = 'alk_build_reloaded'

// The menu sheet stays in the page while closed (laid out but invisible), so being in the document is not being open.
function onScreen(selector: string) {
  for (const el of document.querySelectorAll(selector)) {
    if (el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden') return true
  }
  return false
}

/** A reload now would cost the visitor something: a table in play, an open window, music, a half-written message. */
function midSomething() {
  if (location.pathname.startsWith('/kankatv')) return true
  if (document.querySelector('[data-game-page], [data-table-playing], [data-tv-dock]')) return true
  if (onScreen('[role="dialog"], [aria-modal="true"]')) return true
  for (const media of document.querySelectorAll<HTMLMediaElement>('audio, video')) if (!media.paused) return true
  for (const field of document.querySelectorAll('textarea')) if (field.value.trim()) return true
  const active = document.activeElement
  return active instanceof HTMLInputElement && active.value.trim() !== ''
}

/**
 * The installed app stays open in the background for days, and Vercel keeps an open page on the build it started with
 * for hours. So a page left open would keep showing the old site after a publish. On coming back to the app this asks
 * which build is live and reloads once if it is a newer one, at a moment when nothing is in progress.
 */
export function FreshBuild({ build }: { build: string }) {
  const pathname = usePathname()
  const applyRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!build) return
    let alive = true
    let newer: string | null = null
    let hiddenAt = 0
    let checkedAt = Date.now()

    const apply = () => {
      if (!newer || midSomething()) return
      try {
        // One reload per build: if the page still comes back old, stop instead of looping.
        if (sessionStorage.getItem(RELOADED_KEY) === newer) return
        sessionStorage.setItem(RELOADED_KEY, newer)
      } catch {
        return
      }
      location.reload()
    }
    applyRef.current = apply

    const look = async () => {
      checkedAt = Date.now()
      try {
        const res = await fetch('/api/surum', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (!res.ok) return
        const live: unknown = (await res.json()).build
        if (!alive || typeof live !== 'string' || !live || live === build) return
        newer = live
        apply()
      } catch {}
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (newer) return apply()
      const now = Date.now()
      if (hiddenAt && now - hiddenAt >= AWAY_MS && now - checkedAt >= CHECK_GAP_MS) look()
    }
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) look()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onShow)
    return () => {
      alive = false
      applyRef.current = () => {}
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onShow)
    }
  }, [build])

  // Leaving a table or closing a window is the next quiet moment for a reload that had to wait.
  useEffect(() => {
    applyRef.current()
  }, [pathname])

  return null
}
