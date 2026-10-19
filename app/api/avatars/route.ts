import { NextResponse } from 'next/server'
import { avatarMap } from '@/lib/avatars'

export async function GET() {
  const map = await avatarMap().catch((error) => {
    console.error('[avatars] harita okunamadı', error)
    return {}
  })
  return NextResponse.json({ map }, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } })
}
