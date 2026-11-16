import { NextResponse } from 'next/server'

/**
 * The panel cookie is SameSite=None so the panel works inside an embedded preview, which means
 * the browser also attaches it to requests another site makes. Server actions are checked by
 * Next itself; route handlers that spend money or write files have to check on their own.
 */
export function isCrossSite(request: Request) {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site !== 'same-origin' && site !== 'none'
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export function rejectCrossSite(request: Request) {
  return isCrossSite(request) ? NextResponse.json({ error: 'Bu istek panelin dışından geldi, kabul edilmedi.' }, { status: 403 }) : null
}
