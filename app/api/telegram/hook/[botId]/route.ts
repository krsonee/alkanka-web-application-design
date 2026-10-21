import { dispatchUpdate, verifyHook, type HubUpdate } from '@/lib/tg-hub'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const botId = Number((await params).botId)
  if (!Number.isInteger(botId) || botId <= 0) return new Response('not found', { status: 404 })
  const authorized = await verifyHook(botId, request.headers.get('x-telegram-bot-api-secret-token')).catch((error) => {
    console.error('[tg-hook] secret check failed', error)
    return false
  })
  if (!authorized) return new Response('unauthorized', { status: 401 })
  try {
    await dispatchUpdate(botId, (await request.json()) as HubUpdate)
  } catch (error) {
    // Returning 200 keeps Telegram from retrying a broken update forever.
    console.error('[tg-hook]', error)
  }
  return Response.json({ ok: true })
}
