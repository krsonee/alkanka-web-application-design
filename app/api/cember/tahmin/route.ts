import { getMember } from '@/lib/member'
import { myPrediction, submitPrediction } from '@/lib/cember'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(req: Request) {
  const member = await getMember().catch(() => null)
  if (!member) return Response.json({ picks: [] }, { headers })
  const slot = new URL(req.url).searchParams.get('slot') ?? ''
  const picks = await myPrediction(member.id, slot).catch(() => [])
  return Response.json({ picks }, { headers })
}

export async function POST(req: Request) {
  const member = await getMember().catch(() => null)
  if (!member) return Response.json({ ok: false, error: 'Tahmin için giriş yap kanka.' }, { status: 401, headers })
  const body = (await req.json().catch(() => null)) as { slot?: unknown; picks?: unknown } | null
  const result = await submitPrediction(member.id, String(body?.slot ?? ''), body?.picks).catch(() => ({
    ok: false as const,
    error: 'Tahmin kaydedilemedi, tekrar dene.',
  }))
  return Response.json(result, { status: result.ok ? 200 : 400, headers })
}
