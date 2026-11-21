'use client'

import { useCallback, useEffect, useState } from 'react'
import { fromAddress } from '@/lib/record-links'

/** Writes one word into the address in place, or takes it out. */
export function writeAddress(param: string, word: string | null) {
  const url = new URL(window.location.href)
  if (word) url.searchParams.set(param, word)
  else url.searchParams.delete(param)
  window.history.replaceState(window.history.state, '', url)
}

export const readAddress = (param: string) => new URLSearchParams(window.location.search).get(param) ?? undefined

/**
 * Keeps a tab or filter in the address (`?donem=haftalik`), so the address a visitor copies opens the same view.
 * The page is first drawn with `fallback` (a cached page cannot know the address it is opened with) and the word
 * in the address is applied right after. Choosing `fallback` leaves the address clean, unless `always` is set:
 * that is for a default which differs from one visit to the next.
 */
export function useAddressChoice<T extends string>(param: string, words: Record<T, string>, fallback: NoInfer<T>, always = false): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback)

  useEffect(() => {
    const asked = fromAddress(words, readAddress(param))
    if (asked) setValue(asked)
  }, [param, words])

  const choose = useCallback(
    (next: T) => {
      setValue(next)
      writeAddress(param, next === fallback && !always ? null : words[next])
    },
    [param, words, fallback, always],
  )

  return [value, choose]
}
