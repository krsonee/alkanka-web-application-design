/** Items stored as site content (not in their own table) are hidden through this one list. */
export const HIDDEN_KEY = 'site:hidden'

export const HIDDEN_SCOPES = ['slide', 'mini', 'event', 'prediction', 'campaign', 'bonus', 'tournament'] as const
export type HiddenScope = (typeof HIDDEN_SCOPES)[number]
export type HiddenMap = Partial<Record<HiddenScope, string[]>>

export function readHidden(raw: unknown): HiddenMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: HiddenMap = {}
  for (const scope of HIDDEN_SCOPES) {
    const list = (raw as Record<string, unknown>)[scope]
    if (Array.isArray(list)) out[scope] = [...new Set(list.map(String))].slice(0, 500)
  }
  return out
}

export function isHidden(map: HiddenMap, scope: HiddenScope, id: string | number) {
  return map[scope]?.includes(String(id)) ?? false
}

export function withoutHidden<T extends { id: string | number }>(items: T[], map: HiddenMap, scope: HiddenScope) {
  const set = new Set(map[scope] ?? [])
  return set.size ? items.filter((item) => !set.has(String(item.id))) : items
}
