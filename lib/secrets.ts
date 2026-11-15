import 'server-only'

/**
 * Newest first. `BETTER_AUTH_SECRETS` ("<version>:<secret>,...", the format Better Auth rotates with) holds the
 * current secret. `BETTER_AUTH_SECRET` is the one the site launched with and stays last, so anything sealed
 * before a rotation still opens. Without `BETTER_AUTH_SECRETS` the original is the only secret.
 */
export function appSecrets(): string[] {
  const rotated = (process.env.BETTER_AUTH_SECRETS ?? '')
    .split(',')
    .map((entry) => entry.slice(entry.indexOf(':') + 1).trim())
    .filter(Boolean)
  const original = process.env.BETTER_AUTH_SECRET
  return [...new Set(original ? [...rotated, original] : rotated)]
}

export const currentSecret = () => appSecrets()[0] ?? null

/** Runs `open` with the current key first, then the older ones. */
export function openWithAny<T>(keys: Buffer[], open: (key: Buffer) => T): T {
  let failure: unknown
  for (const key of keys) {
    try {
      return open(key)
    } catch (error) {
      failure ??= error
    }
  }
  throw failure ?? new Error('Şifreleme anahtarı yok (BETTER_AUTH_SECRET).')
}
