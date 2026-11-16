'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { TELEGRAM_URL } from './data'

const TelegramAddressContext = createContext(TELEGRAM_URL)

/** Carries the current channel address the panel has set, so no component keeps a copy of its own. */
export function TelegramAddressProvider({ url, children }: { url: string; children: ReactNode }) {
  return <TelegramAddressContext.Provider value={url}>{children}</TelegramAddressContext.Provider>
}

export function useTelegramUrl() {
  return useContext(TelegramAddressContext)
}
