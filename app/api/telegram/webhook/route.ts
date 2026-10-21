import { getChatConfig, handleUpdate, verifyWebhookSecret } from '@/lib/telegram-chat'
import type { HubUpdate } from '@/lib/tg-hub'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  const authorized = await verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token')).catch((error) => {
    console.error('[telegram-webhook] secret check failed', error)
    return false
  })
  if (!authorized) {
    return new Response('unauthorized', { status: 401 })
  }
  try {
    const update = (await request.json()) as HubUpdate
    const chat = await getChatConfig()
    if (chat) {
      // The live-chat bot can also hold the guard or support role, so it goes through the shared dispatcher.
      const { dispatchUpdate } = await import('@/lib/tg-hub')
      await dispatchUpdate(chat.botId, update)
    } else if (!update.callback_query) {
      await handleUpdate(update)
    }
  } catch (error) {
    // Returning 200 keeps Telegram from retrying a broken update forever.
    console.error('[telegram-webhook]', error)
  }
  return Response.json({ ok: true })
}
