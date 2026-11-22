import 'server-only'

/** `outdated` marks a read that was already running when the data changed: its result is handed out but not kept. */
type Entry = { at: number; value: unknown; loading: Promise<unknown> | null; outdated: boolean }

const scope = globalThis as typeof globalThis & { __alkankaSharedReads?: Map<string, Entry> }
const entries = (scope.__alkankaSharedReads ??= new Map<string, Entry>())
const MAX_KEYS = 500

/**
 * One answer for everyone who asks the same thing at the same moment.
 *
 * The chat feed and the lobby list are the same for every visitor, yet every open page asks for them every few
 * seconds, so a thousand visitors ran the same query a thousand times. Here the first caller runs `load`, the
 * callers that arrive while it runs wait for that one result, and the result is reused for `ttlMs`.
 *
 * Per server instance, and only for data that is identical for every caller. Never for anything a member owns
 * (balances, hands, private messages) and never on a path that decides a write.
 */
export async function sharedRead<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key)
  if (hit) {
    if (hit.loading) return hit.loading as Promise<T>
    if (Date.now() - hit.at < ttlMs) return hit.value as T
  }
  if (!hit && entries.size >= MAX_KEYS) entries.clear()

  const entry: Entry = hit ?? { at: 0, value: undefined, loading: null, outdated: false }
  entry.outdated = false
  const loading = load()
    .then((value) => {
      entry.value = value
      entry.at = entry.outdated ? 0 : Date.now()
      return value
    })
    .catch((error) => {
      // A failed read is not remembered: the next caller tries again.
      if (entries.get(key) === entry && entry.at === 0) entries.delete(key)
      throw error
    })
    .finally(() => {
      entry.loading = null
    })
  entry.loading = loading
  entries.set(key, entry)
  return loading
}

/** Drops a remembered answer after a change, so the member who made it sees it on their next read. */
export function forgetSharedRead(key: string) {
  const hit = entries.get(key)
  if (!hit) return
  if (hit.loading) hit.outdated = true
  else entries.delete(key)
}
