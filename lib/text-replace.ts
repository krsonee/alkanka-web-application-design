export type ReplaceRule = { from: string; to: string }

const MAX_RULES = 40
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s)
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** One rule per line: `old text => new text`. Lines without `=>` are ignored. */
export function parseReplacements(text: string): ReplaceRule[] {
  const rules: ReplaceRule[] = []
  for (const line of text.split('\n')) {
    const at = line.indexOf('=>')
    if (at < 0) continue
    const from = line.slice(0, at).trim()
    const to = line.slice(at + 2).trim()
    if (from) rules.push({ from, to })
    if (rules.length >= MAX_RULES) break
  }
  return rules
}

/** A rule whose target is a URL redirects any original link containing its left side. */
export function pickLink(url: string, rules: ReplaceRule[], fallback: string) {
  const lower = url.toLowerCase()
  return rules.find((r) => isUrl(r.to) && lower.includes(r.from.toLowerCase()))?.to ?? fallback
}

export function applyReplacements(text: string, rules: ReplaceRule[], encode: (s: string) => string = (s) => s) {
  let out = text
  const longestFirst = [...rules].sort((a, b) => b.from.length - a.from.length)
  for (const rule of longestFirst) {
    out = out.replace(new RegExp(escapeRegex(encode(rule.from)), 'giu'), () => encode(rule.to))
  }
  return out
}
