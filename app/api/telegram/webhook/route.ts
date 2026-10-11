import { handleUpdate, verifyWebhookSecret, type TgUpdate } from '@/lib/telegram-chat'

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
    await handleUpdate((await request.json()) as TgUpdate)
  } catch (error) {
    // Returning 200 keeps Telegram from retrying a broken update forever.
    console.error('[telegram-webhook]', error)
  }
  return Response.json({ ok: true })
}
