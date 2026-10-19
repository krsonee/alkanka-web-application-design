import { handleOddsUpdate, verifyOddsSecret } from '@/lib/special-odds'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  const authorized = await verifyOddsSecret(request.headers.get('x-telegram-bot-api-secret-token')).catch(() => false)
  if (!authorized) return new Response('unauthorized', { status: 401 })
  try {
    await handleOddsUpdate(await request.json())
  } catch (error) {
    // Returning 200 keeps Telegram from retrying a broken update forever.
    console.error('[odds-webhook]', error)
  }
  return Response.json({ ok: true })
}
