'use server'

import { rows, sql } from '@/lib/db'
import { mailEnabled } from '@/lib/mail'
import { getHub } from '@/lib/tg-hub'

export type PasswordHelp = {
  /** True when the site can send the reset link by e-mail. */
  mail: boolean
  /** User name of the support bot that renews passwords, when it is switched on. */
  bot: string | null
}

/** Tells the "forgot my password" window which way a member can renew a password right now. */
export async function passwordHelp(): Promise<PasswordHelp> {
  if (mailEnabled) return { mail: true, bot: null }
  try {
    const hub = await getHub()
    if (!hub.support.enabled || !hub.supportBotId) return { mail: false, bot: null }
    const [bot] = await rows<{ username: string | null }>(sql`SELECT username FROM tg_bots WHERE id = ${hub.supportBotId}`)
    return { mail: false, bot: bot?.username?.replace(/^@/, '') || null }
  } catch {
    return { mail: false, bot: null }
  }
}
