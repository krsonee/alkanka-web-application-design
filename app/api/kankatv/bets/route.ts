import { getMember } from '@/lib/member'
import { betsState, placeBet } from '@/lib/tv-bets'
import { hitRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const member = await getMember()
  try {
    return Response.json(await betsState(member?.id ?? null), { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('[tv-bets] state', error)
    return Response.json({ error: 'Etkinlikler yüklenemedi' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const member = await getMember()
  if (!member) return Response.json({ error: 'Katılmak için giriş yap' }, { status: 401 })
  if (await hitRateLimit(`tvbet:${member.id}`, 10, 60)) return Response.json({ error: 'Çok hızlı kanka, biraz bekle' }, { status: 429 })
  const body = (await request.json().catch(() => ({}))) as { marketId?: unknown; pick?: unknown; stake?: unknown }
  try {
    const r = await placeBet(member.id, Number(body.marketId), String(body.pick ?? ''), Number(body.stake))
    return Response.json({ ok: true, ...r })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}
