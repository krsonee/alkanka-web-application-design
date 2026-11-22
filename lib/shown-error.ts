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

/**
 * The same for panel staff: they get the database's own one-line reason (which column, which rule) so the
 * fault can be reported as it is, but never the query text and its values.
 */
export function staffError(e: unknown, fallback: string, tag = '[panel]'): string {
  if (isWritten(e)) return e.message
  console.error(tag, e)
  const reason = rootMessage(e)
  return reason ? `${fallback} Veritabanının verdiği sebep: ${reason}` : fallback
}

function rootMessage(e: unknown): string {
  let at: unknown = e
  for (let depth = 0; depth < 5 && at instanceof Error && at.cause instanceof Error; depth++) at = at.cause
  if (at === e || !(at instanceof Error)) return ''
  return at.message.replace(/\s+/g, ' ').trim().slice(0, 240)
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
