import { getChatConfig, handleUpdate, verifyWebhookSecret, type TgUpdate } from '@/lib/telegram-chat'
import type { TgCallback } from '@/lib/tg-hub'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const authorized = await verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token')).catch((error) => {
    console.error('[telegram-webhook] secret check failed', error)
    return false
  })
  if (!authorized) {
    return new Response('unauthorized', { status: 401 })
  }
  try {
    const update = (await request.json()) as TgUpdate & { callback_query?: TgCallback }
    if (update.callback_query) {
      const chat = await getChatConfig()
      const { dmOptOut } = await import('@/lib/tg-hub')
      if (chat && update.callback_query.data === 'dm:off') await dmOptOut(chat.botId, update.callback_query)
    } else {
      await handleUpdate(update)
    }
  } catch (error) {
    // Returning 200 keeps Telegram from retrying a broken update forever.
    console.error('[telegram-webhook]', error)
  }
  return Response.json({ ok: true })
}
