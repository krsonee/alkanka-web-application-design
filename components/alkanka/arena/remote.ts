export type RemoteAction = { type: string; [k: string]: unknown }

export type Remote<S> = {
  id?: string
  seat: number
  state: S
  version: number
  myTurn: boolean
  busy: boolean
  /** The player's own move that is on its way to the server, so the table can show it leaving the hand at once. */
  pending?: RemoteAction | null
  names: string[]
  /** Member id per seat; null for bots or empty seats. */
  userIds?: (string | null)[]
  spectator?: boolean
  /** What one seat staked, so a replay button can say what it costs. */
  stake?: number
  /** When the server's move timer for the current actor started; only set while that timer is enforced. */
  turnStartedAt?: string
  turnSeconds?: number
  send: (action: RemoteAction) => Promise<boolean>
  /** Opens a fresh table with the same settings once this one has ended. */
  replay?: () => Promise<void>
}
