import type { PostButton } from '@/lib/tg-buttons'

export type RuleKind = 'word' | 'username' | 'link' | 'domain' | 'button'
export type ReplaceRule = { kind: RuleKind; from: string; to: string }

export const MAX_RULES = 40
/** Our own buttons plus the ones carried over from the source post. */
export const MAX_SENT_BUTTONS = 8

export const RULE_KINDS: { id: RuleKind; label: string; from: string; to: string; hint: string }[] = [
  { id: 'word', label: 'Kelime', from: 'eskimarka', to: 'Alkanka', hint: 'Yazıda geçen kelime ya da cümle değişir.' },
  { id: 'username', label: 'Kullanıcı adı', from: '@eskikanal', to: '@bizimkanal', hint: '@ ile yazılan ad ve o ada giden t.me linki değişir.' },
  { id: 'link', label: 'Link', from: 'eskisite.com/kayit', to: 'https://...', hint: 'İçinde bu parça geçen linkler yazdığın linke gider.' },
  { id: 'domain', label: 'Alan adı', from: 'eskisite.com', to: 'https://...', hint: 'Bu alan adındaki her link (alt alan adları dahil) yazdığın linke gider.' },
  { id: 'button', label: 'Buton linki', from: 'eskisite.com', to: 'https://...', hint: 'Kaynak postun butonunda bu parça geçen link değişir. Yeni linki boş bırakırsan o buton kaldırılır.' },
]

const KINDS = new Set<RuleKind>(RULE_KINDS.map((k) => k.id))
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s)
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i
const USERNAME = /^@[A-Za-z0-9_]{3,32}$/
const atName = (s: string) => (s.startsWith('@') ? s : `@${s}`)

/** Rules saved before the table existed were plain `old => new` lines; their kind is read off the two sides. */
function legacyRule(from: string, to: string): ReplaceRule {
  if (USERNAME.test(from) && USERNAME.test(to)) return { kind: 'username', from, to }
  if (isUrl(to)) return { kind: DOMAIN.test(from) ? 'domain' : 'link', from, to }
  return { kind: 'word', from, to }
}

function toRule(item: unknown): ReplaceRule | null {
  if (!item || typeof item !== 'object') return null
  const r = item as Record<string, unknown>
  const kind = KINDS.has(r.kind as RuleKind) ? (r.kind as RuleKind) : 'word'
  let from = String(r.from ?? '').trim().slice(0, 200)
  let to = String(r.to ?? '').trim().slice(0, 400)
  if (!from) return null
  if (kind === 'username') {
    from = atName(from)
    to = atName(to)
    if (!USERNAME.test(from) || !USERNAME.test(to)) return null
  }
  if ((kind === 'link' || kind === 'domain') && !isUrl(to)) return null
  if (kind === 'button' && to && !isUrl(to)) return null
  return { kind, from, to }
}

/** Reads the stored rules: the table's JSON, or the older one-rule-per-line text. */
export function parseReplacements(text: string): ReplaceRule[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const list: unknown = JSON.parse(trimmed)
      return Array.isArray(list) ? list.map(toRule).filter((r): r is ReplaceRule => r !== null).slice(0, MAX_RULES) : []
    } catch {
      return []
    }
  }
  const rules: ReplaceRule[] = []
  for (const line of trimmed.split('\n')) {
    const at = line.indexOf('=>')
    if (at < 0) continue
    const from = line.slice(0, at).trim()
    const to = line.slice(at + 2).trim()
    if (from) rules.push(legacyRule(from, to))
    if (rules.length >= MAX_RULES) break
  }
  return rules
}

export const serializeRules = (rules: ReplaceRule[]) => (rules.length ? JSON.stringify(rules.slice(0, MAX_RULES)) : '')

/** Why a row can't be saved, so the form says it instead of dropping the rule silently. */
export function ruleError(input: unknown): string | null {
  let list: unknown = input
  if (typeof input === 'string') {
    if (!input.trim().startsWith('[')) return null
    try {
      list = JSON.parse(input)
    } catch {
      return 'Kurallar okunamadı, sayfayı yenileyip tekrar dene'
    }
  }
  if (!Array.isArray(list)) return null
  if (list.length > MAX_RULES) return `En fazla ${MAX_RULES} kural eklenebilir`
  for (const [i, item] of list.entries()) {
    const r = (item ?? {}) as Record<string, unknown>
    const from = String(r.from ?? '').trim()
    const to = String(r.to ?? '').trim()
    if (!from && !to) continue
    const no = `${i + 1}. kural`
    if (!from) return `${no}: aranacak kısım boş`
    if (r.kind === 'username' && (!USERNAME.test(atName(from)) || !USERNAME.test(atName(to)))) return `${no}: kullanıcı adı @ad şeklinde olmalı (harf, rakam, alt çizgi)`
    if ((r.kind === 'link' || r.kind === 'domain') && !isUrl(to)) return `${no}: yeni link http:// ya da https:// ile başlamalı`
    if (r.kind === 'button' && to && !isUrl(to)) return `${no}: yeni link http:// ya da https:// ile başlamalı (butonu kaldırmak için boş bırak)`
  }
  return null
}

