export type RemoteAction = { type: string; [k: string]: unknown }

export type Remote<S> = {
  id?: string
  seat: number
  state: S
  version: number
  myTurn: boolean
  busy: boolean
  names: [string, string]
  send: (action: RemoteAction) => Promise<boolean>
}
