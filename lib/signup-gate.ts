import 'server-only'
import { getContent } from '@/lib/content'

export const SIGNUP_GATE_KEY = 'auth:signup'
export const SIGNUP_CLOSED_MESSAGE = 'Yeni üyelik şu an kapalı. Açıldığında Telegram kanalımızda duyuracağız.'

/** Registration stays open unless the `auth:signup` row in `site_content` says `{ "closed": true }`. */
export async function isSignupClosed() {
  const gate = await getContent<{ closed?: boolean }>(SIGNUP_GATE_KEY)
  return gate?.closed === true
}
