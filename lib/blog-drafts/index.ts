import { PREPARED_NEW } from './new-posts'
import type { PreparedPost, PreparedRow, PreparedUpdate } from './types'
import { PREPARED_UPDATES } from './updates'

export type { PreparedPost, PreparedRow, PreparedState } from './types'

/** Guide texts written ahead of time. Nothing here reaches the site until someone presses the button in the panel. */
export const PREPARED_POSTS: PreparedPost[] = [...PREPARED_UPDATES, ...PREPARED_NEW]

const countWords = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

/** The body with the prepared sections placed above the `before` heading, or at the end when that heading is gone. */
export function withSections(raw: string, update: PreparedUpdate) {
  // Posts saved from the panel form carry CRLF line ends; mixing the two styles would break the blank-line split.
  const body = raw.replace(/\r\n?/g, '\n')
  const at = body.indexOf(update.before)
  if (at === -1) return `${body.trimEnd()}\n\n${update.sections}`
  return `${body.slice(0, at).trimEnd()}\n\n${update.sections}\n\n${body.slice(at)}`
}

type Existing = { slug: string; body: string }

export function preparedRows(existing: Existing[]): PreparedRow[] {
  const bySlug = new Map(existing.map((p) => [p.slug, p]))
  return PREPARED_POSTS.map((p) => {
    const post = bySlug.get(p.slug)
    if (p.kind === 'new') {
      return { slug: p.slug, kind: p.kind, title: p.title, note: p.excerpt, words: countWords(p.body), state: post ? 'eklendi' : 'hazir' }
    }
    const state = !post ? 'yazi-yok' : post.body.includes(p.marker) ? 'eklendi' : 'hazir'
    return { slug: p.slug, kind: p.kind, title: p.title, note: p.note, words: countWords(p.sections), state }
  })
}
