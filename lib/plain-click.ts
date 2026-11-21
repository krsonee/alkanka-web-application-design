import type { MouseEvent } from 'react'

/** A plain left click, the one a link may answer in place; a new tab or a new window is left to the browser. */
export const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
