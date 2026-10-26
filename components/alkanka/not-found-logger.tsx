'use client'

import { useEffect } from 'react'

/**
 * Client-only on purpose: Next renders server components inside not-found.tsx eagerly on every
 * request, so a server-side logger recorded healthy 200 pages as 404s. This only mounts when the
 * not-found UI is actually shown.
 */
export function NotFoundLogger() {
  useEffect(() => {
    const body = JSON.stringify({ path: window.location.pathname, referrer: document.referrer })
    if (!navigator.sendBeacon?.('/api/seo/404', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/seo/404', { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  }, [])
  return null
}
