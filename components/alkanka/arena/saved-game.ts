'use client'

import { useEffect } from 'react'

const PREFIX = 'alk-arena-save:'

export function loadSaved<T>(key?: string): T | null {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeSaved(key: string | undefined, value: unknown) {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {}
}

export function clearSaved(key?: string) {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {}
}

/** Snapshots a bot game's state on every change so a page refresh restores the exact position. Pass `null` to skip a frame. */
export function useSaveGame(key: string | undefined, value: unknown) {
  const json = value == null ? null : JSON.stringify(value)
  useEffect(() => {
    if (!key || json == null) return
    try {
      window.localStorage.setItem(PREFIX + key, json)
    } catch {}
  }, [key, json])
}

const MODE_PREFIX = 'alk-arena-mode:'

export function loadMode(game: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(MODE_PREFIX + game)
  } catch {
    return null
  }
}

export function saveMode(game: string, mode: string) {
  try {
    window.localStorage.setItem(MODE_PREFIX + game, mode)
  } catch {}
}
