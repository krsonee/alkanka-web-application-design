import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { MOTION_FONTS } from '@/lib/motion/spec'

/** The font files the film is drawn with, for the live preview in the panel. */
export async function GET(request: NextRequest) {
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })
  const font = MOTION_FONTS.find((f) => f.id === request.nextUrl.searchParams.get('id')) ?? MOTION_FONTS[0]
  const data = await readFile(path.join(process.cwd(), 'assets', 'studio-fonts', font.file))
  return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': 'font/ttf', 'Cache-Control': 'private, max-age=86400' } })
}
