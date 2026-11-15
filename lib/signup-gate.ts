import 'server-only'
import { getContent, setContent } from '@/lib/content'
import { rows, sql } from '@/lib/db'

export const SIGNUP_GATE_KEY = 'auth:signup'
export const SIGNUP_CLOSED_MESSAGE = 'Yeni üyelik şu an kapalı. Açıldığında Telegram kanalımızda duyuracağız.'

type StoredGate = { closed?: boolean; openedAt?: string | null; openUntil?: string | null; slots?: number | null }

export type SignupGate = { closed: boolean; openUntil: string | null; slots: number | null; used: number }

const CLOSED: SignupGate = { closed: true, openUntil: null, slots: null, used: 0 }
const OPEN: SignupGate = { closed: false, openUntil: null, slots: null, used: 0 }

/**
 * Registration stays open unless the `auth:signup` row in `site_content` says `{ "closed": true }`.
 * A timed window (`openUntil`, optionally `slots`) closes itself when the time or the sign-up count runs out.
 */
export async function getSignupGate(): Promise<SignupGate> {
  const gate = await getContent<StoredGate>(SIGNUP_GATE_KEY)
  if (!gate) return OPEN
  if (gate.closed === true) return CLOSED
  if (!gate.openUntil) return OPEN
  const until = Date.parse(gate.openUntil)
  if (Number.isNaN(until) || Date.now() >= until) return CLOSED
  const slots = gate.slots && gate.slots > 0 ? Math.floor(gate.slots) : null
  if (!slots || !gate.openedAt) return { closed: false, openUntil: gate.openUntil, slots: null, used: 0 }
  try {
    const [r] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM public."user" WHERE "createdAt" >= ${gate.openedAt}::timestamptz`)
    const used = Number(r?.n ?? 0)
    return { closed: used >= slots, openUntil: gate.openUntil, slots, used }
  } catch (error) {
    console.error('[signup-gate] kayıt sayısı okunamadı', error)
    return CLOSED
  }
}

export async function isSignupClosed() {
  return (await getSignupGate()).closed
}

/** Opens registration for `hours` (0 = until closed by hand); with `slots` it also closes after that many sign-ups. */
export async function openSignup(hours: number, slots: number | null) {
  const h = Math.min(72, Math.max(0, Math.floor(Number(hours) || 0)))
  if (h === 0) return setContent(SIGNUP_GATE_KEY, { closed: false })
  const now = Date.now()
  const cap = slots && slots > 0 ? Math.min(1000, Math.floor(slots)) : null
  await setContent(SIGNUP_GATE_KEY, {
    closed: false,
    openedAt: new Date(now).toISOString(),
    openUntil: new Date(now + h * 3_600_000).toISOString(),
    slots: cap,
  })
}

export async function closeSignup() {
  await setContent(SIGNUP_GATE_KEY, { closed: true })
}
