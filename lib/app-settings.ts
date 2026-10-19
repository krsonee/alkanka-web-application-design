import 'server-only'
import { getContent } from '@/lib/content'
import { APP_SETTINGS_KEY, normalizeAppSettings, type AppSettings } from '@/lib/app-config'

export async function getAppSettings(): Promise<AppSettings> {
  return normalizeAppSettings(await getContent<Partial<AppSettings>>(APP_SETTINGS_KEY).catch(() => null))
}
