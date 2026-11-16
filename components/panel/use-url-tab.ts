'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Keeps the open tab in the address (`?b=community&s=cekim`), so a link opens the right tab and
 * a reload stays on it. Nested tab sets pass their own `param` so they do not overwrite each other.
 */
export function useUrlTab<T extends string>(ids: readonly T[], fallback: T, param = 's'): [T, (id: T) => void] {
  const fromUrl = useSearchParams().get(param)
  const [tab, setTab] = useState<T>(() => (fromUrl && ids.includes(fromUrl as T) ? (fromUrl as T) : fallback))

  const open = useCallback(
    (id: T) => {
      setTab(id)
      const url = new URL(window.location.href)
      url.searchParams.set(param, id)
      window.history.replaceState(window.history.state, '', url)
    },
    [param],
  )

  return [tab, open]
}
