export function trackPromo(k: 'slide' | 'ad', r: string, e: 'view' | 'click') {
  if (typeof window === 'undefined') return
  if (e === 'view') {
    const key = `promo:${k}:${r}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
  }
  const body = JSON.stringify({ k, r, e })
  try {
    if (navigator.sendBeacon?.('/api/promo', new Blob([body], { type: 'application/json' }))) return
  } catch {}
  fetch('/api/promo', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
}