/** Later lists never override an earlier rule for the same thing, so a source's own rule wins over a shared one. */
export function mergeRules(...lists: ReplaceRule[][]): ReplaceRule[] {
  const seen = new Set<string>()
  const out: ReplaceRule[] = []
  for (const rule of lists.flat()) {
    const key = `${rule.kind}:${rule.from.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(rule)
  }
  return out
}

const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function onDomain(url: string, domain: string) {
  const host = hostOf(url)
  const wanted = hostOf(domain)
  return Boolean(host && wanted) && (host === wanted || host.endsWith(`.${wanted}`))
}

const TME = /^(?:https?:\/\/)?(?:t|telegram)\.me\/([A-Za-z0-9_]{3,32})\/?(?:[?#].*)?$/i

const usernameRule = (name: string, rules: ReplaceRule[]) =>
  rules.find((r) => r.kind === 'username' && r.from.slice(1).toLowerCase() === name.toLowerCase())

/** A t.me link to a renamed channel follows the username rule; any other t.me link has no answer here. */
export function usernameLink(url: string, rules: ReplaceRule[]): string | null {
  const name = url.trim().match(TME)?.[1]
  const rule = name ? usernameRule(name, rules) : undefined
  return rule ? `https://t.me/${rule.to.slice(1)}` : null
}

/** Where a link of the source post points after the rules. The first matching rule wins. */
export function pickLink(url: string, rules: ReplaceRule[], fallback: string) {
  const lower = url.toLowerCase()
  for (const rule of rules) {
    if (rule.kind === 'link' && lower.includes(rule.from.toLowerCase())) return rule.to
    if (rule.kind === 'domain' && onDomain(url, rule.from)) return rule.to
  }
  return usernameLink(url, rules) ?? fallback
}

/** Link for a button carried over from the source post. Null removes the button. */
export function buttonLink(url: string, rules: ReplaceRule[], fallback: string): string | null {
  const lower = url.toLowerCase()
  const own = rules.find((r) => r.kind === 'button' && lower.includes(r.from.toLowerCase()))
  return own ? own.to || null : pickLink(url, rules, fallback)
}

/** The source post's own buttons with their links and labels passed through the rules. */
export function carriedButtons(buttons: PostButton[], rules: ReplaceRule[], fallback: string): PostButton[] {
  return buttons.flatMap((button) => {
    const url = buttonLink(button.url, rules, fallback)
    const text = applyReplacements(button.text, rules).trim().slice(0, 40)
    return url && text ? [{ text, url }] : []
  })
}

export function applyReplacements(text: string, rules: ReplaceRule[], encode: (s: string) => string = (s) => s) {
  let out = text
  const longestFirst = rules.filter((r) => r.kind !== 'button').sort((a, b) => b.from.length - a.from.length)
  for (const rule of longestFirst) {
    // "@kanal" must not also rewrite the start of "@kanal_destek".
    const tail = rule.kind === 'username' ? '(?![A-Za-z0-9_])' : ''
    out = out.replace(new RegExp(escapeRegex(encode(rule.from)) + tail, 'giu'), () => encode(rule.to))
  }
  return out
}

/**
 * Plain-text rewrite. The special odds bot sends exactly this; for the post mirror it is the panel's
 * preview of what its HTML rewrite does. `odds` points every leftover Telegram link at the main link and
 * drops leftover @names; `mirror` drops leftover Telegram links and leaves @names alone.
 */
export function rewritePlain(text: string, rules: ReplaceRule[], mainLink: string, mode: 'odds' | 'mirror' = 'odds') {
  const telegram = (url: string) => usernameLink(url, rules) ?? (mode === 'odds' ? mainLink : '')
  const replaced = text
    .replace(/https?:\/\/\S+/gi, (url) => (mode === 'mirror' && TME.test(url) ? telegram(url) : pickLink(url, rules, mainLink)))
    .replace(/(^|\s)((?:t|telegram)\.me\/\S+)/gi, (_, lead: string, url: string) => `${lead}${telegram(url)}`)
    .replace(/(^|\s)@([A-Za-z0-9_]{4,})/g, (whole, lead: string, name: string) => {
      const rule = usernameRule(name, rules)
      if (rule) return `${lead}${rule.to}`
      return mode === 'odds' ? lead : whole
    })
  return applyReplacements(replaced, rules)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
