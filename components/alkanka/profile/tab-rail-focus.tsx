'use client'

import { useEffect } from 'react'

export function TabRailFocus({ railId, tabId }: { railId: string; tabId: string }) {
  useEffect(() => {
    const rail = document.getElementById(railId)
    const tab = document.getElementById(tabId)
    if (!rail || !tab || rail.scrollWidth <= rail.clientWidth) return
    const left = tab.offsetLeft - (rail.clientWidth - tab.offsetWidth) / 2
    rail.scrollTo({ left: Math.max(0, left) })
  }, [railId, tabId])
  return null
}
