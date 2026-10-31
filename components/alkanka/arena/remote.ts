export type RemoteAction = { type: string; [k: string]: unknown }

export type Remote<S> = {
  id?: string
  seat: number
  state: S
  version: number
  myTurn: boolean
  busy: boolean
  names: string[]
  /** Member id per seat; null for bots or empty seats. */
  userIds?: (string | null)[]
  spectator?: boolean
  send: (action: RemoteAction) => Promise<boolean>
}
