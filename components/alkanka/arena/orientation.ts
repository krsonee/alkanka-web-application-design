type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void }

/** Android allows locking orientation once fullscreen; iOS ignores it and relies on the rotate prompt. */
export async function goLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    await (screen.orientation as LockableOrientation).lock?.('landscape')
  } catch {}
}

/**
 * Leaving a table: lock portrait while still fullscreen (Android honours it),
 * then drop fullscreen and release the lock so the site returns upright.
 */
export async function restorePortrait() {
  const o = screen.orientation as LockableOrientation
  try {
    if (document.fullscreenElement) await o.lock?.('portrait-primary')
  } catch {}
  await new Promise((r) => setTimeout(r, 250))
  try {
    if (document.fullscreenElement) await document.exitFullscreen?.()
  } catch {}
  try {
    o.unlock?.()
  } catch {}
}
