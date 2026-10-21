import { getMember } from '@/lib/member'
import { addReaction, engageState, placePrediction, playHalftime, tickWatch, toggleFollow } from '@/lib/kankatv-engage'
import type { PredictPick } from '@/lib/kankatv-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const member = await getMember()
  try {
    const state = await engageState(member?.id ?? null, {
      viewer: searchParams.get('viewer') ?? undefined,
      since: Number(searchParams.get('since')) || 0,
    })
    return Response.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[kankatv:engage]', error)
    return Response.json({ error: 'Şu an yüklenemedi' }, { status: 500 })
  }
}

type Body = { action?: string; kind?: string; gameId?: number; pick?: PredictPick; teamId?: number; teamName?: string }

export async function POST(request: Request) {
  const member = await getMember()
  if (!member) return Response.json({ error: 'Önce giriş yap kanka' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Body
  try {
    switch (body.action) {
      case 'tick':
        return Response.json({ watch: await tickWatch(member.id) })
      case 'react':
        await addReaction(member.id, String(body.kind))
        return Response.json({ ok: true })
      case 'predict':
        return Response.json({ prediction: await placePrediction(member.id, Number(body.gameId), body.pick as PredictPick) })
      case 'scratch':
        return Response.json(await playHalftime(member.id, Number(body.gameId)))
      case 'follow':
        return Response.json({ following: await toggleFollow(member.id, Number(body.teamId), String(body.teamName ?? '')) })
      default:
        return Response.json({ error: 'Geçersiz işlem' }, { status: 400 })
    }
  } catch (error) {
    return Response.json({ error: (error as Error).message || 'İşlem yapılamadı' }, { status: 400 })
  }
}
