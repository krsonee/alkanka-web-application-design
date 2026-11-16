import 'server-only'
import { canPanel, canPanelAny, canTelegram, getPanelSession, isPanelOwner } from '@/lib/panel-auth'

export { canPanel, canPanelAny, canTelegram, getPanelSession, isPanelOwner }

export async function isAdmin() {
  return Boolean(await getPanelSession())
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD || process.env.BETTER_AUTH_SECRET)
}
