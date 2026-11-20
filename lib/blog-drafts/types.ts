/** A full guide post written ahead of time; the panel adds it as an unpublished draft. */
export type PreparedNew = {
  kind: 'new'
  slug: string
  title: string
  excerpt: string
  keywords: string
  cover: string
  body: string
}

/** Extra sections for a post that is already live; they go in right above the `before` heading. */
export type PreparedUpdate = {
  kind: 'update'
  slug: string
  title: string
  note: string
  before: string
  /** First heading of the added text: its presence in the body means the update is already in. */
  marker: string
  sections: string
}

export type PreparedPost = PreparedNew | PreparedUpdate

export type PreparedState = 'hazir' | 'eklendi' | 'yazi-yok'

export type PreparedRow = {
  slug: string
  kind: PreparedPost['kind']
  title: string
  note: string
  words: number
  state: PreparedState
}
