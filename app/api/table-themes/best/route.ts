import { NextResponse } from 'next/server'
import { bestTheme, isThemeGame } from '@/lib/table-themes-server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const game = url.searchParams.get('game')
  if (!isThemeGame(game)) return NextResponse.json({ themeId: null }, { status: 400 })
  const ids = (url.searchParams.get('u') ?? '').split(',').map((s) => s.trim()).filter((s) => /^[\w-]{1,80}$/.test(s))
  try {
    return NextResponse.json({ themeId: await bestTheme(game, ids) })
  } catch (error) {
    console.error('[table-themes] masa teması okunamadı', error)
    return NextResponse.json({ themeId: null })
  }
}
