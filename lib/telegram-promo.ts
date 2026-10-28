import { getContent, setContent } from '@/lib/content'
import { normalizeTelegramPromo, TELEGRAM_PROMO_KEY, type TelegramPromoSettings } from '@/lib/telegram-promo-config'

export async function getTelegramPromo(): Promise<TelegramPromoSettings> {
  return normalizeTelegramPromo(await getContent(TELEGRAM_PROMO_KEY).catch(() => null))
}

export async function saveTelegramPromo(input: unknown) {
  const clean = normalizeTelegramPromo(input)
  await setContent(TELEGRAM_PROMO_KEY, clean)
  return clean
}
