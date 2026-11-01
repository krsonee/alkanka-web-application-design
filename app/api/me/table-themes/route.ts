import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { DEFAULT_OFFERS, isThemeId } from '@/lib/table-themes'
import { getThemeState, isThemeGame, setThemePick } from '@/lib/table-themes-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const m = await getMember()
  try {
    return NextResponse.json(await getThemeState(m?.id ?? null))
  } catch (error) {
    console.error('[table-themes] okunamadı', error)
    return NextResponse.json({ picks: {}, owned: [], level: 0, levelNames: [], catalog: DEFAULT_OFFERS, signedIn: Boolean(m) })
  }
}

export async function PUT(req: Request) {
  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'Tema seçmek için giriş yapmalısın.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { game?: unknown; themeId?: unknown } | null
  if (!body || !isThemeGame(body.game)) return NextResponse.json({ error: 'Geçersiz oyun.' }, { status: 400 })
  const themeId = body.themeId === null ? null : isThemeId(body.themeId) ? body.themeId : undefined
  if (themeId === undefined) return NextResponse.json({ error: 'Geçersiz tema.' }, { status: 400 })
  try {
    await setThemePick(m.id, body.game, themeId)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Tema kaydedilemedi.' }, { status: 403 })
  }
  return NextResponse.json(await getThemeState(m.id))
}
