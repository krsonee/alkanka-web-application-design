import { getContent } from '@/lib/content'

export const REFERRAL_KEY = 'referral_settings'

export type ReferralSettings = {
  /** KC paid to the inviter once the friend has played `minGames` games. */
  referrer: number
  /** KC paid to the friend at the same moment. */
  referred: number
  /** KC paid to the friend immediately when the invite link is attached at sign-up. */
  welcome: number
  minGames: number
}

export const REFERRAL_DEFAULTS: ReferralSettings = { referrer: 300, referred: 150, welcome: 50, minGames: 3 }

export const REFERRAL_LIMITS = { referrer: 2000, referred: 1000, welcome: 300, minGames: 20 } as const

const clamp = (value: unknown, fallback: number, max: number, min = 0) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function normalizeReferral(raw: Partial<ReferralSettings> | null | undefined): ReferralSettings {
  return {
    referrer: clamp(raw?.referrer, REFERRAL_DEFAULTS.referrer, REFERRAL_LIMITS.referrer),
    referred: clamp(raw?.referred, REFERRAL_DEFAULTS.referred, REFERRAL_LIMITS.referred),
    welcome: clamp(raw?.welcome, REFERRAL_DEFAULTS.welcome, REFERRAL_LIMITS.welcome),
    minGames: clamp(raw?.minGames, REFERRAL_DEFAULTS.minGames, REFERRAL_LIMITS.minGames, 1),
  }
}

export async function getReferralSettings(): Promise<ReferralSettings> {
  return normalizeReferral(await getContent<Partial<ReferralSettings>>(REFERRAL_KEY).catch(() => null))
}
