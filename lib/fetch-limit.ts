/**
 * `fetch` that gives up when the other side has not started answering within `ms`.
 *
 * The limit covers only the wait for the response to begin. `AbortSignal.timeout` would also cut a body that
 * is still being streamed to the visitor, so a large file passed through would stop halfway.
 */
export async function fetchStartingWithin(url: string | URL, ms: number, init?: RequestInit): Promise<Response> {
  const limit = new AbortController()
  const timer = setTimeout(() => limit.abort(new Error('Kaynak zamanında cevap vermedi')), ms)
  try {
    return await fetch(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, limit.signal]) : limit.signal })
  } finally {
    clearTimeout(timer)
  }
}
