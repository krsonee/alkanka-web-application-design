'use client'

import { useEffect, useEffectEvent } from 'react'

/**
 * Listens for "this table changed" pushes so a rival's move shows up at once instead of on the next poll.
 * `onChange` gets the table version the push was sent for, or 0 when the sender did not know it.
 * Polling keeps running underneath, so a refused or dropped stream costs nothing but the speed-up.
 */
export function useTableEvents(id: string, enabled: boolean, onChange: (version: number) => void) {
  const changed = useEffectEvent(onChange)

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return
    const source = new EventSource(`/api/tables/${id}/events`)
    source.onmessage = (e) => changed(Number(e.data) || 0)
    // EventSource retries a dropped stream by itself; a refused one (4xx/5xx) stays closed and polling carries on.
    return () => source.close()
  }, [id, enabled])
}
