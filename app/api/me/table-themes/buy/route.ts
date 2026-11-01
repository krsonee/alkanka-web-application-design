import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { isThemeId } from '@/lib/table-themes'
import { buyTheme, getThemeState } from '@/lib/table-themes-server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'Tema almak için giriş yapmalısın.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { themeId?: unknown } | null
  if (!body || !isThemeId(body.themeId)) return NextResponse.json({ error: 'Geçersiz tema.' }, { status: 400 })
  try {
    const { balance } = await buyTheme(m.id, m.name, body.themeId)
    return NextResponse.json({ balance, state: await getThemeState(m.id) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Satın alınamadı.' }, { status: 400 })
  }
}
