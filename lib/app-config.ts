export const APP_BONUS = 500

export const APP_SETTINGS_KEY = 'app_settings'

export type AppSettings = {
  /** KC paid once when the member signs in from the installed app. */
  installBonus: number
  /** KC paid once when the member turns on push notifications. */
  pushBonus: number
}

export const APP_DEFAULTS: AppSettings = { installBonus: APP_BONUS, pushBonus: 250 }

export const APP_LIMITS = { installBonus: 10000, pushBonus: 10000 } as const

const clamp = (value: unknown, fallback: number, max: number) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : fallback
}

export function normalizeAppSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    installBonus: clamp(raw?.installBonus, APP_DEFAULTS.installBonus, APP_LIMITS.installBonus),
    pushBonus: clamp(raw?.pushBonus, APP_DEFAULTS.pushBonus, APP_LIMITS.pushBonus),
  }
}
