/**
 * The text of an error that may be shown on screen. A message the site writes itself is thrown as a bare
 * `Error`. A failed query, a driver fault or a bug in the code arrives as a subclass, or carries a code or
 * a cause; its text holds the query and the table names, so it goes to the server log and the screen gets
 * `fallback` instead.
 */
export function shownError(e: unknown, fallback: string, tag = '[hata]'): string {
  if (isWritten(e)) return e.message
  console.error(tag, e)
  return fallback
}

function isWritten(e: unknown): e is Error {
  return (
    e instanceof Error &&
    Object.getPrototypeOf(e) === Error.prototype &&
    e.cause === undefined &&
    !('code' in e) &&
    e.message.length > 0
  )
}
