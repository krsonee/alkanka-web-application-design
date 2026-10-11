import { NextResponse } from 'next/server'
import { getKpConfig, levelMap } from '@/lib/kanka-puan'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [levels, cfg] = await Promise.all([levelMap(), getKpConfig()])
  return NextResponse.json(
    { levels, names: cfg.levels.map((l) => l.name) },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
