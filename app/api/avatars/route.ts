import { NextResponse } from 'next/server'
import { avatarMap } from '@/lib/avatars'
import { frameMap } from '@/lib/badge-value'

export async function GET() {
  const [map, frames] = await Promise.all([
    avatarMap().catch((error) => {
      console.error('[avatars] harita okunamadı', error)
      return {}
    }),
    frameMap().catch((error) => {
      console.error('[avatars] çerçeveler okunamadı', error)
      return {}
    }),
  ])
  return NextResponse.json({ map, frames }, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } })
}
